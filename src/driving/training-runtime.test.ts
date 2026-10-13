import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as tf from "@tensorflow/tfjs";

import { createStraightTrainingMap } from "./maps";
import { DrivingTrainingRuntime } from "./training-runtime";

describe("DrivingTrainingRuntime", () => {
  const runtimes: DrivingTrainingRuntime[] = [];

  beforeAll(async () => {
    await tf.setBackend("cpu");
    await tf.ready();
  });

  afterEach(() => {
    runtimes.splice(0).forEach((runtime) => runtime.dispose());
    tf.disposeVariables();
  });

  it("records real transitions and trains after warm-up", async () => {
    const runtime = new DrivingTrainingRuntime({
      map: createStraightTrainingMap(),
      seed: 8,
      hiddenUnits: 8,
      warmupSteps: 2,
      batchSize: 2,
      targetSyncEvery: 1,
      trainEvery: 1,
    });
    runtimes.push(runtime);
    runtime.start("training");

    const first = await runtime.step();
    const second = await runtime.step();

    expect(first.bufferSize).toBe(1);
    expect(second.bufferSize).toBe(2);
    expect(second.loss).not.toBeNull();
    expect(second.transition.stepIndex).toBe(2);
    expect(second.qValues).toHaveLength(9);
    expect(second.targetSyncAge).toBe(0);
  });

  it("preserves all context while paused", async () => {
    const runtime = new DrivingTrainingRuntime({
      map: createStraightTrainingMap(),
      seed: 2,
      hiddenUnits: 8,
    });
    runtimes.push(runtime);
    runtime.start("training");
    await runtime.step();
    const beforePause = runtime.snapshot();
    runtime.pause();

    await expect(runtime.step()).rejects.toThrow(/paused/i);
    expect(runtime.snapshot()).toEqual({ ...beforePause, status: "paused" });
    runtime.resume();
    const afterResume = await runtime.step();
    expect(afterResume.environmentStep).toBe(beforePause.environmentStep + 1);
  });

  it("runs evaluation without changing replay or online weights", async () => {
    const runtime = new DrivingTrainingRuntime({
      map: createStraightTrainingMap(),
      seed: 3,
      hiddenUnits: 8,
    });
    runtimes.push(runtime);
    runtime.start("evaluation");
    const weightsBefore = runtime.weights();

    const result = await runtime.step();

    expect(result.epsilon).toBe(0);
    expect(result.source).toBe("exploit");
    expect(runtime.snapshot().bufferSize).toBe(0);
    expect(runtime.weights()).toEqual(weightsBefore);
  });

  it("keeps learned weights and replay when switching from training to evaluation", async () => {
    const runtime = new DrivingTrainingRuntime({
      map: createStraightTrainingMap(),
      seed: 12,
      hiddenUnits: 8,
      warmupSteps: 2,
      batchSize: 2,
      trainEvery: 1,
    });
    runtimes.push(runtime);
    runtime.start("training");
    await runtime.step();
    await runtime.step();
    const trainedWeights = runtime.weights();
    const trainedBufferSize = runtime.snapshot().bufferSize;

    runtime.resetEnvironment(createStraightTrainingMap(), 99);
    runtime.start("evaluation");
    await runtime.step();

    expect(runtime.snapshot().bufferSize).toBe(trainedBufferSize);
    expect(runtime.weights()).toEqual(trainedWeights);
  });

  it("restarts exploration for a harder curriculum without clearing learned state", async () => {
    const runtime = new DrivingTrainingRuntime({
      map: createStraightTrainingMap(),
      seed: 5,
      hiddenUnits: 8,
      epsilonDecaySteps: 2,
    });
    runtimes.push(runtime);
    runtime.start("training");
    await runtime.step();
    await runtime.step();
    const replayBefore = runtime.snapshot().bufferSize;

    runtime.configureExploration(100);
    runtime.resetEnvironment(createStraightTrainingMap({ id: "harder" }), 6);
    runtime.start("training");
    const firstHarderStep = await runtime.step();

    expect(firstHarderStep.epsilon).toBe(1);
    expect(firstHarderStep.bufferSize).toBe(replayBefore + 1);
    expect(firstHarderStep.map.id).toBe("harder");
  });
});
