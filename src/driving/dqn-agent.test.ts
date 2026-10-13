import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as tf from "@tensorflow/tfjs";

import {
  computeBellmanTarget,
  createEpsilonSchedule,
  DqnAgent,
} from "./dqn-agent";
import type { Experience } from "@/rl/replay-buffer";

const zeros = Array.from({ length: 12 }, () => 0);

describe("DQN foundations", () => {
  const agents: DqnAgent[] = [];

  beforeAll(async () => {
    await tf.setBackend("cpu");
    await tf.ready();
  });

  afterEach(() => {
    agents.splice(0).forEach((agent) => agent.dispose());
    tf.disposeVariables();
  });

  it("does not bootstrap terminal transitions", () => {
    expect(computeBellmanTarget(2, true, 99, 0.99)).toBe(2);
    expect(computeBellmanTarget(2, false, 10, 0.9)).toBe(11);
  });

  it("linearly decays epsilon and clamps at its floor", () => {
    const epsilon = createEpsilonSchedule({ start: 1, end: 0.05, steps: 100 });

    expect(epsilon(0)).toBe(1);
    expect(epsilon(50)).toBeCloseTo(0.525);
    expect(epsilon(100)).toBe(0.05);
    expect(epsilon(500)).toBe(0.05);
  });

  it("predicts exactly nine finite action values", async () => {
    const agent = new DqnAgent({ seed: 7, hiddenUnits: 16 });
    agents.push(agent);

    const values = agent.predict(zeros);

    expect(values).toHaveLength(9);
    expect(values.every(Number.isFinite)).toBe(true);
  });

  it("keeps the documented 128-unit default when optional values are undefined", () => {
    const agent = new DqnAgent({ hiddenUnits: undefined, seed: undefined });
    agents.push(agent);

    expect(agent.predict(zeros)).toHaveLength(9);
  });

  it("trains a batch and synchronizes the target network", async () => {
    const agent = new DqnAgent({ seed: 11, hiddenUnits: 16 });
    agents.push(agent);
    const batch: Experience<number>[] = [
      {
        observation: zeros,
        action: 5,
        reward: 1,
        nextObservation: zeros.map((_, index) => (index === 5 ? 0.2 : 0)),
        done: false,
      },
      {
        observation: zeros.map((_, index) => (index === 0 ? 0.5 : 0)),
        action: 4,
        reward: -2,
        nextObservation: zeros,
        done: true,
      },
    ];

    const result = await agent.trainBatch(batch);
    agent.syncTargetNetwork();

    expect(Number.isFinite(result.loss)).toBe(true);
    expect(result.targets).toHaveLength(2);
    expect(agent.predictTarget(zeros)).toEqual(agent.predict(zeros));
  });
});
