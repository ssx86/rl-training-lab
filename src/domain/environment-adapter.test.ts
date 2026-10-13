import { describe, expect, it } from "vitest";

import type {
  EnvironmentAdapter,
  EnvironmentStep,
  RuntimeEnvelope,
} from "./environment-adapter";

describe("EnvironmentAdapter contract", () => {
  it("keeps reward evidence attached to every transition", () => {
    type Observation = { position: number };
    type Action = "left" | "right";

    const adapter: EnvironmentAdapter<Observation, Action, "moved"> = {
      id: "line-world",
      schemaVersion: "line-world-v1",
      reset: () => ({ position: 0 }),
      step: (action): EnvironmentStep<Observation, Action, "moved"> => ({
        observation: { position: 0 },
        action,
        reward: 1,
        nextObservation: { position: action === "right" ? 1 : -1 },
        done: false,
        event: "moved",
        rewardBreakdown: { progress: 1 },
        stepIndex: 1,
      }),
    };

    const transition = adapter.step("right");

    expect(transition.reward).toBe(1);
    expect(transition.rewardBreakdown).toEqual({ progress: 1 });
    expect(transition.nextObservation.position).toBe(1);
  });

  it("versions every worker message and names its runtime mode", () => {
    const message: RuntimeEnvelope<{ episode: number }> = {
      schemaVersion: "driving-v1",
      mode: "training",
      sequence: 8,
      payload: { episode: 3 },
    };

    expect(message).toMatchObject({
      schemaVersion: "driving-v1",
      mode: "training",
      sequence: 8,
    });
  });
});
