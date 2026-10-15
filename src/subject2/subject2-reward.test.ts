import { describe, expect, it } from "vitest";
import { calculateSubject2Reward, posePotential } from "./subject2-reward";

const target = { motion: "forward" as const, reward: 24 };
const base = {
  previousError: { distance: 10, heading: .2, speed: 1, total: 0 },
  nextError: { distance: 9.5, heading: .18, speed: 1, total: 0 },
  target,
  speed: 1,
  steerChange: .1,
  throttleChange: .1,
  minimumClearance: 1.8,
  checkpointReached: false,
  isFinalCheckpoint: false,
  collided: false,
  timedOut: false,
  requiredHold: false,
  validHoldStep: false,
  startTimedOut: false,
  stalled: false,
  previousBayOverlap: 0,
  nextBayOverlap: 0,
};

describe("subject 2 explainable reward", () => {
  it("uses a bounded pose potential and rewards measurable progress", () => {
    expect(posePotential(base.nextError, .8)).toBeGreaterThan(posePotential(base.previousError, .8));
    const reward = calculateSubject2Reward(base);
    expect(reward.poseProgress).toBeGreaterThan(0);
    expect(reward.total).toBe(Object.entries(reward).filter(([key]) => key !== "total").reduce((sum, [, value]) => sum + value, 0));
  });

  it("penalizes driving opposite to the required motion and genuinely unsafe clearance", () => {
    const centered = calculateSubject2Reward({ ...base, minimumClearance: .9 });
    const reward = calculateSubject2Reward({ ...base, speed: -1.2, minimumClearance: .4 });
    expect(centered.clearance).toBe(0);
    expect(reward.wrongDirection).toBeLessThan(0);
    expect(reward.clearance).toBeLessThan(0);
  });

  it("rewards only incremental bay overlap instead of paying for standing still in the bay", () => {
    const entering = calculateSubject2Reward({ ...base, previousBayOverlap: .1, nextBayOverlap: .35 });
    const stationary = calculateSubject2Reward({ ...base, previousBayOverlap: .35, nextBayOverlap: .35 });
    const leaving = calculateSubject2Reward({ ...base, previousBayOverlap: .35, nextBayOverlap: .1 });
    expect(entering.bayOverlapProgress).toBeGreaterThan(0);
    expect(stationary.bayOverlapProgress).toBe(0);
    expect(leaving.bayOverlapProgress).toBeLessThan(0);
  });

  it("penalizes abrupt automatic-brake changes as part of control smoothness", () => {
    const smooth = calculateSubject2Reward({ ...base, steerChange: 0, throttleChange: 0, brakeChange: 0 });
    const abruptBrake = calculateSubject2Reward({ ...base, steerChange: 0, throttleChange: 0, brakeChange: 1 });
    expect(abruptBrake.controlSmoothness).toBeLessThan(smooth.controlSmoothness);
  });

  it("makes passing decisively better than waiting, collision or timeout", () => {
    const passed = calculateSubject2Reward({ ...base, checkpointReached: true, isFinalCheckpoint: true });
    const idle = calculateSubject2Reward({ ...base, speed: 0, nextError: base.previousError });
    const collision = calculateSubject2Reward({ ...base, collided: true });
    const timeout = calculateSubject2Reward({ ...base, timedOut: true });
    expect(passed.passBonus).toBe(100);
    expect(passed.total).toBeGreaterThan(100);
    expect(idle.total).toBeLessThan(0);
    expect(collision.total).toBeLessThan(-90);
    expect(timeout.total).toBeLessThan(-25);
  });

  it("replaces the ordinary inactivity penalty with a bounded reward during a valid required hold", () => {
    const holding = calculateSubject2Reward({ ...base, speed: 0, requiredHold: true, validHoldStep: true });
    const invalid = calculateSubject2Reward({ ...base, speed: 0, requiredHold: true, validHoldStep: false });
    expect(holding.inactivity).toBe(0);
    expect(holding.stableHold).toBeGreaterThan(0);
    expect(invalid.stableHold).toBe(0);
  });

  it("penalizes missing the 30 second launch deadline", () => {
    const reward = calculateSubject2Reward({ ...base, startTimedOut: true });
    expect(reward.startTimeout).toBe(-100);
    expect(reward.total).toBeLessThan(-90);
  });

  it("makes no-progress recoverable but still decisively worse than one inactive step", () => {
    const stalled = calculateSubject2Reward({ ...base, speed: 0, stalled: true });
    const collision = calculateSubject2Reward({ ...base, collided: true });
    const idle = calculateSubject2Reward({ ...base, speed: 0, stalled: false });
    expect(stalled.stalled).toBe(-35);
    expect(stalled.total).toBeGreaterThan(collision.total);
    expect(stalled.total).toBeLessThan(idle.total - 30);
  });
});
