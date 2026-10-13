import { describe, expect, it } from "vitest";

import { calculateDrivingReward, sumReward } from "./reward";

describe("driving reward", () => {
  const safeStep = {
    progressDelta: 0,
    checkpointPassed: false,
    reachedGoal: false,
    normalizedOffset: 0,
    nearestSensor: 1,
    steerDelta: 0,
    speed: 0,
    offRoad: false,
    offRoadTerminal: false,
    collision: false,
  } as const;

  it("keeps its displayed components equal to the transition total", () => {
    const breakdown = calculateDrivingReward({
      ...safeStep,
      progressDelta: 0.2,
      normalizedOffset: 0.5,
      nearestSensor: 0.075,
      steerDelta: 1,
    });

    expect(sumReward(breakdown)).toBeCloseTo(
      Object.values(breakdown).reduce((sum, value) => sum + value, 0),
      10,
    );
  });

  it("never rewards speed, standing still, or steering oscillation", () => {
    const idle = sumReward(calculateDrivingReward(safeStep));
    const fastWithoutProgress = sumReward(
      calculateDrivingReward({ ...safeStep, speed: 70 }),
    );
    const oscillating = sumReward(
      calculateDrivingReward({ ...safeStep, speed: 70, steerDelta: 2 }),
    );

    expect(idle).toBeLessThan(0);
    expect(fastWithoutProgress).toBe(idle);
    expect(oscillating).toBeLessThan(fastWithoutProgress);
  });

  it("makes an idle horizon decisively worse than making route progress", () => {
    const idle = sumReward(calculateDrivingReward(safeStep));
    const moving = sumReward(calculateDrivingReward({ ...safeStep, progressDelta: 0.2, speed: 12 }));

    expect(idle).toBeLessThanOrEqual(-0.1);
    expect(moving).toBeGreaterThan(0);
    expect(idle * 80).toBeLessThan(-8);
  });

  it("adds a terminal penalty when an episode is ended for stalling", () => {
    const stalled = calculateDrivingReward({ ...safeStep, stalled: true });
    expect(stalled.stalled).toBeLessThanOrEqual(-12);
  });

  it("makes collision decisively worse than ordinary progress", () => {
    const collision = calculateDrivingReward({
      ...safeStep,
      progressDelta: 0.4,
      collision: true,
    });

    expect(collision.collision).toBe(-25);
    expect(sumReward(collision)).toBeLessThan(-20);
  });

  it("makes repeated road-edge departure worse than ordinary forward progress", () => {
    const terminalDeparture = calculateDrivingReward({
      ...safeStep,
      progressDelta: 0.4,
      offRoad: true,
      offRoadTerminal: true,
    });

    expect(terminalDeparture.offRoadTerminal).toBe(-15);
    expect(sumReward(terminalDeparture)).toBeLessThan(-15);
  });
});
