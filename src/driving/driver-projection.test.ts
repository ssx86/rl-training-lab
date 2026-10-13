import { describe, expect, it } from "vitest";
import { CITY_MAPS } from "./city-map";
import { buildDriverRoadProjection } from "./driver-projection";
import { createVehicleState } from "./vehicle-model";

describe("driver road projection", () => {
  it("keeps a straight route centered and clips it to the local camera range", () => {
    const city = CITY_MAPS[1];
    const start = city.nodes.find((node) => node.id === "nw")!;
    const vehicle = createVehicleState({ x: start.x, y: start.y, heading: 0 });
    const projection = buildDriverRoadProjection(city, vehicle, "nw", "ne", {
      width: 640, height: 360, horizon: 122, nearMeters: 3, farMeters: 64, focalLength: 390,
    });
    expect(projection.center.length).toBeGreaterThan(5);
    expect(projection.center.every((point) => point.forwardMeters <= 64)).toBe(true);
    expect(projection.center[0].y).toBeGreaterThan(projection.center.at(-1)!.y);
  });

  it("projects actual route curvature instead of a fixed painted road", () => {
    const city = CITY_MAPS[1];
    const start = city.nodes.find((node) => node.id === "w")!;
    const vehicle = createVehicleState({ x: start.x, y: start.y, heading: 0 });
    const projection = buildDriverRoadProjection(city, vehicle, "w", "ne", {
      width: 640, height: 360, horizon: 122, nearMeters: 3, farMeters: 640, focalLength: 390,
    });
    const xValues = projection.center.map((point) => Math.round(point.x));
    expect(new Set(xValues).size).toBeGreaterThan(1);
  });
});
