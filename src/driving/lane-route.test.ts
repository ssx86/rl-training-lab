import { describe, expect, it } from "vitest";
import type { CityMap } from "./city-map";
import { createLaneRoute } from "./lane-route";

const city: CityMap = {
  id: "lane-test", name: "Lane", width: 120, height: 40, roadWidth: 8,
  nodes: [
    { id: "a", x: 10, y: 20, label: "A" },
    { id: "b", x: 110, y: 20, label: "B" },
  ],
  edges: [{ from: "a", to: "b" }], objects: [], destinationNodeIds: ["a", "b"],
};

describe("directional lane routes", () => {
  it("places opposing traffic on separate right-hand lanes", () => {
    const eastbound = createLaneRoute(city, "a", "b");
    const westbound = createLaneRoute(city, "b", "a");

    expect(eastbound[0].y).toBeGreaterThan(20);
    expect(westbound[0].y).toBeLessThan(20);
    expect(Math.abs(eastbound[0].y - westbound[0].y)).toBeGreaterThanOrEqual(3.2);
  });
});
