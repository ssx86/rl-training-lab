import { describe, expect, it } from "vitest";
import { normalizeAngle } from "@/simulation/geometry";
import { collidesWithCourse, isVehicleFullyInsideBay, isVehicleWithinRoadSurfaces } from "./subject2-collision";
import { generateSubject2Scenario } from "./subject2-scenario";
import { createSubject2Vehicle, SUBJECT2_VEHICLE, type Subject2VehicleState } from "./subject2-vehicle";

function reverseMicroStep(vehicle: Subject2VehicleState, steer: number, distance = -.02): Subject2VehicleState {
  const steerAngle = steer * SUBJECT2_VEHICLE.maxSteerRadians;
  const headingDelta = distance / SUBJECT2_VEHICLE.wheelBase * Math.tan(steerAngle);
  const midpointHeading = vehicle.heading + headingDelta / 2;
  return {
    ...vehicle,
    x: vehicle.x + Math.cos(midpointHeading) * distance,
    y: vehicle.y + Math.sin(midpointHeading) * distance,
    heading: normalizeAngle(vehicle.heading + headingDelta),
    speed: -1,
    steer,
    throttle: -1,
  };
}

function reverseCommand(vehicle: Subject2VehicleState, command: number): { vehicle: Subject2VehicleState; poses: Subject2VehicleState[] } {
  const maximumSteerChange = SUBJECT2_VEHICLE.steeringResponsePerSecond * SUBJECT2_VEHICLE.timeStep;
  const appliedSteer = vehicle.steer + Math.max(-maximumSteerChange, Math.min(maximumSteerChange, command - vehicle.steer));
  const poses: Subject2VehicleState[] = [];
  for (let micro = 0; micro < 5; micro += 1) {
    vehicle = reverseMicroStep(vehicle, appliedSteer);
    poses.push(vehicle);
  }
  return { vehicle, poses };
}

describe("reverse parking geometric feasibility", () => {
  it("replays a continuous reverse path from the right control area into the bay without touching a line", () => {
    const scenario = generateSubject2Scenario(1, "reverse-parking");
    const bay = scenario.parkingBays[0];
    const rightControl = scenario.checkpoints[0];
    const commands = [
      -1, -1, -1, -1, -1, -.5, 0, .5, .5, 1, -1, 1, 1, -1, -1, -1, .5, -1, .5, -1, .5, -1, .5, -1, .5, -1, .5, -1, .5, -1, .5, -1, .5,
      -1, -1, -1, -1, -.5, -.5, -1, -1, -1, -.5, -1, -.5, 0, -1, -1, -.5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -.5, -.5, -1, -1, -1, -1, -1, -1, -1, -.5, -.5, 0, 0, 0, .5, .5, -1, 0, 0, -1, -1, -1, -.5, 0, .5, -1, -1, -.5, -1, -1,
    ] as const;
    let vehicle = createSubject2Vehicle({ x: rightControl.x + .05, y: rightControl.y, heading: rightControl.heading });

    for (const [commandIndex, command] of commands.entries()) {
      const result = reverseCommand(vehicle, command);
      expect(result.poses.some((pose) => collidesWithCourse(pose, scenario.segments)), `collision during command ${commandIndex}`).toBe(false);
      expect(result.poses.every((pose) => isVehicleWithinRoadSurfaces(pose, scenario.roadSurfaces)), `left course during command ${commandIndex}`).toBe(true);
      vehicle = result.vehicle;
    }

    expect(Math.abs(normalizeAngle(vehicle.heading - bay.heading))).toBeLessThan(.08);
    expect(isVehicleFullyInsideBay(vehicle, bay)).toBe(true);
  });
});
