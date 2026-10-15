import { describe, expect, it } from "vitest";
import { advanceSubject2Vehicle, createSubject2Vehicle } from "./subject2-vehicle";
import {
  chooseSubject2ExplorationOption,
  explorationCoverageKey,
  planSubject2ExplorationOption,
  subject2ExplorationOptionProbability,
} from "./subject2-exploration";

const middleRandom = () => .5;

describe("subject 2 coverage-guided temporal exploration", () => {
  it("holds a drive option long enough to release full brake and move in the required direction", () => {
    let vehicle = createSubject2Vehicle({ x: 10, y: 10, heading: 0, brake: 1, isBrakeHolding: true });
    const option = planSubject2ExplorationOption("drive", vehicle, -1, middleRandom);

    for (let step = 0; step < option.durationSteps; step += 1) vehicle = advanceSubject2Vehicle(vehicle, option.action);

    expect(option.durationSteps).toBeGreaterThanOrEqual(8);
    expect(vehicle.brake).toBe(0);
    expect(vehicle.gear).toBe(-1);
    expect(vehicle.speed).toBeLessThan(-.5);
  });

  it("holds a brake option long enough to stop from maximum training speed", () => {
    let vehicle = createSubject2Vehicle({ x: 10, y: 10, heading: 0, speed: 4, throttle: 1, gear: 1 });
    const option = planSubject2ExplorationOption("brake", vehicle, 1, middleRandom);

    for (let step = 0; step < option.durationSteps; step += 1) vehicle = advanceSubject2Vehicle(vehicle, option.action);

    expect(vehicle.throttle).toBe(0);
    expect(vehicle.speed).toBe(0);
    expect(vehicle.isBrakeHolding).toBe(true);
  });

  it("uses an optimistic UCB bonus to select an uncovered option in the same motion state", () => {
    const vehicle = createSubject2Vehicle({ x: 10, y: 10, heading: 0, speed: 0, brake: 1, isBrakeHolding: true });
    const counts = {
      [explorationCoverageKey("reverse-parking", vehicle, "drive")]: 20,
      [explorationCoverageKey("reverse-parking", vehicle, "brake")]: 20,
      [explorationCoverageKey("reverse-parking", vehicle, "coast")]: 0,
    };

    expect(chooseSubject2ExplorationOption(counts, "reverse-parking", vehicle, middleRandom)).toBe("coast");
  });

  it("keeps a post-warmup rescue chance when the policy is stationary", () => {
    const stopped = createSubject2Vehicle({ x: 10, y: 10, heading: 0 });
    const moving = createSubject2Vehicle({ x: 10, y: 10, heading: 0, speed: 2 });
    expect(subject2ExplorationOptionProbability(120_000, stopped)).toBe(.18);
    expect(subject2ExplorationOptionProbability(0, moving)).toBe(.08);
    expect(subject2ExplorationOptionProbability(120_000, moving)).toBe(.03);
  });
});
