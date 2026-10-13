/// <reference lib="webworker" />

import * as tf from "@tensorflow/tfjs";
import { FLEET_CITY_MAPS } from "../driving/city-map";
import { FLEET_SCHEMA_VERSION, SharedFleetRuntime, type FleetMode } from "../driving/shared-fleet-runtime";
import type { FleetCommand, FleetEnvelope, FleetPayload, PlaybackRate, TrainingSpeed } from "./fleet-trainer-protocol";

tf.enableProdMode();

const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let runtime: SharedFleetRuntime | null = null;
let running = false;
let sequence = 0;
let generation = 0;
let mode: FleetMode = "training";
let trainingSpeed: TrainingSpeed = "max";
let playbackRate: PlaybackRate = 1;
let computeBackend = "initializing";
let stepsPerSecond = 0;
let lastMetricTime = performance.now();
let lastMetricStep = 0;

function post(payload: FleetPayload): void {
  const envelope: FleetEnvelope = { schemaVersion: FLEET_SCHEMA_VERSION, sequence: sequence++, payload };
  scope.postMessage(envelope);
}

function trainingChunk(speed: TrainingSpeed): number {
  // Small cooperative chunks preserve the main thread and WebGL renderer while
  // TD3 trains twin critics on the worker GPU. MAX removes pacing delays, not yields.
  return speed === "max" ? 8 : speed;
}

async function pump(token: number): Promise<void> {
  try {
    while (running && runtime && token === generation) {
      let snapshot = runtime.snapshot();
      const steps = mode === "training" ? trainingChunk(trainingSpeed) : 1;
      for (let index = 0; index < steps && running && token === generation; index += 1) {
        snapshot = await runtime.step();
      }
      const now = performance.now();
      const elapsed = now - lastMetricTime;
      if (elapsed > 0) {
        const instant = (snapshot.step - lastMetricStep) * 1_000 / elapsed;
        stepsPerSecond = stepsPerSecond === 0 ? instant : stepsPerSecond * .72 + instant * .28;
        lastMetricTime = now; lastMetricStep = snapshot.step;
      }
      post({ type: "snapshot", snapshot, metrics: { backend: computeBackend, stepsPerSecond } });
      const delay = mode === "inference" ? 100 / playbackRate : trainingSpeed === "max" ? 0 : 16;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  } catch (error) {
    running = false;
    post({ type: "error", message: error instanceof Error ? error.message : "Fleet training loop failed." });
  }
}

async function start(command: Extract<FleetCommand, { type: "start" }>): Promise<void> {
  await tf.ready();
  computeBackend = tf.getBackend();
  const city = FLEET_CITY_MAPS.find((item) => item.id === command.cityId) ?? FLEET_CITY_MAPS[0];
  runtime?.dispose();
  runtime = new SharedFleetRuntime({
    city,
    seed: command.seed,
    vehicleCount: command.vehicleCount,
    rotationEvery: command.rotationEvery,
  });
  mode = command.mode;
  trainingSpeed = command.trainingSpeed;
  playbackRate = command.playbackRate;
  stepsPerSecond = 0; lastMetricStep = 0; lastMetricTime = performance.now();
  runtime.setMode(mode);
  running = true;
  generation += 1;
  post({ type: "status", status: "running" });
  void pump(generation);
}

scope.addEventListener("message", (event: MessageEvent<FleetCommand>) => {
  const command = event.data;
  void (async () => {
    if (command.type === "start") return start(command);
    if (command.type === "dispose") {
      running = false;
      generation += 1;
      runtime?.dispose();
      runtime = null;
      scope.close();
      return;
    }
    if (!runtime) {
      post({ type: "status", status: "idle" });
      return;
    }
    if (command.type === "pause") {
      running = false;
      generation += 1;
      post({ type: "status", status: "paused" });
    } else if (command.type === "resume") {
      if (!running) {
        running = true;
        generation += 1;
        post({ type: "status", status: "running" });
        void pump(generation);
      }
    } else if (command.type === "set-mode") {
      mode = command.mode;
      runtime.setMode(mode);
    } else if (command.type === "set-training-speed") {
      trainingSpeed = command.speed;
    } else if (command.type === "set-playback-rate") {
      playbackRate = command.rate;
    } else if (command.type === "resize-fleet") {
      runtime.resizeFleet(command.vehicleCount);
      post({ type: "snapshot", snapshot: runtime.snapshot(), metrics: { backend: computeBackend, stepsPerSecond } });
    }
  })().catch((error) => {
    running = false;
    post({ type: "error", message: error instanceof Error ? error.message : "Fleet Worker failed." });
  });
});
