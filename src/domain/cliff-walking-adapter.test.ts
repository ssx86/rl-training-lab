import { describe, expect, it } from "vitest";

import { ACTIONS, START_STATE } from "./cliff-walking";
import { CliffWalkingAdapter } from "./cliff-walking-adapter";

describe("CliffWalkingAdapter", () => {
  it("preserves the existing transition while adding generic evidence", () => {
    const environment = new CliffWalkingAdapter();

    expect(environment.reset()).toBe(START_STATE);
    const transition = environment.step(ACTIONS.UP);

    expect(transition.state).toBe(START_STATE);
    expect(transition.observation).toBe(transition.state);
    expect(transition.nextObservation).toBe(transition.nextState);
    expect(transition.rewardBreakdown).toEqual({ step: transition.reward });
  });
});
