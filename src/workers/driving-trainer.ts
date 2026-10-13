/// <reference lib="webworker" />

import * as tf from "@tensorflow/tfjs";

import { createCurriculumMap } from "../driving/curriculum";
import { DrivingTrainingRuntime } from "../driving/training-runtime";
import {
  createTrainerEnvelope,
  commandRequiresRuntime,
  isDrivingTrainerCommand,
  type DrivingTrainerCommand,
  type TrainerWorkerMode,
} from "./driving-trainer-protocol";

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let runtime: DrivingTrainingRuntime | null = null;
let mode: TrainerWorkerMode = "training";
let sequence = 0;
let pumping = false;
let activeLevel: Parameters<typeof createCurriculumMap>[0] = "L1";
let trainingSeed = 101;

function explorationSteps(level: Parameters<typeof createCurriculumMap>[0]): number {
  return level === "L1" ? 12_000 : level === "L2" ? 20_000 : 30_000;
}

function createRuntime(level: Parameters<typeof createCurriculumMap>[0], seed: number) {
  return new DrivingTrainingRuntime({
    map: createCurriculumMap(level, seed),
    seed,
    warmupSteps: level === "L1" ? 500 : 1_000,
    epsilonDecaySteps: explorationSteps(level),
  });
}

function post(payload: Parameters<typeof createTrainerEnvelope>[2]): void {
  workerScope.postMessage(createTrainerEnvelope(mode, sequence++, payload));
}

async function pump(): Promise<void> {
  if (pumping || !runtime) return;
  pumping = true;
  try {
    while (pumping && runtime) {
      let latest = null;
      for (let index = 0; index < 32 && pumping && runtime; index += 1) {
        latest = await runtime.step();
        if (latest.transition.done && mode === "training" && activeLevel === "L3") {
          trainingSeed += 1;
          runtime.resetEnvironment(createCurriculumMap("L3", trainingSeed), trainingSeed);
          runtime.start("training");
        }
      }
      if (latest) post({ type: "snapshot", snapshot: latest });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } catch (error) {
    pumping = false;
    post({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown training error",
    });
  }
}

async function handle(command: DrivingTrainerCommand): Promise<void> {
  if (command.type === "start") {
    pumping = false;
    mode = command.mode;
    await tf.setBackend("cpu");
    await tf.ready();
    const levelChanged = activeLevel !== command.level;
    activeLevel = command.level;
    trainingSeed = command.level === "L3" ? 100 + (command.seed ?? 1) : command.seed ?? 1;
    const map = createCurriculumMap(command.level, trainingSeed);
    if (runtime) {
      runtime.resetEnvironment(map, trainingSeed);
      if (levelChanged) runtime.configureExploration(explorationSteps(command.level));
    }
    else {
      runtime = createRuntime(command.level, trainingSeed);
    }
    runtime.start(mode);
    post({ type: "status", status: "running" });
    void pump();
    return;
  }
  if (command.type === "import-model" && !runtime) {
    await tf.setBackend("cpu");
    await tf.ready();
    runtime = createRuntime(command.level, command.seed ?? 1);
  }
  if (command.type === "evaluate" && !runtime) {
    await tf.setBackend("cpu");
    await tf.ready();
    runtime = createRuntime(command.level, command.seed ?? 1);
  }
  if (!runtime && !commandRequiresRuntime(command)) {
    if (command.type === "dispose") workerScope.close();
    else post({ type: "status", status: "idle" });
    return;
  }
  if (!runtime) throw new Error("Start the trainer before sending commands.");
  if (command.type === "pause") {
    pumping = false;
    runtime.pause();
    post({ type: "status", status: "paused" });
  } else if (command.type === "resume") {
    runtime.resume();
    post({ type: "status", status: "running" });
    void pump();
  } else if (command.type === "step") {
    const wasPaused = runtime.snapshot().status === "paused";
    if (wasPaused) runtime.resume();
    const snapshot = await runtime.step();
    if (wasPaused) runtime.pause();
    post({ type: "snapshot", snapshot });
  } else if (command.type === "reset") {
    pumping = false;
    runtime.resetEnvironment(
      createCurriculumMap(command.level, command.seed ?? 1),
      command.seed ?? 1,
    );
    post({ type: "status", status: "idle" });
  } else if (command.type === "export-model") {
    post({ type: "model", model: runtime.exportModel() });
  } else if (command.type === "import-model") {
    pumping = false;
    runtime.resetEnvironment(
      createCurriculumMap(command.level, command.seed ?? 1),
      command.seed ?? 1,
    );
    runtime.importModel(command.model);
    post({ type: "status", status: "paused" });
  } else if (command.type === "evaluate") {
    pumping = false;
    mode = "evaluation";
    runtime.pause();
    post({ type: "status", status: "running" });
    const report = runtime.evaluate(command.fixedSeeds, command.unseenSeeds);
    post({ type: "evaluation-report", report });
    post({ type: "status", status: "complete" });
  } else if (command.type === "dispose") {
    pumping = false;
    runtime.dispose();
    runtime = null;
    workerScope.close();
  }
}

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isDrivingTrainerCommand(event.data)) {
    post({ type: "error", message: "Invalid driving trainer command." });
    return;
  }
  void handle(event.data).catch((error) => {
    post({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown worker error",
    });
  });
});
