import { describe, expect, it } from "vitest";

import { projectOntoRoute } from "@/simulation/geometry";
import { createSeededObstacleMap } from "./maps";

describe("seeded obstacle maps", () => {
  it("reproduces the same layout for the same seed", () => {
    expect(createSeededObstacleMap(2026)).toEqual(createSeededObstacleMap(2026));
    expect(createSeededObstacleMap(2026).obstacles).not.toEqual(
      createSeededObstacleMap(2027).obstacles,
    );
  });

  it("keeps a stable snapshot for the published evaluation seed", () => {
    expect(createSeededObstacleMap(2026).obstacles).toMatchInlineSnapshot(`
      [
        {
          "id": "seed-2026-obstacle-1",
          "radius": 17.32932652812451,
          "x": 270.4248072998598,
          "y": 329.3471320560202,
        },
        {
          "id": "seed-2026-obstacle-2",
          "radius": 17.780019381083548,
          "x": 472.6140050892718,
          "y": 303.8669119896367,
        },
      ]
    `);
  });

  it("keeps every generated obstacle inside the road with a bypass margin", () => {
    for (const seed of [1, 2, 3, 10, 20, 30, 40]) {
      const map = createSeededObstacleMap(seed);
      for (const obstacle of map.obstacles) {
        const projection = projectOntoRoute(obstacle, map.route);
        expect(projection.distance + obstacle.radius).toBeLessThan(
          map.roadHalfWidth,
        );
        expect(obstacle.radius * 2 + 24).toBeLessThan(map.roadHalfWidth * 2);
      }
    }
  });
});
