import type { Point } from "@/simulation/geometry";
import type { Subject2ParkingBay, Subject2RoadSurface, Subject2Segment } from "./subject2-course";
import { SUBJECT2_VEHICLE, type Subject2VehicleState } from "./subject2-vehicle";

export function subject2VehicleCorners(vehicle: Subject2VehicleState): Point[] {
  const forward = { x: Math.cos(vehicle.heading), y: Math.sin(vehicle.heading) };
  const right = { x: -Math.sin(vehicle.heading), y: Math.cos(vehicle.heading) };
  const halfLength = SUBJECT2_VEHICLE.length / 2;
  const halfWidth = SUBJECT2_VEHICLE.width / 2;
  return [
    { x: vehicle.x + forward.x * halfLength + right.x * halfWidth, y: vehicle.y + forward.y * halfLength + right.y * halfWidth },
    { x: vehicle.x + forward.x * halfLength - right.x * halfWidth, y: vehicle.y + forward.y * halfLength - right.y * halfWidth },
    { x: vehicle.x - forward.x * halfLength - right.x * halfWidth, y: vehicle.y - forward.y * halfLength - right.y * halfWidth },
    { x: vehicle.x - forward.x * halfLength + right.x * halfWidth, y: vehicle.y - forward.y * halfLength + right.y * halfWidth },
  ];
}

export function subject2FrontWheelContactPoints(vehicle: Subject2VehicleState): Point[] {
  const forward = { x: Math.cos(vehicle.heading), y: Math.sin(vehicle.heading) };
  const right = { x: -Math.sin(vehicle.heading), y: Math.cos(vehicle.heading) };
  return [-1, 1].map((side) => ({
    x: vehicle.x + forward.x * SUBJECT2_VEHICLE.wheelBase / 2 + right.x * SUBJECT2_VEHICLE.trackWidth / 2 * side,
    y: vehicle.y + forward.y * SUBJECT2_VEHICLE.wheelBase / 2 + right.y * SUBJECT2_VEHICLE.trackWidth / 2 * side,
  }));
}

export function subject2FrontBumperPoint(vehicle: Subject2VehicleState): Point {
  return {
    x: vehicle.x + Math.cos(vehicle.heading) * SUBJECT2_VEHICLE.length / 2,
    y: vehicle.y + Math.sin(vehicle.heading) * SUBJECT2_VEHICLE.length / 2,
  };
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return first * second <= 0 && third * fourth <= 0;
}

function pointInsideConvex(point: Point, polygon: readonly Point[]): boolean {
  const signs = polygon.map((corner, index) => orientation(corner, polygon[(index + 1) % polygon.length], point));
  return signs.every((value) => value >= 0) || signs.every((value) => value <= 0);
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
  const cross = orientation(start, end, point);
  if (Math.abs(cross) > 1e-7) return false;
  return point.x >= Math.min(start.x, end.x) - 1e-7 && point.x <= Math.max(start.x, end.x) + 1e-7
    && point.y >= Math.min(start.y, end.y) - 1e-7 && point.y <= Math.max(start.y, end.y) + 1e-7;
}

function pointInsidePolygon(point: Point, polygon: readonly Point[]): boolean {
  if (polygon.some((corner, index) => pointOnSegment(point, corner, polygon[(index + 1) % polygon.length]))) return true;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const before = polygon[previous];
    if ((current.y > point.y) !== (before.y > point.y)
      && point.x < (before.x - current.x) * (point.y - current.y) / (before.y - current.y) + current.x) inside = !inside;
  }
  return inside;
}

export function isVehicleWithinRoadSurfaces(vehicle: Subject2VehicleState, surfaces: readonly Subject2RoadSurface[]): boolean {
  return subject2VehicleCorners(vehicle).every((corner) => surfaces.some((surface) => pointInsidePolygon(corner, surface.points)));
}

export function collidesWithCourse(vehicle: Subject2VehicleState, segments: readonly Subject2Segment[]): boolean {
  const body = subject2VehicleCorners(vehicle);
  return segments.some((segment) => {
    if (segment.kind === "exam-line") return false;
    const a = { x: segment.ax, y: segment.ay };
    const b = { x: segment.bx, y: segment.by };
    if (pointInsideConvex(a, body) || pointInsideConvex(b, body)) return true;
    return body.some((corner, index) => intersects(corner, body[(index + 1) % body.length], a, b));
  });
}

export function isVehicleFullyInsideBay(vehicle: Subject2VehicleState, bay: Subject2ParkingBay, margin = 0): boolean {
  const cos = Math.cos(-bay.heading);
  const sin = Math.sin(-bay.heading);
  const halfLength = bay.length / 2 - margin;
  const halfWidth = bay.width / 2 - margin;
  return subject2VehicleCorners(vehicle).every((corner) => {
    const dx = corner.x - bay.x;
    const dy = corner.y - bay.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    return Math.abs(localX) <= halfLength + 1e-7 && Math.abs(localY) <= halfWidth + 1e-7;
  });
}
