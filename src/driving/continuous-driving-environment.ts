import type { CityMap } from "./city-map";
import {
  clampContinuousAction,
  CONTINUOUS_OBSERVATION_SIZE,
  type ContinuousDrivingAction,
} from "./continuous-control";
import { distanceBetween, normalizeAngle, projectOntoRoute } from "@/simulation/geometry";
import type { DrivingMap } from "./maps";
import { radarToVector, scanForwardRadar, type RadarScan } from "./radar";
import { calculateDrivingReward, sumReward, type DrivingRewardBreakdown } from "./reward";
import type { DrivingEvent } from "./driving-environment";
import { advanceVehicle, createVehicleState, VEHICLE_CONFIG, type VehicleState } from "./vehicle-model";

export interface RadarPeer {
  readonly id: string;
  readonly label: string;
  readonly vehicle: VehicleState;
}

export interface ContinuousDrivingState {
  readonly vector: readonly number[];
  readonly radar: RadarScan;
}

export interface ContinuousDrivingStep {
  readonly observation: ContinuousDrivingState;
  readonly action: ContinuousDrivingAction;
  readonly reward: number;
  readonly rewardBreakdown: DrivingRewardBreakdown;
  readonly nextObservation: ContinuousDrivingState;
  readonly done: boolean;
  readonly event: DrivingEvent;
  readonly stepIndex: number;
}

export class ContinuousDrivingEnvironment {
  private vehicle: VehicleState;
  private state: ContinuousDrivingState;
  private stepIndex = 0;
  private offRoadSteps = 0;
  private nextCheckpointIndex = 0;
  private previousProgress = 0;
  private stalledSteps = 0;
  private terminal = false;

  constructor(
    private readonly map: DrivingMap,
    private readonly city: CityMap,
    private readonly destinationNodeId: string,
  ) {
    this.vehicle = this.createStartState();
    this.state = this.observe([]);
  }

  reset(peers: readonly RadarPeer[] = []): ContinuousDrivingState {
    this.vehicle = this.createStartState();
    this.stepIndex = 0; this.offRoadSteps = 0; this.nextCheckpointIndex = 0;
    this.previousProgress = 0; this.stalledSteps = 0; this.terminal = false;
    this.state = this.observe(peers);
    return this.state;
  }

  step(actionInput: ContinuousDrivingAction, peers: readonly RadarPeer[] = []): ContinuousDrivingStep {
    if (this.terminal) throw new Error("Episode has ended. Call reset() before stepping again.");
    const observation = this.state;
    const previousSteer = this.vehicle.steer;
    const action = clampContinuousAction(actionInput);
    this.vehicle = advanceVehicle(this.vehicle, { steer: action.steer, acceleration: action.throttle }, {
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
    const collision = this.map.obstacles.some((obstacle) =>
      distanceBetween(this.vehicle, obstacle) <= obstacle.radius + (this.map.collisionRadius ?? VEHICLE_CONFIG.collisionRadius));
    const goal = this.map.route[this.map.route.length - 1];
    const reachedGoal = distanceBetween(this.vehicle, goal) <= this.map.goalRadius;
    const checkpointFraction = this.map.checkpointFractions[this.nextCheckpointIndex];
    const checkpointPassed = checkpointFraction !== undefined && progress >= checkpointFraction;
    if (checkpointPassed) this.nextCheckpointIndex += 1;

    this.state = this.observe(peers);
    const nearestRadar = Math.min(...this.state.radar.beams.flatMap((beam) => [
      beam.distances["road-edge"], beam.distances.vehicle, beam.distances.structure,
    ]));
    const rewardBreakdown = calculateDrivingReward({
      progressDelta: progressDelta * 30,
      checkpointPassed, reachedGoal,
      normalizedOffset: projection.signedOffset / this.map.roadHalfWidth,
      nearestSensor: nearestRadar,
      steerDelta: action.steer - previousSteer,
      speed: this.vehicle.speed,
      offRoad, offRoadTerminal: this.offRoadSteps >= 8, collision,
      stalled,
    });
    const event: DrivingEvent = collision ? "collision" : reachedGoal ? "goal" : this.offRoadSteps >= 8
      ? "off-road" : stalled ? "stalled" : this.stepIndex >= 600 ? "timeout" : checkpointPassed ? "checkpoint" : "step";
    this.terminal = event !== "step" && event !== "checkpoint";
    return {
      observation, action, reward: sumReward(rewardBreakdown), rewardBreakdown,
      nextObservation: this.state, done: this.terminal, event, stepIndex: this.stepIndex,
    };
  }

  snapshot(): VehicleState {
    return { ...this.vehicle };
  }

  private createStartState(): VehicleState {
    return createVehicleState(this.map.start);
  }

  private observe(peers: readonly RadarPeer[]): ContinuousDrivingState {
    const projection = projectOntoRoute(this.vehicle, this.map.route);
    const radar = scanForwardRadar({
      vehicle: this.vehicle, routeMap: this.map, city: this.city,
      otherVehicles: peers, destinationNodeId: this.destinationNodeId,
    });
    const destination = this.city.nodes.find((node) => node.id === this.destinationNodeId)!;
    const bearing = normalizeAngle(Math.atan2(destination.y - this.vehicle.y, destination.x - this.vehicle.x) - this.vehicle.heading);
    const headingError = normalizeAngle(this.vehicle.heading - projection.heading);
    const vector = [
      ...radarToVector(radar),
      this.vehicle.speed / VEHICLE_CONFIG.maxForwardSpeed,
      Math.sin(headingError), Math.cos(headingError),
      Math.max(-1, Math.min(1, projection.signedOffset / this.map.roadHalfWidth)),
      projection.distanceAlong / projection.totalLength,
      this.vehicle.steer, this.vehicle.acceleration,
      Math.sin(bearing), Math.cos(bearing),
    ];
    if (vector.length !== CONTINUOUS_OBSERVATION_SIZE) throw new Error("Continuous observation schema mismatch.");
    return { vector, radar };
  }
}
