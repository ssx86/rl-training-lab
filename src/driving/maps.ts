import type { Point } from "@/simulation/geometry";

export interface CircleObstacle extends Point {
  readonly id: string;
  readonly radius: number;
}

export interface DrivingMap {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly roadHalfWidth: number;
  readonly route: readonly Point[];
  readonly obstacles: readonly CircleObstacle[];
  readonly start: Point & { readonly heading: number };
  readonly goalRadius: number;
  readonly checkpointFractions: readonly number[];
  readonly sensorMaxDistance?: number;
  readonly speedToDistanceScale?: number;
  readonly wheelBase?: number;
  readonly collisionRadius?: number;
}

export function createStraightTrainingMap(
  overrides: Partial<DrivingMap> = {},
): DrivingMap {
  return {
    id: "straight-foundations",
    width: 960,
    height: 640,
    roadHalfWidth: 72,
    route: [
      { x: 80, y: 320 },
      { x: 880, y: 320 },
    ],
    obstacles: [],
    start: { x: 80, y: 320, heading: 0 },
    goalRadius: 24,
    checkpointFractions: [0.25, 0.5, 0.75],
    ...overrides,
  };
}

export function createCornerTrainingMap(): DrivingMap {
  return {
    id: "wide-corner",
    width: 960,
    height: 640,
    roadHalfWidth: 70,
    route: [
      { x: 80, y: 500 },
      { x: 430, y: 500 },
      { x: 610, y: 390 },
      { x: 610, y: 150 },
      { x: 880, y: 150 },
    ],
    obstacles: [
      { id: "corner-1", x: 280, y: 485, radius: 18 },
      { id: "corner-2", x: 625, y: 285, radius: 20 },
    ],
    start: { x: 80, y: 500, heading: 0 },
    goalRadius: 26,
    checkpointFractions: [0.2, 0.4, 0.6, 0.8],
  };
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createSeededObstacleMap(seed: number): DrivingMap {
  const random = createSeededRandom(seed);
  const obstacleCount = 2 + Math.floor(random() * 2);
  const obstacles = Array.from({ length: obstacleCount }, (_, index) => ({
    id: `seed-${seed}-obstacle-${index + 1}`,
    x: 280 + index * 210 + (random() - 0.5) * 50,
    y: 320 + (random() - 0.5) * 58,
    radius: 13 + random() * 7,
  }));

  return createStraightTrainingMap({
    id: `seeded-static-${seed}`,
    obstacles,
  });
}
