export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RouteProjection {
  readonly point: Point;
  readonly distance: number;
  readonly signedOffset: number;
  readonly distanceAlong: number;
  readonly totalLength: number;
  readonly heading: number;
  readonly segmentIndex: number;
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function projectOntoRoute(
  point: Point,
  route: readonly Point[],
): RouteProjection {
  if (route.length < 2) {
    throw new Error("A route requires at least two points.");
  }

  const segmentLengths = route.slice(1).map((end, index) =>
    distanceBetween(route[index], end),
  );
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  let distanceBefore = 0;
  let best: RouteProjection | undefined;

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index];
    const end = route[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const rawT =
      lengthSquared === 0
        ? 0
        : ((point.x - start.x) * dx + (point.y - start.y) * dy) /
          lengthSquared;
    const t = Math.min(1, Math.max(0, rawT));
    const projected = { x: start.x + dx * t, y: start.y + dy * t };
    const offsetX = point.x - projected.x;
    const offsetY = point.y - projected.y;
    const distance = Math.hypot(offsetX, offsetY);
    const cross = dx * (point.y - start.y) - dy * (point.x - start.x);
    const candidate: RouteProjection = {
      point: projected,
      distance,
      signedOffset: Math.sign(cross) * distance,
      distanceAlong: distanceBefore + segmentLengths[index] * t,
      totalLength,
      heading: Math.atan2(dy, dx),
      segmentIndex: index,
    };

    if (!best || candidate.distance < best.distance) {
      best = candidate;
    }
    distanceBefore += segmentLengths[index];
  }

  return best as RouteProjection;
}

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
