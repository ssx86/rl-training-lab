import { describe, expect, it } from "vitest";

import { advanceVehicle, createVehicleState } from "./vehicle-model";

describe("vehicle model", () => {
  it("accelerates forward with a fixed 100ms time step", () => {
    const start = createVehicleState({ x: 80, y: 320, heading: 0 });
    const next = advanceVehicle(start, { steer: 0, acceleration: 1 });

    expect(next.speed).toBeGreaterThan(0);
    expect(next.x).toBeGreaterThan(start.x);
    expect(next.y).toBeCloseTo(start.y, 8);
  });

  it("supports metre-based city physics without changing the teaching baseline", () => {
    const start = createVehicleState({ x: 0, y: 0, heading: 0, speed: 36 });
    const next = advanceVehicle(start, { steer: 0, acceleration: 0 }, { speedToDistanceScale: 1 / 3.6, wheelBase: 2.75 });
    expect(next.x - start.x).toBeCloseTo((next.speed / 3.6) * 0.1, 8);
  });

  it("changes heading predictably when steering", () => {
    const moving = createVehicleState({
      x: 80,
      y: 320,
      heading: 0,
      speed: 30,
    });

    const first = advanceVehicle(moving, { steer: 1, acceleration: 0 });
    const replay = advanceVehicle(moving, { steer: 1, acceleration: 0 });

    expect(first).toEqual(replay);
    expect(first.heading).toBeGreaterThan(0);
  });

  it("treats braking as braking and never silently selects reverse gear", () => {
    const stopped = createVehicleState({ x: 80, y: 320, heading: 0 });
    const moving = createVehicleState({ x: 80, y: 320, heading: 0, speed: 2 });

    expect(advanceVehicle(stopped, { steer: 0, acceleration: -1 }).speed).toBe(0);
    expect(advanceVehicle(moving, { steer: 0, acceleration: -1 }).speed).toBe(0);
  });
});
