import { afterEach, describe, expect, it } from "vitest";
import { nextSubject2ExplorationNoise, Subject2TrainingRuntime, shouldAdvanceTrainingProject, shouldUseProjectWarmup } from "./subject2-runtime";
import type { Subject2Action } from "./subject2-vehicle";

describe("random-scene single-car TD3 runtime", () => {
  const runtimes: Subject2TrainingRuntime[] = [];
  afterEach(() => runtimes.splice(0).forEach((runtime) => runtime.dispose()));

  it("adds one continuous transition per training step", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 3 }); runtimes.push(runtime);
    expect((await runtime.step()).replaySize).toBe(1);
    const second = await runtime.step();
    expect(second.replaySize).toBe(2);
    expect(second.action.steer).toBeGreaterThanOrEqual(-1);
    expect(second.action.throttle).toBeLessThanOrEqual(1);
    expect(second.action.brake).toBeGreaterThanOrEqual(0);
    expect(second.action.gear).toBeGreaterThanOrEqual(-1);
    expect(second.action.throttle * second.action.brake!).toBe(0);
  });

  it("keeps one coverage option coherent for its full physical transition", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 31 }); runtimes.push(runtime);
    const first = await runtime.step();
    const remaining = first.explorationOptionStepsRemaining;
    expect(first.explorationOption).not.toBe(null);
    expect(remaining).toBeGreaterThanOrEqual(5);
    expect(Object.values(runtime.exportCheckpoint().explorationOptionCounts ?? {}).reduce((sum, count) => sum + count, 0)).toBe(1);
    for (let index = 0; index < remaining; index += 1) {
      expect((await runtime.step()).action).toEqual(first.action);
    }
    await runtime.step();
    expect(Object.values(runtime.exportCheckpoint().explorationOptionCounts ?? {}).reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(first.action.throttle * first.action.brake!).toBe(0);
  });

  it("covers sustained drive and sustained braking instead of relying on isolated random pedal samples", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 1_000, seed: 32 }); runtimes.push(runtime);
    const actions: Subject2Action[] = [];
    for (let step = 0; step < 120; step += 1) actions.push((await runtime.step()).action);
    const longestRun = (matches: (action: (typeof actions)[number]) => boolean) => actions.reduce(
      (state, action) => matches(action)
        ? { current: state.current + 1, maximum: Math.max(state.maximum, state.current + 1) }
        : { current: 0, maximum: state.maximum },
      { current: 0, maximum: 0 },
    ).maximum;
    expect(longestRun((action) => action.throttle >= .65)).toBeGreaterThanOrEqual(8);
    expect(longestRun((action) => (action.brake ?? 0) >= .9)).toBeGreaterThanOrEqual(8);
  });

  it("uses correlated exploration so a small opposite innovation does not flip the pedal axis", () => {
    const next = nextSubject2ExplorationNoise([0, .4, 0], [0, -.05, 0], .85);
    expect(next[1]).toBeGreaterThan(0);
    expect(next[1]).toBeLessThan(.4);
  });

  it("reports the exact model and measured inference latency", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 3 }); runtimes.push(runtime);
    const snapshot = await runtime.step();
    expect(snapshot.modelInfo).toMatchObject({ algorithm: "TD3", observationSize: 57, actionSize: 3, actorParameters: 24_323, onlineTrainableParameters: 73_221 });
    expect(snapshot.inferenceMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(snapshot.inferenceMs)).toBe(true);
  });

  it("resets to the same fixed project map after each completed attempt", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 9, maxScenarioSteps: 1, attemptsPerProject: 100 }); runtimes.push(runtime);
    const before = runtime.snapshot();
    const after = await runtime.step();
    expect(after.sceneGeneration).toBe(before.sceneGeneration + 1);
    expect(after.scenario.project).toBe(before.scenario.project);
    expect({ ...after.scenario, id: before.scenario.id, seed: before.scenario.seed }).toEqual(before.scenario);
    expect(after.checkpointIndex).toBe(0);
    expect(after.projectAttempts).toBe(1);
    expect(after.vehicle.x).toBe(after.scenario.start.x);
    expect(after.vehicle.y).toBe(after.scenario.start.y);
  });

  it("rotates after 100 attempts regardless of pass or failure", () => {
    expect(shouldAdvanceTrainingProject(99, 100)).toBe(false);
    expect(shouldAdvanceTrainingProject(100, 100)).toBe(true);
  });

  it("collects a warmup quota for each project rather than only the first project", () => {
    expect(shouldUseProjectWarmup(499, 500)).toBe(true);
    expect(shouldUseProjectWarmup(500, 500)).toBe(false);
    expect(shouldUseProjectWarmup(0, 500)).toBe(true);
  });

  it("trains all five projects in catalogue order while retaining one shared model", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 1_000, seed: 19, maxScenarioSteps: 1, attemptsPerProject: 1 }); runtimes.push(runtime);
    const visited = [runtime.snapshot().scenario.project];
    for (let index = 0; index < 4; index += 1) visited.push((await runtime.step()).scenario.project);
    expect(visited).toEqual(["reverse-parking", "side-parking", "ramp", "s-curve", "right-angle"]);
    expect(runtime.snapshot().replaySize).toBe(4);
    expect(runtime.snapshot().replayByProject).toMatchObject({ "reverse-parking": 1, "side-parking": 1, ramp: 1, "s-curve": 1 });
    expect(runtime.snapshot().projectAttempts).toBe(0);
  });

  it("keeps training one selected subject beyond the rotation interval", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 1_000, seed: 20, maxScenarioSteps: 1, attemptsPerProject: 2 }); runtimes.push(runtime);
    runtime.setTrainingSelection("single", "s-curve");
    expect(runtime.snapshot()).toMatchObject({ trainingScope: "single", selectedProject: "s-curve" });
    for (let index = 0; index < 5; index += 1) {
      const snapshot = await runtime.step();
      expect(snapshot.scenario.project).toBe("s-curve");
    }
    expect(runtime.snapshot().projectAttempts).toBe(5);
  });

  it("switches training scope without recording a failure or clearing shared experience", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 1_000, seed: 21, maxScenarioSteps: 20 }); runtimes.push(runtime);
    await runtime.step();
    const before = runtime.snapshot();
    runtime.setTrainingSelection("single", "right-angle");
    const after = runtime.snapshot();
    expect(after.scenario.project).toBe("right-angle");
    expect(after.step).toBe(before.step);
    expect(after.replaySize).toBe(before.replaySize);
    expect(after.projectStats[before.scenario.project].attempts).toBe(0);
  });

  it("freezes replay and exploration while evaluating the same fixed maps", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 4 }); runtimes.push(runtime);
    await runtime.step();
    const trainingSeed = runtime.snapshot().scenario.seed;
    runtime.setMode("evaluation");
    const snapshot = await runtime.step();
    expect(snapshot.replaySize).toBe(1);
    expect(snapshot.explorationNoise).toBe(0);
    expect(snapshot.scenario.project).toBeDefined();
    expect(snapshot.scenario.seed).not.toBe(trainingSeed);
  });

  it("exposes project and public process stage without leaking coordinates, seed, fixed order or navigation", () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100 }); runtimes.push(runtime);
    const observation = runtime.snapshot().observation;
    expect(observation.vector).toHaveLength(57);
    expect(observation.projectEncoding).toHaveLength(5);
    expect(observation.processStageEncoding).toHaveLength(4);
    expect(observation.projectEncoding.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(observation.processStageEncoding.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect("route" in observation).toBe(false);
    expect("project" in observation).toBe(false);
    expect("seed" in observation).toBe(false);
    expect("checkpointProgress" in observation).toBe(false);
  });

  it("keeps training and unseen-evaluation pass statistics separate", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 18, maxScenarioSteps: 1 }); runtimes.push(runtime);
    await runtime.step();
    expect(Object.values(runtime.snapshot().projectStats).reduce((sum, stats) => sum + stats.attempts, 0)).toBe(1);
    expect(Object.values(runtime.snapshot().projectStats).every((stats) => stats.processCompletionRate >= 0 && stats.processCompletionRate <= 1)).toBe(true);
    expect(runtime.snapshot().terminationCounts.timeout).toBe(1);
    runtime.setMode("evaluation");
    expect(Object.values(runtime.snapshot().projectStats).reduce((sum, stats) => sum + stats.attempts, 0)).toBe(0);
    await runtime.step();
    expect(Object.values(runtime.snapshot().projectStats).reduce((sum, stats) => sum + stats.attempts, 0)).toBe(1);
  });

  it("keeps the latest terminal reason visible throughout the next attempt", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 8, maxScenarioSteps: 2 }); runtimes.push(runtime);
    await runtime.step();
    expect((await runtime.step()).lastTerminalReason).toBe("timeout");
    expect((await runtime.step()).lastTerminalReason).toBe("timeout");
  });

  it("exports and restores model weights and visible training progress without replay", async () => {
    const source = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 27 }); runtimes.push(source);
    await source.step();
    await source.step();
    const checkpoint = source.exportCheckpoint();
    expect(checkpoint.version).toBe(2);
    expect(checkpoint.trainingScope).toBe("rotation");
    expect(Object.values(checkpoint.explorationOptionCounts ?? {}).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(0);
    const restored = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 27 }); runtimes.push(restored);

    restored.importCheckpoint(checkpoint);
    expect(restored.snapshot()).toMatchObject({
      step: 2,
      episode: source.snapshot().episode,
      checkpointCompletions: source.snapshot().checkpointCompletions,
      replaySize: 0,
      trainingScope: "rotation",
    });
    expect(restored.exportCheckpoint().agent.networks[0][0].values)
      .toEqual(checkpoint.agent.networks[0][0].values);
    expect(restored.exportCheckpoint().explorationOptionCounts).toEqual(checkpoint.explorationOptionCounts);
  });

  it("rejects invalid training selection metadata at the checkpoint boundary", () => {
    const runtime = new Subject2TrainingRuntime({ seed: 28 }); runtimes.push(runtime);
    const checkpoint = runtime.exportCheckpoint();
    expect(() => runtime.importCheckpoint({ ...checkpoint, selectedProject: "unknown" as never })).toThrow("训练范围不兼容");
  });
});
