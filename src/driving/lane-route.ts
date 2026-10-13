import { shortestCityRoute, type CityMap } from "./city-map";
import type { Point } from "@/simulation/geometry";

export function laneCentreOffset(city: CityMap): number {
  return Math.min(1.8, Math.max(1.6, city.roadWidth * 0.24));
}

function rightNormal(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

export function offsetRouteToRightLane(route: readonly Point[], offset: number): Point[] {
  return route.map((point, index) => {
    const previous = index > 0 ? rightNormal(route[index - 1], point) : null;
    const next = index < route.length - 1 ? rightNormal(point, route[index + 1]) : null;
    const normalX = (previous?.x ?? 0) + (next?.x ?? 0);
    const normalY = (previous?.y ?? 0) + (next?.y ?? 0);
    const length = Math.hypot(normalX, normalY);
    const normal = length > 0.001
      ? { x: normalX / length, y: normalY / length }
      : (next ?? previous ?? { x: 0, y: 0 });
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
  });
}

export function createLaneRoute(city: CityMap, from: string, to: string): Point[] {
  return offsetRouteToRightLane(shortestCityRoute(city, from, to), laneCentreOffset(city));
}
