import { describe, expect, it } from "vitest";

import { evaluateDrivingPolicy } from "./evaluator";
import { ScriptedDriver } from "./scripted-driver";

describe("driving evaluator", () => {
  it("reports all required metrics for 20 fixed and 20 unseen seeds", () => {
    const report = evaluateDrivingPolicy({
      fixedSeeds: Array.from({ length: 20 }, (_, index) => index + 1),
      unseenSeeds: Array.from({ length: 20 }, (_, index) => index + 1_001),
      createPolicy: (map) => {
        const driver = new ScriptedDriver(map);
        return (observation, vehicle) => driver.chooseAction(observation, vehicle);
      },
    });

    expect(report.fixed.sampleCount).toBe(20);
    expect(report.unseen.sampleCount).toBe(20);
    expect(report.fixed.successRate).toBe(1);
    expect(report.unseen.successRate).toBe(1);
    expect(report.fixed.collisionRate).toBe(0);
    expect(report.unseen.offRoadRate).toBe(0);
    expect(report.fixed.medianRouteEfficiency).toBeGreaterThanOrEqual(1);
    expect(report.fixed.minSafetyDistance).toBeGreaterThan(0);
  });

  it("counts a policy that never moves as stagnant instead of successful", () => {
    const report = evaluateDrivingPolicy({
      fixedSeeds: [1, 2],
      unseenSeeds: [1_001, 1_002],
      createPolicy: () => () => 4,
    });

    expect(report.fixed.successRate).toBe(0);
    expect(report.fixed.stagnantRate).toBe(1);
    expect(report.fixed.sampleCount).toBe(2);
  });
});
