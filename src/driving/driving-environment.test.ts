import { describe, expect, it } from "vitest";

import { DrivingEnvironment } from "./driving-environment";
import { createStraightTrainingMap } from "./maps";

describe("DrivingEnvironment", () => {
  it("replays the same seed and action sequence exactly", () => {
    const actions = [5, 5, 4, 5, 2, 5, 4, 5];
    const run = () => {
      const environment = new DrivingEnvironment(createStraightTrainingMap());
      environment.reset(42);
      return actions.map((action) => environment.step(action));
    };

    expect(run()).toEqual(run());
  });

  it("always returns a finite normalized 12-value observation", () => {
    const environment = new DrivingEnvironment(createStraightTrainingMap());
    const observation = environment.reset(7);
    const transition = environment.step(5);

    for (const value of [...Object.values(observation), ...Object.values(transition.nextObservation)]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("ends the episode on an obstacle collision", () => {
    const map = createStraightTrainingMap({
      obstacles: [{ id: "blocker", x: 105, y: 320, radius: 13 }],
    });
    const environment = new DrivingEnvironment(map);
    environment.reset();

    let transition = environment.step(5);
    for (let index = 0; index < 40 && !transition.done; index += 1) {
      transition = environment.step(5);
    }

    expect(transition.done).toBe(true);
    expect(transition.event).toBe("collision");
    expect(transition.rewardBreakdown.collision).toBe(-25);
    expect(() => environment.step(5)).toThrow(/reset/i);
  });

  it("does not award positive return for standing still", () => {
    const environment = new DrivingEnvironment(createStraightTrainingMap());
    environment.reset();

    const transition = environment.step(4);

    expect(transition.reward).toBeLessThan(0);
    expect(transition.rewardBreakdown.progress).toBe(0);
  });

  it("gives a visible positive shaping signal only when new route progress is made", () => {
    const environment = new DrivingEnvironment(createStraightTrainingMap());
    environment.reset();

    const moving = environment.step(5);

    expect(moving.rewardBreakdown.progress).toBeGreaterThan(0.02);
    expect(moving.reward).toBeGreaterThan(0);
  });
});
