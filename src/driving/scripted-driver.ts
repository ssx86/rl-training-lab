import type { DrivingObservation } from "./types";
import { normalizeAngle, type Point } from "@/simulation/geometry";
import type { DrivingMap } from "./maps";
import type { VehicleState } from "./vehicle-model";

const LEFT_ACCELERATE = 2;
const STRAIGHT_ACCELERATE = 5;
const RIGHT_ACCELERATE = 8;
const LEFT_COAST = 1;
const RIGHT_COAST = 7;
const LEFT_BRAKE = 0;
const RIGHT_BRAKE = 6;

export function chooseScriptedAction(observation: DrivingObservation): number {
  const leftClearance = observation.lidarFarLeft + observation.lidarLeft;
  const rightClearance = observation.lidarRight + observation.lidarFarRight;
  const nearestLeft = Math.min(observation.lidarFarLeft, observation.lidarLeft);
  const nearestRight = Math.min(observation.lidarRight, observation.lidarFarRight);

  if (observation.lidarFront < 0.32 || Math.min(nearestLeft, nearestRight) < 0.22) {
    return leftClearance >= rightClearance ? LEFT_BRAKE : RIGHT_BRAKE;
  }
  if (observation.lidarFront < 0.65 || nearestLeft < 0.38 || nearestRight < 0.38) {
    return leftClearance >= rightClearance ? LEFT_COAST : RIGHT_COAST;
  }
  if (observation.lateralOffset < -0.2 || observation.headingSin < -0.16) {
    return RIGHT_ACCELERATE;
  }
  if (observation.lateralOffset > 0.2 || observation.headingSin > 0.16) {
    return LEFT_ACCELERATE;
  }
  return STRAIGHT_ACCELERATE;
}

export class ScriptedDriver {
  private readonly waypoints: Point[];
  private waypointIndex = 0;

  constructor(map: DrivingMap) {
    const sortedObstacles = [...map.obstacles].sort((a, b) => a.x - b.x);
    this.waypoints = sortedObstacles.flatMap((obstacle, index) => {
      const routeCenter = map.route[0].y;
      const direction = obstacle.y <= routeCenter ? 1 : -1;
      const bypassY =
        routeCenter + direction * Math.min(map.roadHalfWidth - 14, obstacle.radius + 28);
      const spread = 48 + index * 2;
      return [
        { x: obstacle.x - spread, y: bypassY },
        { x: obstacle.x + spread, y: bypassY },
      ];
    });
    this.waypoints.push(map.route[map.route.length - 1]);
  }

  chooseAction(
    observation: DrivingObservation,
    vehicle: VehicleState,
  ): number {
    let target = this.waypoints[this.waypointIndex];
    while (
      this.waypointIndex < this.waypoints.length - 1 &&
      Math.hypot(target.x - vehicle.x, target.y - vehicle.y) < 24
    ) {
      this.waypointIndex += 1;
      target = this.waypoints[this.waypointIndex];
    }

    const desiredHeading = Math.atan2(target.y - vehicle.y, target.x - vehicle.x);
    const headingError = normalizeAngle(desiredHeading - vehicle.heading);
    const steer = headingError < -0.05 ? -1 : headingError > 0.05 ? 1 : 0;
    const acceleration =
      Math.abs(headingError) > 0.25 && observation.speed > 0.35 ? -1 : 1;
    return (steer + 1) * 3 + (acceleration + 1);
  }
}
