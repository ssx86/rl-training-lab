import { describe, expect, it } from "vitest";
import { createVehicleState } from "./vehicle-model";
import { vehiclesCollide } from "./vehicle-collision";

describe("oriented vehicle collision", () => {
  it("does not report adjacent-lane vehicles as a collision", () => {
    const first = createVehicleState({ x: 30, y: 18.2, heading: 0 });
    const second = createVehicleState({ x: 30, y: 21.8, heading: Math.PI });
    expect(vehiclesCollide(first, second)).toBe(false);
  });

  it("detects overlapping bumpers in the same lane", () => {
    const first = createVehicleState({ x: 30, y: 20, heading: 0 });
    const second = createVehicleState({ x: 34, y: 20, heading: 0 });
    expect(vehiclesCollide(first, second)).toBe(true);
  });
});
