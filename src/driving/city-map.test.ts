import { describe, expect, it } from "vitest";
import { CITY_MAPS, FLEET_CITY_MAPS, cityIsConnected, shortestCityRoute } from "./city-map";

describe("curated city maps", () => {
  it("keeps every taxi destination reachable on every city", () => {
    for (const city of CITY_MAPS) {
      expect(cityIsConnected(city)).toBe(true);
      const sample = city.nodes.filter((_, index) => index % Math.max(1, Math.floor(city.nodes.length / 8)) === 0).slice(0, 8);
      for (const from of sample) for (const to of sample) {
        expect(shortestCityRoute(city, from.id, to.id)[0].id).toBe(from.id);
      }
    }
  });

  it("ships only complex, connected, attributed real maps in the fleet selector", () => {
    expect(FLEET_CITY_MAPS).toHaveLength(3);
    for (const city of FLEET_CITY_MAPS) {
      expect(cityIsConnected(city)).toBe(true);
      expect(city.roads?.length).toBeGreaterThan(80);
      expect(city.nodes.length).toBeGreaterThan(150);
      expect(city.attribution).toContain("OpenStreetMap");
      expect(city.sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
    }
    expect(FLEET_CITY_MAPS.flatMap((city) => city.roads ?? []).filter((road) => road.roundabout).length).toBeGreaterThan(5);
  });

  it("respects the travel direction of one-way edges", () => {
    const directed: typeof CITY_MAPS[number] = {
      id: "directed", name: "Directed", width: 100, height: 100, roadWidth: 8, objects: [],
      nodes: [
        { id: "a", x: 0, y: 0, label: "A" },
        { id: "b", x: 50, y: 0, label: "B" },
        { id: "c", x: 25, y: 50, label: "C" },
      ],
      edges: [
        { from: "a", to: "b", roundabout: true, oneWay: true },
        { from: "b", to: "c", roundabout: true, oneWay: true },
        { from: "c", to: "a", roundabout: true, oneWay: true },
      ],
    };

    expect(shortestCityRoute(directed, "b", "a").map((node) => node.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps sampled taxi orders reachable after applying one-way rules", () => {
    for (const city of FLEET_CITY_MAPS) {
      const destinationIds = city.destinationNodeIds ?? city.nodes.map((node) => node.id);
      const sample = destinationIds.filter((_, index) => index % Math.max(1, Math.floor(destinationIds.length / 6)) === 0).slice(0, 6);
      for (const from of sample) for (const to of sample) {
        if (from !== to) expect(shortestCityRoute(city, from, to).at(-1)?.id).toBe(to);
      }
    }
  });
});
