import { shortestCityRoute, type CityMap } from "./city-map";
import { projectOntoRoute, type Point } from "@/simulation/geometry";
import type { VehicleState } from "./vehicle-model";

export interface ScreenPoint extends Point {
  readonly forwardMeters: number;
}

export interface DriverRoadProjection {
  readonly center: readonly ScreenPoint[];
  readonly left: readonly ScreenPoint[];
  readonly right: readonly ScreenPoint[];
}

interface ProjectionOptions {
  readonly width: number;
  readonly height: number;
  readonly horizon: number;
  readonly nearMeters: number;
  readonly farMeters: number;
  readonly focalLength: number;
}

function routeLengths(route: readonly Point[]) {
  const cumulative = [0];
  for (let index = 1; index < route.length; index += 1) {
    cumulative.push(cumulative[index - 1] + Math.hypot(route[index].x - route[index - 1].x, route[index].y - route[index - 1].y));
  }
  return cumulative;
}

function sampleRoute(route: readonly Point[], cumulative: readonly number[], distance: number) {
  const finalIndex = cumulative.length - 1;
  if (distance >= cumulative[finalIndex]) {
    const a = route[Math.max(0, finalIndex - 1)];
    const b = route[finalIndex];
    return { point: b, heading: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  let index = 0;
  while (index < finalIndex - 1 && cumulative[index + 1] < distance) index += 1;
  const a = route[index]; const b = route[index + 1];
  const segmentLength = Math.max(0.001, cumulative[index + 1] - cumulative[index]);
  const t = Math.max(0, Math.min(1, (distance - cumulative[index]) / segmentLength));
  return {
    point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
    heading: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

function projectPoint(point: Point, vehicle: VehicleState, options: ProjectionOptions): ScreenPoint | null {
  const dx = point.x - vehicle.x; const dy = point.y - vehicle.y;
  const forward = Math.cos(vehicle.heading) * dx + Math.sin(vehicle.heading) * dy;
  const lateral = -Math.sin(vehicle.heading) * dx + Math.cos(vehicle.heading) * dy;
  if (forward < options.nearMeters * .7 || forward > options.farMeters || Math.abs(lateral / forward) > 1.8) return null;
  return {
    x: options.width / 2 + (lateral / forward) * options.focalLength,
    y: options.horizon + (options.nearMeters / forward) * (options.height - options.horizon),
    forwardMeters: forward,
  };
}

export function buildDriverRoadProjection(
  city: CityMap,
  vehicle: VehicleState,
  startNodeId: string,
  destinationNodeId: string,
  options: ProjectionOptions,
): DriverRoadProjection {
  const route = shortestCityRoute(city, startNodeId, destinationNodeId);
  const cumulative = routeLengths(route);
  const currentDistance = projectOntoRoute(vehicle, route).distanceAlong;
  const samples = Array.from(
    { length: Math.ceil((options.farMeters - options.nearMeters) / 4) + 1 },
    (_, index) => sampleRoute(route, cumulative, currentDistance + options.nearMeters + index * 4),
  );
  const halfWidth = city.roadWidth / 2;
  const center: ScreenPoint[] = []; const left: ScreenPoint[] = []; const right: ScreenPoint[] = [];
  for (const sample of samples) {
    const normal = { x: -Math.sin(sample.heading), y: Math.cos(sample.heading) };
    const projectedCenter = projectPoint(sample.point, vehicle, options);
    const projectedLeft = projectPoint({ x: sample.point.x + normal.x * halfWidth, y: sample.point.y + normal.y * halfWidth }, vehicle, options);
    const projectedRight = projectPoint({ x: sample.point.x - normal.x * halfWidth, y: sample.point.y - normal.y * halfWidth }, vehicle, options);
    if (projectedCenter && projectedLeft && projectedRight) {
      center.push(projectedCenter); left.push(projectedLeft); right.push(projectedRight);
    }
  }
  return { center, left, right };
}
