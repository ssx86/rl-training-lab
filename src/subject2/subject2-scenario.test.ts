import { describe, expect, it } from "vitest";
import { SUBJECT2_PROJECT_ORDER } from "./subject2-course";
import { collidesWithCourse, isVehicleFullyInsideBay, isVehicleWithinRoadSurfaces } from "./subject2-collision";
import { evaluationScenarioSeed, generateSubject2Scenario, trainingScenarioSeed, validateSubject2Scenario } from "./subject2-scenario";
import { SUBJECT2_STANDARD } from "./subject2-standard";
import { createSubject2Vehicle, SUBJECT2_VEHICLE } from "./subject2-vehicle";

function circumradius(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const ab = Math.hypot(a.x - b.x, a.y - b.y);
  const bc = Math.hypot(b.x - c.x, b.y - c.y);
  const ca = Math.hypot(c.x - a.x, c.y - a.y);
  const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return area2 < 1e-7 ? Number.POSITIVE_INFINITY : ab * bc * ca / (2 * area2);
}

describe("random subject 2 scenario generator", () => {
  it("is deterministic for a reproducible seed", () => {
    expect(generateSubject2Scenario(97)).toEqual(generateSubject2Scenario(97));
  });

  it("uses one fixed, unmirrored and unrotated map for each project", () => {
    const samples = Array.from({ length: 80 }, (_, seed) => generateSubject2Scenario(seed + 1));
    expect(new Set(samples.map((item) => item.project))).toEqual(new Set(SUBJECT2_PROJECT_ORDER));
    expect(samples.every((item) => item.mirrored === false)).toBe(true);
    expect(samples.every((item) => item.rotationQuarterTurns === 0)).toBe(true);
    expect(samples.every((item) => item.scale === 1)).toBe(true);
    for (const project of SUBJECT2_PROJECT_ORDER) {
      const first = generateSubject2Scenario(1, project);
      const second = generateSubject2Scenario(999_999, project);
      expect({ ...second, id: first.id, seed: first.seed }).toEqual(first);
    }
  });

  it("keeps all generated geometry inside a safe 100 by 76 metre scene", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const scenario = generateSubject2Scenario(seed);
      const points = [scenario.start, ...scenario.checkpoints, ...scenario.segments.flatMap((s) => [{ x: s.ax, y: s.ay }, { x: s.bx, y: s.by }])];
      expect(points.every((point) => point.x >= 0 && point.x <= scenario.width && point.y >= 0 && point.y <= scenario.height)).toBe(true);
    }
  });

  it("reserves a disjoint seed space for unseen evaluation scenes", () => {
    const train = new Set(Array.from({ length: 100 }, (_, generation) => trainingScenarioSeed(17, generation)));
    const evaluation = Array.from({ length: 100 }, (_, generation) => evaluationScenarioSeed(17, generation));
    expect(evaluation.every((seed) => !train.has(seed))).toBe(true);
  });

  it("uses the exact GA 1029-2022 C1 bay dimensions", () => {
    const reverse = generateSubject2Scenario(31, "reverse-parking");
    const side = generateSubject2Scenario(32, "side-parking");
    expect(reverse.parkingBays[0].length / reverse.scale).toBeCloseTo(SUBJECT2_STANDARD.reverseParking.bayLength, 5);
    expect(reverse.parkingBays[0].width / reverse.scale).toBeCloseTo(SUBJECT2_STANDARD.reverseParking.bayWidth, 5);
    expect(side.parkingBays[0].length / side.scale).toBeCloseTo(SUBJECT2_STANDARD.sideParking.bayLength, 5);
    expect(side.parkingBays[0].width / side.scale).toBeCloseTo(SUBJECT2_STANDARD.sideParking.bayWidth, 5);
  });

  it("draws the reverse bay at the same regulated dimensions used for containment", () => {
    const scenario = generateSubject2Scenario(31, "reverse-parking");
    const bay = scenario.parkingBays[0];
    const left = scenario.segments.find((item) => item.id === "bay-left")!;
    const right = scenario.segments.find((item) => item.id === "bay-right")!;
    const back = scenario.segments.find((item) => item.id === "bay-back")!;
    expect(Math.hypot(left.bx - left.ax, left.by - left.ay)).toBeCloseTo(bay.length, 5);
    expect(Math.hypot(back.bx - back.ax, back.by - back.ay)).toBeCloseTo(bay.width, 5);
    const separation = Math.hypot(left.ax - right.ax, left.ay - right.ay);
    expect(separation).toBeCloseTo(bay.width, 5);
    expect(bay.length - SUBJECT2_VEHICLE.length).toBeCloseTo(.7, 5);
    expect(bay.width - SUBJECT2_VEHICLE.width).toBeCloseTo(.594, 5);
  });

  it("uses the regulated 3.4 metre side-parking lane and minimum edge lengths", () => {
    const scenario = generateSubject2Scenario(32, "side-parking");
    const road = scenario.roadSurfaces.find((surface) => surface.id === "approach-road")!;
    const edgeLengths = road.points.map((point, index) => {
      const next = road.points[(index + 1) % road.points.length];
      return Math.hypot(next.x - point.x, next.y - point.y);
    });
    expect(Math.min(...edgeLengths)).toBeCloseTo(3.4, 5);
    const before = scenario.segments.find((item) => item.id === "road-edge-before")!;
    const after = scenario.segments.find((item) => item.id === "road-edge-after")!;
    expect(Math.hypot(before.bx - before.ax, before.by - before.ay)).toBeGreaterThanOrEqual(4.5);
    expect(Math.hypot(after.bx - after.ax, after.by - after.ay)).toBeGreaterThanOrEqual(1);
  });

  it("models the ramp pole line 0.5 metres beyond the stop control line", () => {
    const scenario = generateSubject2Scenario(33, "ramp");
    const stop = scenario.segments.find((item) => item.id === "stop-line")!;
    const pole = scenario.segments.find((item) => item.id === "pole-line")!;
    expect(Math.hypot(stop.ax - pole.ax, stop.ay - pole.ay)).toBeCloseTo(.5, 5);
    expect(Math.hypot(stop.bx - stop.ax, stop.by - stop.ay)).toBeCloseTo(3.2, 5);
  });

  it("builds the S course from dense smooth boundaries with a 3.5 metre road width", () => {
    const scenario = generateSubject2Scenario(17, "s-curve");
    const edges = scenario.roadMarkings.filter((line) => line.kind === "road-edge");
    expect(edges).toHaveLength(2);
    expect(edges.every((edge) => edge.smooth && edge.points.length > 90)).toBe(true);
    expect(scenario.segments.filter((segment) => segment.kind === "curb").length).toBeGreaterThan(180);
    for (const index of [0, 20, 48, 72, 100]) {
      const width = Math.hypot(edges[0].points[index].x - edges[1].points[index].x, edges[0].points[index].y - edges[1].points[index].y);
      expect(width / scenario.scale).toBeCloseTo(3.5, 4);
    }
  });

  it("uses the GA 1029-2022 7.5 metre outer radius instead of arbitrary S curves", () => {
    const scenario = generateSubject2Scenario(17, "s-curve");
    const radii = scenario.roadMarkings.filter((line) => line.kind === "road-edge").flatMap((edge) =>
      edge.points.slice(1, -1).map((point, index) => circumradius(edge.points[index], point, edge.points[index + 2])))
      .filter(Number.isFinite);
    expect(radii.filter((radius) => Math.abs(radius / scenario.scale - 7.5) < .03).length).toBeGreaterThan(40);
    expect(radii.filter((radius) => Math.abs(radius / scenario.scale - 4) < .03).length).toBeGreaterThan(40);
  });

  it("keeps the fixed right-angle road wider than 3.6 metres and longer than 6.8 metres", () => {
    const scenario = generateSubject2Scenario(29, "right-angle");
    const outer = scenario.segments.find((item) => item.id === "outer-a")!;
    const inner = scenario.segments.find((item) => item.id === "inner-a")!;
    expect(Math.hypot(outer.bx - outer.ax, outer.by - outer.ay)).toBeGreaterThanOrEqual(6.8);
    expect(Math.abs(outer.ay - inner.ay)).toBeCloseTo(3.6, 5);
    expect(scenario.checkpoints).toHaveLength(1);
  });

  it("starts reverse parking from a legal ready-to-reverse pose with one visible bay goal", () => {
    const scenario = generateSubject2Scenario(31, "reverse-parking");
    expect(scenario.checkpoints.map((item) => item.id)).toEqual(["parked"]);
    expect(scenario.checkpoints[0]).toMatchObject({ containmentBayId: "bay", motion: "reverse" });
    expect(scenario.start.heading).toBeCloseTo(0, 5);
    expect(scenario.start.x).toBeGreaterThan(scenario.parkingBays[0].x);
    expect(createSubject2Vehicle(scenario.start).speed).toBe(0);
    const bay = scenario.parkingBays[0];
    const distanceToLine = (id: string) => {
      const line = scenario.segments.find((item) => item.id === id)!;
      const length = Math.hypot(line.bx - line.ax, line.by - line.ay);
      return Math.abs((line.bx - line.ax) * (line.ay - bay.y) - (line.ax - bay.x) * (line.by - line.ay)) / length;
    };
    expect((distanceToLine("left-control-line") - bay.width / 2) / scenario.scale).toBeCloseTo(6.7, 5);
    expect((distanceToLine("right-control-line") - bay.width / 2) / scenario.scale).toBeCloseTo(6.7, 5);
  });

  it("removes artificial middle guides from side parking, S curve and right angle", () => {
    expect(generateSubject2Scenario(1, "side-parking").checkpoints.map((item) => item.id)).toEqual(["parked"]);
    expect(generateSubject2Scenario(1, "s-curve").checkpoints.map((item) => item.id)).toEqual(["exit"]);
    expect(generateSubject2Scenario(1, "right-angle").checkpoints.map((item) => item.id)).toEqual(["exit"]);
  });

  it("never generates a start or target pose with the full vehicle outside or touching a line", () => {
    for (const project of SUBJECT2_PROJECT_ORDER) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const scenario = generateSubject2Scenario(seed, project);
        expect(validateSubject2Scenario(scenario)).toEqual([]);
        const poses = [scenario.start, ...scenario.checkpoints];
        for (const pose of poses) {
          expect(collidesWithCourse(createSubject2Vehicle(pose), scenario.segments), `${project}/${seed}/${"id" in pose ? pose.id : "start"}`).toBe(false);
          expect(isVehicleWithinRoadSurfaces(createSubject2Vehicle(pose), scenario.roadSurfaces), `${project}/${seed}/${"id" in pose ? pose.id : "start"}`).toBe(true);
        }
        for (const checkpoint of scenario.checkpoints.filter((item) => item.containmentBayId)) {
          const bay = scenario.parkingBays.find((item) => item.id === checkpoint.containmentBayId)!;
          expect(isVehicleFullyInsideBay(createSubject2Vehicle(checkpoint), bay), `${project}/${seed}/${checkpoint.id}`).toBe(true);
        }
      }
    }
  });
});
