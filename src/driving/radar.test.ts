import { describe, expect, it } from "vitest";
import type { CityMap } from "./city-map";
import { RADAR_BEAM_COUNT, RADAR_CHANNELS } from "./continuous-control";
import type { DrivingMap } from "./maps";
import { radarToVector, scanForwardRadar } from "./radar";
import { createVehicleState } from "./vehicle-model";

const city: CityMap = {
  id: "radar-city", name: "Radar", width: 100, height: 50, roadWidth: 10,
  nodes: [
    { id: "a", x: 10, y: 25, label: "A" },
    { id: "b", x: 90, y: 25, label: "B" },
  ],
  edges: [{ from: "a", to: "b" }],
  objects: [{ id: "building", kind: "building", x: 26, y: 25, size: 2 }],
  destinationNodeIds: ["a", "b"],
};

const routeMap: DrivingMap = {
  id: "radar-route", width: 100, height: 50, roadHalfWidth: 5,
  route: city.nodes, obstacles: [], start: { x: 10, y: 25, heading: 0 },
  goalRadius: 3, checkpointFractions: [],
};

describe("forward radar", () => {
  it("keeps simultaneous semantic distance channels instead of one winning label", () => {
    const vehicle = createVehicleState({ x: 10, y: 25, heading: 0 });
    const scan = scanForwardRadar({
      vehicle, routeMap, city, destinationNodeId: "b",
      otherVehicles: [{ id: "taxi-2", label: "出租车 B", vehicle: createVehicleState({ x: 19, y: 25, heading: 0 }) }],
    });
    const centre = scan.beams[Math.floor(RADAR_BEAM_COUNT / 2)];

    expect(scan.beams).toHaveLength(RADAR_BEAM_COUNT);
    expect(centre.distances.vehicle).toBeLessThan(1);
    expect(centre.distances.structure).toBeLessThan(1);
    expect(scan.detections.map((item) => item.channel)).toEqual(expect.arrayContaining(["vehicle", "structure"]));
    expect(radarToVector(scan)).toHaveLength(RADAR_BEAM_COUNT * RADAR_CHANNELS.length);
  });

  it("reports road edge distance independently on side-facing beams", () => {
    const scan = scanForwardRadar({
      vehicle: createVehicleState({ x: 10, y: 25, heading: 0 }), routeMap, city, destinationNodeId: "b", otherVehicles: [],
    });
    expect(scan.beams[0].distances["road-edge"]).toBeLessThan(.2);
    expect(scan.beams.at(-1)!.distances["road-edge"]).toBeLessThan(.2);
  });
});
