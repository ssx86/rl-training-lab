import { afterEach, describe, expect, it } from "vitest";
import { nextSubject2ExplorationNoise, Subject2TrainingRuntime, shouldAdvanceTrainingProject } from "./subject2-runtime";

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

  it("uses a real warmup action and holds it for one simulated second", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 31 }); runtimes.push(runtime);
    const first = await runtime.step();
    for (let index = 1; index < 10; index += 1) {
      expect((await runtime.step()).action).toEqual(first.action);
    }
    expect(first.action.throttle * first.action.brake!).toBe(0);
  });

  it("uses correlated exploration so a small opposite innovation does not flip the pedal axis", () => {
    const next = nextSubject2ExplorationNoise([0, .4, 0], [0, -.05, 0], .85);
    expect(next[1]).toBeGreaterThan(0);
    expect(next[1]).toBeLessThan(.4);
  });

  it("reports the exact model and measured inference latency", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 3 }); runtimes.push(runtime);
    const snapshot = await runtime.step();
    expect(snapshot.modelInfo).toMatchObject({ algorithm: "TD3", observationSize: 48, actionSize: 3, actorParameters: 23_171, onlineTrainableParameters: 69_765 });
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

  it("trains all five projects in catalogue order while retaining one shared model", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 1_000, seed: 19, maxScenarioSteps: 1, attemptsPerProject: 1 }); runtimes.push(runtime);
    const visited = [runtime.snapshot().scenario.project];
    for (let index = 0; index < 4; index += 1) visited.push((await runtime.step()).scenario.project);
    expect(visited).toEqual(["reverse-parking", "side-parking", "ramp", "s-curve", "right-angle"]);
    expect(runtime.snapshot().replaySize).toBe(4);
    expect(runtime.snapshot().projectAttempts).toBe(0);
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

  it("does not leak question identity, coordinates, fixed order or navigation", () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100 }); runtimes.push(runtime);
    const observation = runtime.snapshot().observation;
    expect(observation.vector).toHaveLength(48);
    expect("route" in observation).toBe(false);
    expect("project" in observation).toBe(false);
    expect("seed" in observation).toBe(false);
    expect("checkpointProgress" in observation).toBe(false);
  });

  it("keeps training and unseen-evaluation pass statistics separate", async () => {
    const runtime = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 18, maxScenarioSteps: 1 }); runtimes.push(runtime);
    await runtime.step();
    expect(Object.values(runtime.snapshot().projectStats).reduce((sum, stats) => sum + stats.attempts, 0)).toBe(1);
    runtime.setMode("evaluation");
    expect(Object.values(runtime.snapshot().projectStats).reduce((sum, stats) => sum + stats.attempts, 0)).toBe(0);
    await runtime.step();
    expect(Object.values(runtime.snapshot().projectStats).reduce((sum, stats) => sum + stats.attempts, 0)).toBe(1);
  });

  it("exports and restores model weights and visible training progress without replay", async () => {
    const source = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 27 }); runtimes.push(source);
    await source.step();
    await source.step();
    const checkpoint = source.exportCheckpoint();
    const restored = new Subject2TrainingRuntime({ warmupSteps: 100, seed: 27 }); runtimes.push(restored);

    restored.importCheckpoint(checkpoint);
    expect(restored.snapshot()).toMatchObject({
      step: 2,
      episode: source.snapshot().episode,
      checkpointCompletions: source.snapshot().checkpointCompletions,
      replaySize: 0,
    });
    expect(restored.exportCheckpoint().agent.networks[0][0].values)
      .toEqual(checkpoint.agent.networks[0][0].values);
  });
});
