import type {
  EnvironmentAdapter,
  EnvironmentStep,
} from "../domain/environment-adapter";
import {
  distanceBetween,
  normalizeAngle,
  projectOntoRoute,
} from "@/simulation/geometry";
import type { DrivingMap } from "./maps";
import { calculateDrivingReward, sumReward } from "./reward";
import { senseDistances } from "./sensors";
import {
  createDrivingObservation,
  DRIVING_SCHEMA_VERSION,
  getDrivingAction,
} from "./types";
import type { DrivingObservation } from "./types";
import {
  advanceVehicle,
  createVehicleState,
  VEHICLE_CONFIG,
} from "./vehicle-model";
import type { VehicleState } from "./vehicle-model";

export type DrivingEvent =
  | "step"
  | "checkpoint"
  | "goal"
  | "collision"
  | "off-road"
  | "timeout"
  | "stalled";

export class DrivingEnvironment
  implements EnvironmentAdapter<DrivingObservation, number, DrivingEvent>
{
  readonly id: string;
  readonly schemaVersion = DRIVING_SCHEMA_VERSION;
  private vehicle: VehicleState;
  private observation: DrivingObservation;
  private stepIndex = 0;
  private offRoadSteps = 0;
  private nextCheckpointIndex = 0;
  private previousProgress = 0;
  private stalledSteps = 0;
  private terminal = false;

  constructor(private readonly map: DrivingMap) {
    this.id = map.id;
    this.vehicle = this.createStartState();
    this.observation = this.observe();
  }

  reset(seed?: number): DrivingObservation {
    void seed;
    this.vehicle = this.createStartState();
    this.stepIndex = 0;
    this.offRoadSteps = 0;
    this.nextCheckpointIndex = 0;
    this.previousProgress = 0;
    this.stalledSteps = 0;
    this.terminal = false;
    this.observation = this.observe();
    return this.observation;
  }

  step(actionId: number): EnvironmentStep<DrivingObservation, number, DrivingEvent> {
    if (this.terminal) {
      throw new Error("Episode has ended. Call reset() before stepping again.");
    }
    const previousObservation = this.observation;
    const previousSteer = this.vehicle.steer;
    const action = getDrivingAction(actionId);
    this.vehicle = advanceVehicle(this.vehicle, action, {
      speedToDistanceScale: this.map.speedToDistanceScale,
      wheelBase: this.map.wheelBase,
    });
    this.stepIndex += 1;

    const projection = projectOntoRoute(this.vehicle, this.map.route);
    const progress = projection.distanceAlong / projection.totalLength;
    const progressDelta = progress - this.previousProgress;
    this.previousProgress = Math.max(this.previousProgress, progress);
    this.stalledSteps = Math.abs(progressDelta) < 0.0001 && this.vehicle.speed < 1
      ? this.stalledSteps + 1
      : 0;
    const stalled = this.stalledSteps >= 80;
    const offRoad = projection.distance > this.map.roadHalfWidth;
    this.offRoadSteps = offRoad ? this.offRoadSteps + 1 : 0;
    const collision = this.map.obstacles.some(
      (obstacle) =>
        distanceBetween(this.vehicle, obstacle) <=
        obstacle.radius + (this.map.collisionRadius ?? VEHICLE_CONFIG.collisionRadius),
    );
    const goal = this.map.route[this.map.route.length - 1];
    const reachedGoal = distanceBetween(this.vehicle, goal) <= this.map.goalRadius;
    const checkpointFraction =
      this.map.checkpointFractions[this.nextCheckpointIndex];
    const checkpointPassed =
      checkpointFraction !== undefined && progress >= checkpointFraction;
    if (checkpointPassed) {
      this.nextCheckpointIndex += 1;
    }

    this.observation = this.observe();
    const rewardBreakdown = calculateDrivingReward({
      progressDelta: progressDelta * 30,
      checkpointPassed,
      reachedGoal,
      normalizedOffset: projection.signedOffset / this.map.roadHalfWidth,
      nearestSensor: Math.min(
        this.observation.lidarFarLeft,
        this.observation.lidarLeft,
        this.observation.lidarFront,
        this.observation.lidarRight,
        this.observation.lidarFarRight,
      ),
      steerDelta: action.steer - previousSteer,
      speed: this.vehicle.speed,
      offRoad,
      offRoadTerminal: this.offRoadSteps >= 8,
      collision,
      stalled,
    });

    const event: DrivingEvent = collision
      ? "collision"
      : reachedGoal
        ? "goal"
        : this.offRoadSteps >= 8
          ? "off-road"
          : stalled
            ? "stalled"
          : this.stepIndex >= 600
            ? "timeout"
            : checkpointPassed
              ? "checkpoint"
              : "step";
    this.terminal = event !== "step" && event !== "checkpoint";

    return {
      observation: previousObservation,
      action: actionId,
      reward: sumReward(rewardBreakdown),
      nextObservation: this.observation,
      done: this.terminal,
      event,
      rewardBreakdown,
      stepIndex: this.stepIndex,
    };
  }

  snapshot(): VehicleState {
    return { ...this.vehicle };
  }

  private createStartState(): VehicleState {
    return createVehicleState(this.map.start);
  }

  private observe(): DrivingObservation {
    const projection = projectOntoRoute(this.vehicle, this.map.route);
    const sensors = senseDistances(this.vehicle, this.map);
    const headingError = normalizeAngle(this.vehicle.heading - projection.heading);
    return createDrivingObservation({
      lidarFarLeft: sensors[0],
      lidarLeft: sensors[1],
      lidarFront: sensors[2],
      lidarRight: sensors[3],
      lidarFarRight: sensors[4],
      speed: this.vehicle.speed / VEHICLE_CONFIG.maxForwardSpeed,
      headingSin: Math.sin(headingError),
      headingCos: Math.cos(headingError),
      lateralOffset: projection.signedOffset / this.map.roadHalfWidth,
      routeProgress: projection.distanceAlong / projection.totalLength,
      previousSteer: this.vehicle.steer,
      previousAcceleration: this.vehicle.acceleration,
    });
  }
}
