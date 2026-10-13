import type { CityMap } from "./city-map";
import { normalizeAngle, projectOntoRoute } from "@/simulation/geometry";
import type { DrivingMap } from "./maps";
import {
  RADAR_BEAM_COUNT,
  RADAR_CHANNELS,
  type RadarChannel,
} from "./continuous-control";
import type { VehicleState } from "./vehicle-model";

export const RADAR_FOV_RADIANS = Math.PI;
export const RADAR_MAX_DISTANCE = 32;

export interface RadarBeam {
  readonly angle: number;
  readonly distances: Readonly<Record<RadarChannel, number>>;
}

export interface RadarDetection {
  readonly id: string;
  readonly channel: Exclude<RadarChannel, "road-edge">;
  readonly label: string;
  readonly distanceMeters: number;
  readonly bearingRadians: number;
}

export interface RadarScan {
  readonly beams: readonly RadarBeam[];
  readonly detections: readonly RadarDetection[];
}

export interface RadarInput {
  readonly vehicle: VehicleState;
  readonly routeMap: DrivingMap;
  readonly city: CityMap;
  readonly otherVehicles: readonly { id: string; label: string; vehicle: VehicleState }[];
  readonly destinationNodeId: string;
}

interface RadarTarget {
  id: string;
  label: string;
  channel: Exclude<RadarChannel, "road-edge">;
  x: number;
  y: number;
  radius: number;
}

function rayCircleDistance(
  origin: { x: number; y: number },
  angle: number,
  target: { x: number; y: number; radius: number },
): number | null {
  const dx = Math.cos(angle); const dy = Math.sin(angle);
  const offsetX = target.x - origin.x; const offsetY = target.y - origin.y;
  const projection = offsetX * dx + offsetY * dy;
  if (projection < 0) return null;
  const perpendicularSquared = offsetX * offsetX + offsetY * offsetY - projection * projection;
  const radiusSquared = target.radius * target.radius;
  if (perpendicularSquared > radiusSquared) return null;
  return Math.max(0, projection - Math.sqrt(radiusSquared - perpendicularSquared));
}

function roadEdgeDistance(vehicle: VehicleState, routeMap: DrivingMap, angle: number): number {
  for (let distance = .5; distance <= RADAR_MAX_DISTANCE; distance += .5) {
    const point = {
      x: vehicle.x + Math.cos(angle) * distance,
      y: vehicle.y + Math.sin(angle) * distance,
    };
    if (projectOntoRoute(point, routeMap.route).distance > routeMap.roadHalfWidth) return distance;
  }
  return RADAR_MAX_DISTANCE;
}

function targets(input: RadarInput): RadarTarget[] {
  const destination = input.city.nodes.find((node) => node.id === input.destinationNodeId);
  return [
    ...input.city.objects
      .filter((object) => object.kind === "building" || object.kind === "barrier" || object.kind === "tree")
      .map((object) => ({
        id: object.id,
        label: object.kind === "building" ? "建筑" : object.kind === "barrier" ? "路障" : "树木",
        channel: "structure" as const,
        x: object.x,
        y: object.y,
        radius: Math.max(1, object.size),
      })),
    ...input.otherVehicles.map((actor) => ({
      id: actor.id,
      label: actor.label,
      channel: "vehicle" as const,
      x: actor.vehicle.x,
      y: actor.vehicle.y,
      radius: 1.7,
    })),
    ...(destination ? [{
      id: destination.id,
      label: destination.label,
      channel: "destination" as const,
      x: destination.x,
      y: destination.y,
      radius: 3,
    }] : []),
  ];
}

export function scanForwardRadar(input: RadarInput): RadarScan {
  const radarTargets = targets(input);
  const beams = Array.from({ length: RADAR_BEAM_COUNT }, (_, index): RadarBeam => {
    const relativeAngle = -RADAR_FOV_RADIANS / 2 + index * RADAR_FOV_RADIANS / (RADAR_BEAM_COUNT - 1);
    const worldAngle = input.vehicle.heading + relativeAngle;
    const distances: Record<RadarChannel, number> = {
      "road-edge": roadEdgeDistance(input.vehicle, input.routeMap, worldAngle) / RADAR_MAX_DISTANCE,
      vehicle: 1,
      structure: 1,
      destination: 1,
    };
    for (const target of radarTargets) {
      const distance = rayCircleDistance(input.vehicle, worldAngle, target);
      if (distance !== null && distance <= RADAR_MAX_DISTANCE) {
        distances[target.channel] = Math.min(distances[target.channel], distance / RADAR_MAX_DISTANCE);
      }
    }
    return { angle: relativeAngle, distances };
  });

  const detections = radarTargets.flatMap((target): RadarDetection[] => {
    const dx = target.x - input.vehicle.x; const dy = target.y - input.vehicle.y;
    const distanceMeters = Math.hypot(dx, dy);
    const bearingRadians = normalizeAngle(Math.atan2(dy, dx) - input.vehicle.heading);
    if (distanceMeters > RADAR_MAX_DISTANCE || Math.abs(bearingRadians) > RADAR_FOV_RADIANS / 2) return [];
    return [{ id: target.id, channel: target.channel, label: target.label, distanceMeters, bearingRadians }];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { beams, detections };
}

export function radarToVector(scan: RadarScan): number[] {
  return scan.beams.flatMap((beam) => RADAR_CHANNELS.map((channel) => beam.distances[channel]));
}
