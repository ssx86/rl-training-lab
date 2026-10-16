import { describe, expect, it } from "vitest";
import { normalizeAngle } from "@/simulation/geometry";
import { collidesWithCourse, isVehicleFullyInsideBay, isVehicleWithinRoadSurfaces, subject2VehicleCorners } from "./subject2-collision";
import type { Subject2Segment } from "./subject2-course";
import { generateSubject2Scenario } from "./subject2-scenario";
import { advanceSubject2Vehicle, createSubject2Vehicle, type Subject2VehicleState } from "./subject2-vehicle";

function reverseCommand(vehicle: Subject2VehicleState, command: number): Subject2VehicleState {
  // Bang-bang speed control keeps this geometric witness near 1 m/s while
  // exercising the production rear-axle integrator and direction lock.
  const longitudinal = vehicle.speed > -1 ? -.25 : .05;
  return advanceSubject2Vehicle(vehicle, { steer: command, longitudinal });
}

function pointToSegmentDistance(point: { x: number; y: number }, segment: Subject2Segment): number {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const denominator = dx * dx + dy * dy;
  const projection = denominator === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - segment.ax) * dx + (point.y - segment.ay) * dy) / denominator));
  return Math.hypot(point.x - (segment.ax + projection * dx), point.y - (segment.ay + projection * dy));
}

function bodyClearance(vehicle: Subject2VehicleState, segments: readonly Subject2Segment[]): number {
  const solidSegments = segments.filter((segment) => segment.kind !== "exam-line");
  return Math.min(...subject2VehicleCorners(vehicle).flatMap((corner) => solidSegments.map((segment) => pointToSegmentDistance(corner, segment))));
}

describe("reverse parking geometric feasibility", () => {
  it("replays a continuous reverse path from the right control area into the bay without touching a line", () => {
    const scenario = generateSubject2Scenario(1, "reverse-parking");
    const bay = scenario.parkingBays[0];
    const commands = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-.5,-.5,0,.5,1,1,-1,1,-1,-1,.5,-1,.5,1,-1,-1,-1,-1,-1,-1,-.5,0,-1,-.5,-.5,-1,-.5,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-.5,0,-1,-1,-.5,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-.5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-.5,-1,-.5,0,.5,-1,.5,-1,.5,-1,.5,0,0,0,.5,1,-1,-1,0,-1] as const;
    let vehicle = createSubject2Vehicle({ ...scenario.start, speed: -1, driveDirection: -1 });
    let minimumClearance = bodyClearance(vehicle, scenario.segments);

    for (const [commandIndex, command] of commands.entries()) {
      vehicle = reverseCommand(vehicle, command);
      minimumClearance = Math.min(minimumClearance, bodyClearance(vehicle, scenario.segments));
      expect(collidesWithCourse(vehicle, scenario.segments), `collision during command ${commandIndex}`).toBe(false);
      expect(isVehicleWithinRoadSurfaces(vehicle, scenario.roadSurfaces), `left course during command ${commandIndex}`).toBe(true);
    }

    expect(Math.abs(normalizeAngle(vehicle.heading - bay.heading))).toBeLessThan(.08);
    expect(isVehicleFullyInsideBay(vehicle, bay)).toBe(true);
    expect(minimumClearance).toBeCloseTo(.0098, 3);
  });
});
