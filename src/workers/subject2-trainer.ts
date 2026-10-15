/// <reference lib="webworker" />

import * as tf from "@tensorflow/tfjs";
import { Subject2TrainingRuntime, type Subject2Mode } from "@/subject2/subject2-runtime";
import { shouldAutoCheckpoint, subject2Cadence, type Subject2Command, type Subject2Envelope, type Subject2Payload, type Subject2TrainingSpeed } from "./subject2-trainer-protocol";

tf.enableProdMode();
const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let runtime: Subject2TrainingRuntime | null = null;
let running = false;
let generation = 0;
let sequence = 0;
let mode: Subject2Mode = "training";
let speed: Subject2TrainingSpeed = "max";
let backend = "initializing";
let stepsPerSecond = 0;
let lastMetricStep = 0;
let lastMetricTime = performance.now();
let lastCheckpointStep = 0;

function post(payload: Subject2Payload): void {
  const envelope: Subject2Envelope = { schemaVersion: "subject2-v1", sequence: sequence++, payload };
  scope.postMessage(envelope);
}

function postCheckpoint(reason: "auto" | "manual" | "pause"): void {
  if (!runtime) return;
  const checkpoint = runtime.exportCheckpoint();
  lastCheckpointStep = checkpoint.stepCount;
  post({ type: "checkpoint", checkpoint, savedAt: new Date().toISOString(), reason });
}

async function pump(token: number): Promise<void> {
  try {
    while (running && runtime && token === generation) {
      let snapshot = runtime.snapshot();
      const cadence = subject2Cadence(speed);
      for (let index = 0; index < cadence.stepsPerBatch && running && token === generation; index += 1) snapshot = await runtime.step();
      const now = performance.now();
      const elapsed = now - lastMetricTime;
      if (elapsed > 0) {
        const instant = (snapshot.step - lastMetricStep) * 1_000 / elapsed;
        stepsPerSecond = stepsPerSecond === 0 ? instant : stepsPerSecond * .72 + instant * .28;
        lastMetricStep = snapshot.step;
        lastMetricTime = now;
      }
      post({ type: "snapshot", snapshot, metrics: { backend, stepsPerSecond } });
      if (shouldAutoCheckpoint(lastCheckpointStep, snapshot.step)) postCheckpoint("auto");
      await new Promise((resolve) => setTimeout(resolve, cadence.delayMs));
    }
  } catch (error) {
    running = false;
    post({ type: "error", message: error instanceof Error ? error.message : "科目二训练失败" });
  }
}

async function start(command: Extract<Subject2Command, { type: "start" }>): Promise<void> {
  await tf.ready();
  backend = tf.getBackend();
  runtime?.dispose();
  runtime = new Subject2TrainingRuntime({ seed: command.seed });
  if (command.checkpoint) runtime.importCheckpoint(command.checkpoint);
  mode = command.checkpoint?.mode ?? command.mode;
  speed = command.speed;
  if (!command.checkpoint) runtime.setMode(mode);
  running = command.run ?? true;
  generation += 1;
  lastMetricStep = 0;
  lastMetricTime = performance.now();
  lastCheckpointStep = runtime.snapshot().step;
  post({ type: "snapshot", snapshot: runtime.snapshot(), metrics: { backend, stepsPerSecond } });
  post({ type: "status", status: running ? "running" : "paused" });
  if (running) void pump(generation);
}

scope.addEventListener("message", (event: MessageEvent<Subject2Command>) => {
  const command = event.data;
  void (async () => {
    if (command.type === "start") return start(command);
    if (command.type === "dispose") {
      running = false; generation += 1; runtime?.dispose(); runtime = null; scope.close(); return;
    }
    if (!runtime) { post({ type: "status", status: "idle" }); return; }
    if (command.type === "pause") { running = false; generation += 1; post({ type: "status", status: "paused" }); postCheckpoint("pause"); }
    else if (command.type === "resume") { if (!running) { running = true; generation += 1; post({ type: "status", status: "running" }); void pump(generation); } }
    else if (command.type === "set-mode") { mode = command.mode; runtime.setMode(mode); }
    else if (command.type === "set-speed") speed = command.speed;
    else if (command.type === "set-training-selection") {
      runtime.setTrainingSelection(command.scope, command.project);
      post({ type: "snapshot", snapshot: runtime.snapshot(), metrics: { backend, stepsPerSecond } });
    }
    else if (command.type === "request-checkpoint") postCheckpoint("manual");
    else if (command.type === "load-checkpoint") {
      running = false; generation += 1; runtime.importCheckpoint(command.checkpoint); mode = command.checkpoint.mode;
      lastCheckpointStep = command.checkpoint.stepCount;
      post({ type: "snapshot", snapshot: runtime.snapshot(), metrics: { backend, stepsPerSecond } });
      post({ type: "status", status: "paused" });
    }
  })().catch((error) => post({ type: "error", message: error instanceof Error ? error.message : "科目二 Worker 失败" }));
});
