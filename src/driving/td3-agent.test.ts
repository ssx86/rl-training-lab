import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as tf from "@tensorflow/tfjs";
import { CONTINUOUS_OBSERVATION_SIZE } from "./continuous-control";
import { Td3Agent } from "@/rl/continuous/td3-agent";
import { SUBJECT2_ACTION_CODEC, SUBJECT2_ACTION_SIZE } from "@/subject2/subject2-vehicle";

describe("Td3Agent", () => {
  const agents: Array<{ dispose(): void }> = [];
  beforeAll(async () => { await tf.setBackend("cpu"); await tf.ready(); });
  afterEach(() => agents.splice(0).forEach((agent) => agent.dispose()));

  it("produces two bounded continuous controls rather than nine action IDs", () => {
    const agent = new Td3Agent(); agents.push(agent);
    const action = agent.selectAction(Array(CONTINUOUS_OBSERVATION_SIZE).fill(0));
    expect(action.steer).toBeGreaterThanOrEqual(-1); expect(action.steer).toBeLessThanOrEqual(1);
    expect(action.throttle).toBeGreaterThanOrEqual(-1); expect(action.throttle).toBeLessThanOrEqual(1);
    expect(agent.selectActions([Array(CONTINUOUS_OBSERVATION_SIZE).fill(0), Array(CONTINUOUS_OBSERVATION_SIZE).fill(.1)])).toHaveLength(2);
  });

  it("describes the exact actor, twin-critic and optimizer configuration for teaching UI", () => {
    const agent = new Td3Agent({ observationSize: 41, hiddenUnits: 128 }); agents.push(agent);
    expect(agent.describe()).toMatchObject({
      algorithm: "TD3",
      observationSize: 41,
      actionSize: 2,
      hiddenUnits: 128,
      actorParameters: 22_146,
      criticParametersEach: 22_273,
      onlineTrainableParameters: 66_692,
      gamma: .99,
      tau: .005,
      policyDelay: 2,
    });
  });

  it("supports the two-output signed-speed control contract used by subject 2", () => {
    const agent = new Td3Agent({ observationSize: 48, actionSize: SUBJECT2_ACTION_SIZE }, SUBJECT2_ACTION_CODEC); agents.push(agent);
    const action = agent.selectAction(Array(48).fill(0));
    expect(agent.describe().actionSize).toBe(2);
    expect(action).toEqual(expect.objectContaining({
      steer: expect.any(Number), longitudinal: expect.any(Number),
    }));
    expect(action.longitudinal).toBeGreaterThanOrEqual(-1);
    expect(action.longitudinal).toBeLessThanOrEqual(1);
  });

  it("updates twin critics every batch and delays actor updates", async () => {
    const agent = new Td3Agent({ hiddenUnits: 8, policyDelay: 2 }); agents.push(agent);
    const observation = Array(CONTINUOUS_OBSERVATION_SIZE).fill(0);
    const batch = Array.from({ length: 4 }, (_, index) => ({
      observation, action: { steer: index / 4, throttle: .3 }, reward: 1,
      nextObservation: observation, done: false,
    }));
    const first = await agent.trainBatch(batch);
    const second = await agent.trainBatch(batch);
    expect(first.criticLoss).toBeTypeOf("number"); expect(Number.isFinite(first.criticLoss)).toBe(true);
    expect(first.actorUpdated).toBe(false); expect(second.actorUpdated).toBe(true);
    expect(second.actorLoss).toBeTypeOf("number"); expect(Number.isFinite(second.actorLoss)).toBe(true);
  });

  it("releases temporary target-update tensors during long training runs", async () => {
    const agent = new Td3Agent({ hiddenUnits: 8, policyDelay: 2 }); agents.push(agent);
    const observation = Array(CONTINUOUS_OBSERVATION_SIZE).fill(.1);
    const batch = Array.from({ length: 4 }, () => ({
      observation, action: { steer: .2, throttle: .4 }, reward: .5,
      nextObservation: observation, done: false,
    }));

    await agent.trainBatch(batch);
    await agent.trainBatch(batch);
    const settledTensorCount = tf.memory().numTensors;
    for (let update = 0; update < 8; update += 1) await agent.trainBatch(batch);

    expect(tf.memory().numTensors).toBeLessThanOrEqual(settledTensorCount + 4);
  });

  it("exports and restores every TD3 network without changing policy output", async () => {
    const source = new Td3Agent({ hiddenUnits: 8, seed: 7 }); agents.push(source);
    const restored = new Td3Agent({ hiddenUnits: 8, seed: 99 }); agents.push(restored);
    const observation = Array(CONTINUOUS_OBSERVATION_SIZE).fill(.15);
    const batch = Array.from({ length: 4 }, () => ({
      observation, action: { steer: .3, throttle: .5 }, reward: 2,
      nextObservation: observation, done: false,
    }));
    await source.trainBatch(batch);
    await source.trainBatch(batch);
    const expected = source.selectAction(observation);
    expect(restored.selectAction(observation)).not.toEqual(expected);

    restored.importState(source.exportState());
    expect(restored.selectAction(observation)).toEqual(expected);
    expect(restored.exportState().updateCount).toBe(2);
  });
});
