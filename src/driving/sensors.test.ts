import { describe, expect, it } from "vitest";

import { createStraightTrainingMap } from "./maps";
import { senseDistances } from "./sensors";
import { createVehicleState } from "./vehicle-model";

describe("distance sensors", () => {
  it("sees a centered obstacle before the angled rays do", () => {
    const map = createStraightTrainingMap({
      obstacles: [{ id: "center", x: 110, y: 320, radius: 5 }],
    });
    const vehicle = createVehicleState({ x: 80, y: 320, heading: 0 });

    const distances = senseDistances(vehicle, map);

    expect(distances[2]).toBeLessThan(distances[0]);
    expect(distances[2]).toBeLessThan(distances[4]);
    expect(distances.every((value) => value >= 0 && value <= 1)).toBe(true);
  });
});
