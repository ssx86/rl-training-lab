import { DrivingEnvironment, type DrivingEvent } from "./driving-environment";
import { distanceBetween, projectOntoRoute } from "@/simulation/geometry";
import { createSeededObstacleMap, type DrivingMap } from "./maps";
import { SENSOR_MAX_DISTANCE } from "./sensors";
import type { DrivingObservation } from "./types";
import type { VehicleState } from "./vehicle-model";

export type EvaluationPolicy = (
  observation: DrivingObservation,
  vehicle: VehicleState,
) => number;

export interface EvaluationEpisode {
  readonly seed: number;
  readonly outcome: DrivingEvent;
  readonly steps: number;
  readonly totalReward: number;
  readonly routeEfficiency: number | null;
  readonly minSafetyDistance: number;
  readonly stagnant: boolean;
}

export interface EvaluationMetrics {
  readonly sampleCount: number;
  readonly successRate: number;
  readonly collisionRate: number;
  readonly offRoadRate: number;
  readonly stagnantRate: number;
  readonly medianRouteEfficiency: number | null;
  readonly minSafetyDistance: number;
  readonly episodes: EvaluationEpisode[];
}

export interface EvaluationReport {
  readonly fixed: EvaluationMetrics;
  readonly unseen: EvaluationMetrics;
}

interface EvaluationOptions {
  readonly fixedSeeds: readonly number[];
  readonly unseenSeeds: readonly number[];
  readonly createPolicy: (map: DrivingMap) => EvaluationPolicy;
}

function nearestSensor(observation: DrivingObservation): number {
  return Math.min(
    observation.lidarFarLeft,
    observation.lidarLeft,
    observation.lidarFront,
    observation.lidarRight,
    observation.lidarFarRight,
  );
}

function evaluateEpisode(
  seed: number,
  createPolicy: (map: DrivingMap) => EvaluationPolicy,
): EvaluationEpisode {
  const map = createSeededObstacleMap(seed);
  const environment = new DrivingEnvironment(map);
  const policy = createPolicy(map);
  let observation = environment.reset(seed);
  let vehicle = environment.snapshot();
  let pathLength = 0;
  let totalReward = 0;
  let minSafetyDistance = nearestSensor(observation) * SENSOR_MAX_DISTANCE;
  let outcome: DrivingEvent = "timeout";
  let steps = 0;

  for (let index = 0; index < 600; index += 1) {
    const previousVehicle = vehicle;
    const transition = environment.step(policy(observation, vehicle));
    observation = transition.nextObservation;
    vehicle = environment.snapshot();
    pathLength += distanceBetween(previousVehicle, vehicle);
    totalReward += transition.reward;
    minSafetyDistance = Math.min(
      minSafetyDistance,
      nearestSensor(observation) * SENSOR_MAX_DISTANCE,
    );
    steps = index + 1;
    if (transition.done) {
      outcome = transition.event;
      break;
    }
  }

  const routeLength = projectOntoRoute(map.start, map.route).totalLength;
  const reachedGoal = outcome === "goal";
  return {
    seed,
    outcome,
    steps,
    totalReward,
    routeEfficiency: reachedGoal ? pathLength / routeLength : null,
    minSafetyDistance,
    stagnant: !reachedGoal && observation.routeProgress < 0.1,
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function summarize(episodes: EvaluationEpisode[]): EvaluationMetrics {
  const count = episodes.length;
  if (count === 0) throw new RangeError("Evaluation requires at least one seed.");
  const success = episodes.filter((episode) => episode.outcome === "goal");
  return {
    sampleCount: count,
    successRate: success.length / count,
    collisionRate:
      episodes.filter((episode) => episode.outcome === "collision").length / count,
    offRoadRate:
      episodes.filter((episode) => episode.outcome === "off-road").length / count,
    stagnantRate: episodes.filter((episode) => episode.stagnant).length / count,
    medianRouteEfficiency: median(
      success.flatMap((episode) =>
        episode.routeEfficiency === null ? [] : [episode.routeEfficiency],
      ),
    ),
    minSafetyDistance: Math.min(
      ...episodes.map((episode) => episode.minSafetyDistance),
    ),
    episodes,
  };
}

export function evaluateDrivingPolicy(options: EvaluationOptions): EvaluationReport {
  return {
    fixed: summarize(
      options.fixedSeeds.map((seed) => evaluateEpisode(seed, options.createPolicy)),
    ),
    unseen: summarize(
      options.unseenSeeds.map((seed) => evaluateEpisode(seed, options.createPolicy)),
    ),
  };
}
