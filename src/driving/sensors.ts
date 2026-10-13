import { distanceBetween, projectOntoRoute } from "@/simulation/geometry";
import type { DrivingMap } from "./maps";
import type { VehicleState } from "./vehicle-model";

export const SENSOR_ANGLES = [
  -Math.PI / 3,
  -Math.PI / 6,
  0,
  Math.PI / 6,
  Math.PI / 3,
] as const;

export const SENSOR_MAX_DISTANCE = 160;
// The realistic city runtime uses metres. Its shorter range exposes the next
// decision point without letting the policy see through several city blocks.
export const URBAN_SENSOR_MAX_DISTANCE = 24;

function pointIsClear(x: number, y: number, map: DrivingMap): boolean {
  if (projectOntoRoute({ x, y }, map.route).distance > map.roadHalfWidth) {
    return false;
  }
  return map.obstacles.every(
    (obstacle) => distanceBetween({ x, y }, obstacle) > obstacle.radius,
  );
}

export function senseDistances(
  vehicle: VehicleState,
  map: DrivingMap,
): [number, number, number, number, number] {
  const maxDistance = map.sensorMaxDistance ?? SENSOR_MAX_DISTANCE;
  const rayStep = maxDistance <= 64 ? 0.5 : 2;
  return SENSOR_ANGLES.map((relativeAngle) => {
    const angle = vehicle.heading + relativeAngle;
    for (let distance = 0; distance <= maxDistance; distance += rayStep) {
      const x = vehicle.x + Math.cos(angle) * distance;
      const y = vehicle.y + Math.sin(angle) * distance;
      if (!pointIsClear(x, y, map)) {
        return distance / maxDistance;
      }
    }
    return 1;
  }) as [number, number, number, number, number];
}
