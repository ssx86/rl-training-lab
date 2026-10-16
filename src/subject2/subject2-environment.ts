import { distanceBetween, normalizeAngle } from "@/simulation/geometry";
import { SUBJECT2_PROJECT_ORDER, type Subject2PoseCheckpoint, type Subject2Scenario } from "./subject2-course";
import { collidesWithCourse, isVehicleFullyInsideBay, isVehicleWithinRoadSurfaces, subject2FrontBumperPoint, vehicleBayOverlapRatio } from "./subject2-collision";
import { generateSubject2Scenario } from "./subject2-scenario";
import { senseSubject2Course, SUBJECT2_SENSOR_RANGE, type Subject2Scan } from "./subject2-sensors";
import { advanceSubject2Vehicle, createSubject2Vehicle, SUBJECT2_VEHICLE, type Subject2Action, type Subject2VehicleState } from "./subject2-vehicle";
import { calculateSubject2Reward, type Subject2RewardBreakdown } from "./subject2-reward";
import { SUBJECT2_STANDARD } from "./subject2-standard";

export type { Subject2RewardBreakdown } from "./subject2-reward";

export interface PoseError { readonly distance: number; readonly heading: number; readonly speed: number; readonly total: number }
export interface Subject2Observation {
  readonly vector: readonly number[];
  readonly scan: Subject2Scan;
  readonly targetDistance: number;
  readonly targetBearing: number;
  readonly targetHeadingError: number;
  readonly targetMotion: -1 | 0 | 1;
  readonly localPhaseProgress: number;
  readonly stopLineDistance: number;
  readonly grade: number;
  readonly longitudinalIntent: number;
  readonly isBrakeHolding: boolean;
  readonly longitudinalAcceleration: number;
  readonly holdProgress: number;
  readonly rampPhase: RampTrainingPhase;
  readonly projectEncoding: readonly number[];
  readonly processStageEncoding: readonly number[];
}
export type RampTrainingPhase = "approach" | "braking" | "holding" | "launch" | null;
export type Subject2TerminalReason = "passed" | "collision" | "out-of-bounds" | "rollback" | "start-timeout" | "stalled" | "timeout" | null;
export interface Subject2StepResult {
  readonly vehicle: Subject2VehicleState;
  readonly observation: Subject2Observation;
  readonly checkpointIndex: number;
  readonly checkpointReached: boolean;
  readonly reward: number;
  readonly rewardBreakdown: Subject2RewardBreakdown;
  readonly done: boolean;
  readonly passed: boolean;
  readonly terminalReason: Subject2TerminalReason;
}

export const SUBJECT2_OBSERVATION_SIZE = 57;

export function checkpointPoseError(vehicle: Subject2VehicleState, target: Subject2PoseCheckpoint): PoseError {
  const distance = distanceBetween(vehicle, target);
  const heading = Math.abs(normalizeAngle(target.heading - vehicle.heading));
  const speed = Math.abs(vehicle.speed);
  return { distance, heading, speed, total: distance + heading * 5 + Math.max(0, speed - target.speedMax) * .8 };
}

function motionMatches(vehicle: Subject2VehicleState, target: Subject2PoseCheckpoint, lastMotion: -1 | 0 | 1): boolean {
  if (target.motion === "any") return true;
  if (target.motion === "forward") return vehicle.speed > .05 || (Math.abs(vehicle.speed) <= .05 && lastMotion === 1);
  if (target.motion === "reverse") return vehicle.speed < -.05 || (Math.abs(vehicle.speed) <= .05 && lastMotion === -1);
  return Math.abs(vehicle.speed) <= target.speedMax;
}

function rampStopGeometry(vehicle: Subject2VehicleState, scenario: Subject2Scenario): { inBand: boolean; stopLineDistance: number } {
  if (scenario.project !== "ramp") return { inBand: false, stopLineDistance: 0 };
  const stopLine = scenario.segments.find((segment) => segment.id === "stop-line");
  const poleLine = scenario.segments.find((segment) => segment.id === "pole-line");
  if (!stopLine || !poleLine) return { inBand: false, stopLineDistance: 0 };
  const bumper = subject2FrontBumperPoint(vehicle);
  const lowY = Math.min(stopLine.ay, poleLine.ay);
  const highY = Math.max(stopLine.ay, poleLine.ay);
  return {
    inBand: bumper.y >= lowY - 1e-7 && bumper.y <= highY + 1e-7
      && bumper.x >= Math.min(stopLine.ax, stopLine.bx) && bumper.x <= Math.max(stopLine.ax, stopLine.bx),
    // Positive before the stop line, negative after crossing it toward the pole.
    stopLineDistance: bumper.y - stopLine.ay,
  };
}

export class Subject2Environment {
  private scenario: Subject2Scenario;
  private vehicle: Subject2VehicleState;
  private checkpointIndex = 0;
  private stepCount = 0;
  private lastMotion: -1 | 0 | 1 = 0;
  private previousLongitudinal = 0;
  private rampStartOrigin: { readonly x: number; readonly y: number } | null = null;
  private rampPhase: RampTrainingPhase;
  private rampHoldSteps = 0;
  private rampLaunchSteps = 0;
  private bestProcessError: number;
  private lastProgressStep = 0;
  private readonly maxSteps: number;

  constructor(scenario: Subject2Scenario = generateSubject2Scenario(17), maxSteps = 1_600) {
    this.scenario = scenario;
    this.maxSteps = maxSteps;
    this.vehicle = createSubject2Vehicle(scenario.start);
    this.rampPhase = scenario.project === "ramp" ? "approach" : null;
    this.bestProcessError = checkpointPoseError(this.vehicle, scenario.checkpoints[0]).total;
  }

  reset(scenario: Subject2Scenario = this.scenario): Subject2Observation {
    this.scenario = scenario;
    this.vehicle = createSubject2Vehicle(scenario.start);
    this.checkpointIndex = 0;
    this.stepCount = 0;
    this.lastMotion = 0;
    this.previousLongitudinal = 0;
    this.rampStartOrigin = null;
    this.rampPhase = scenario.project === "ramp" ? "approach" : null;
    this.rampHoldSteps = 0;
    this.rampLaunchSteps = 0;
    this.bestProcessError = checkpointPoseError(this.vehicle, this.currentCheckpoint()).total;
    this.lastProgressStep = 0;
    return this.observe();
  }

  step(action: Subject2Action): Subject2StepResult {
    const processTarget = this.currentCheckpoint();
    const isRampStop = this.scenario.project === "ramp" && processTarget.id === "stop";
    const isFinalCheckpoint = this.checkpointIndex === this.scenario.checkpoints.length - 1;
    const rewardTarget = processTarget;
    const previousError = checkpointPoseError(this.vehicle, rewardTarget);
    const targetBay = processTarget.containmentBayId ? this.scenario.parkingBays.find((item) => item.id === processTarget.containmentBayId) : undefined;
    const previousBayOverlap = targetBay ? vehicleBayOverlapRatio(this.vehicle, targetBay) : 0;
    const previousSteer = this.vehicle.steer;
    const previousLongitudinal = this.previousLongitudinal;
    const physics = this.scenario.project === "ramp"
      ? { grade: SUBJECT2_STANDARD.ramp.grade, uphillHeading: -Math.PI / 2 }
      : undefined;
    this.vehicle = advanceSubject2Vehicle(this.vehicle, action, physics);
    this.previousLongitudinal = this.vehicle.longitudinalIntent;
    if (this.vehicle.speed > .05) this.lastMotion = 1;
    else if (this.vehicle.speed < -.05) this.lastMotion = -1;
    this.stepCount += 1;
    const nextError = checkpointPoseError(this.vehicle, rewardTarget);
    const nextBayOverlap = targetBay ? vehicleBayOverlapRatio(this.vehicle, targetBay) : 0;
    const processError = checkpointPoseError(this.vehicle, processTarget);
    if (processError.total < this.bestProcessError - SUBJECT2_STANDARD.training.minimumProgressDelta) {
      this.bestProcessError = processError.total;
      this.lastProgressStep = this.stepCount;
    }
    const bay = targetBay;
    const poseReached = processError.distance <= processTarget.positionTolerance && processError.heading <= processTarget.headingTolerance && processError.speed <= processTarget.speedMax && motionMatches(this.vehicle, processTarget, this.lastMotion);
    const collided = collidesWithCourse(this.vehicle, this.scenario.segments);
    // A pose never counts when any part of the body touches a scored line.
    const genericProcessReached = bay
      ? isVehicleFullyInsideBay(this.vehicle, bay) && motionMatches(this.vehicle, processTarget, this.lastMotion)
      : poseReached;
    const stopGeometry = rampStopGeometry(this.vehicle, this.scenario);
    const validHoldStep = isRampStop && stopGeometry.inBand
      && processError.heading <= processTarget.headingTolerance
      && Math.abs(this.vehicle.speed) <= SUBJECT2_STANDARD.ramp.stopSpeedMax
      && this.vehicle.isBrakeHolding;
    if (isRampStop) {
      if (validHoldStep) {
        this.rampPhase = "holding";
        this.rampHoldSteps += 1;
      } else {
        this.rampHoldSteps = 0;
        this.rampPhase = this.vehicle.isBrakeHolding || stopGeometry.stopLineDistance <= 5 ? "braking" : "approach";
      }
    }
    const requiredHoldSteps = Math.round(SUBJECT2_STANDARD.ramp.holdDurationSeconds / SUBJECT2_VEHICLE.timeStep);
    const processReached = isRampStop ? this.rampHoldSteps >= requiredHoldSteps : genericProcessReached;
    const checkpointReached = !collided && processReached;
    const passed = checkpointReached && isFinalCheckpoint;
    const uphillHeading = -Math.PI / 2;
    const rollbackDistance = this.rampStartOrigin
      ? -((this.vehicle.x - this.rampStartOrigin.x) * Math.cos(uphillHeading) + (this.vehicle.y - this.rampStartOrigin.y) * Math.sin(uphillHeading))
      : 0;
    const rollbackExceeded = !passed && !collided && this.scenario.project === "ramp" && this.checkpointIndex === 1
      && rollbackDistance > SUBJECT2_STANDARD.ramp.rollbackFailDistance
      && isVehicleWithinRoadSurfaces(this.vehicle, this.scenario.roadSurfaces);
    const outOfBounds = !passed && !collided && !isVehicleWithinRoadSurfaces(this.vehicle, this.scenario.roadSurfaces);
    if (this.rampPhase === "launch" && !passed) this.rampLaunchSteps += 1;
    const launchLimitSteps = Math.round(SUBJECT2_STANDARD.ramp.launchTimeLimitSeconds / SUBJECT2_VEHICLE.timeStep);
    const startTimedOut = !passed && !collided && !outOfBounds && !rollbackExceeded
      && this.rampPhase === "launch" && this.rampLaunchSteps >= launchLimitSteps;
    const stationaryAllowed = (isRampStop && stopGeometry.inBand) || this.rampPhase === "launch";
    const noProgressLimitSteps = Math.round(SUBJECT2_STANDARD.training.noProgressLimitSeconds / SUBJECT2_VEHICLE.timeStep);
    const stalled = !passed && !collided && !outOfBounds && !rollbackExceeded && !startTimedOut
      && !stationaryAllowed && this.stepCount - this.lastProgressStep >= noProgressLimitSteps;
    const timedOut = this.stepCount >= this.maxSteps;
    const done = passed || collided || outOfBounds || rollbackExceeded || startTimedOut || stalled || timedOut;
    const minimumClearance = Math.min(...senseSubject2Course(this.vehicle, this.scenario.segments).beams.map((beam) => beam.distanceMeters));
    const rewardBreakdown = calculateSubject2Reward({
      previousError, nextError, target: processTarget, speed: this.vehicle.speed,
      steerChange: this.vehicle.steer - previousSteer,
      longitudinalChange: this.vehicle.longitudinalIntent - previousLongitudinal,
      minimumClearance, checkpointReached, isFinalCheckpoint, shapePoseProgress: true,
      useBayShaping: Boolean(targetBay), allowOppositeMotionAdjustment: Boolean(targetBay),
      previousBayOverlap, nextBayOverlap,
      collided, outOfBounds, rollbackExceeded, requiredHold: stationaryAllowed,
      validHoldStep, startTimedOut, stalled, timedOut,
    });
    if (checkpointReached && !isFinalCheckpoint) {
      if (isRampStop) {
        this.rampStartOrigin = { x: this.vehicle.x, y: this.vehicle.y };
        this.rampPhase = "launch";
        this.rampLaunchSteps = 0;
      }
      this.checkpointIndex += 1;
      this.bestProcessError = checkpointPoseError(this.vehicle, this.currentCheckpoint()).total;
      this.lastProgressStep = this.stepCount;
    }
    const reward = rewardBreakdown.total;
    const terminalReason = passed ? "passed" : collided ? "collision" : outOfBounds ? "out-of-bounds" : rollbackExceeded ? "rollback" : startTimedOut ? "start-timeout" : stalled ? "stalled" : timedOut ? "timeout" : null;
    return { vehicle: this.vehicle, observation: this.observe(), checkpointIndex: this.checkpointIndex, checkpointReached, reward, rewardBreakdown, done, passed, terminalReason };
  }

  observe(): Subject2Observation {
    const target = this.currentGoal();
    const processTarget = this.currentCheckpoint();
    const dx = target.x - this.vehicle.x;
    const dy = target.y - this.vehicle.y;
    const targetDistance = Math.hypot(dx, dy);
    const targetBearing = normalizeAngle(Math.atan2(dy, dx) - this.vehicle.heading);
    const targetHeadingError = normalizeAngle(target.heading - this.vehicle.heading);
    const targetMotion: -1 | 0 | 1 = processTarget.motion === "reverse" ? -1 : processTarget.motion === "forward" ? 1 : 0;
    const scan = senseSubject2Course(this.vehicle, this.scenario.segments);
    const localPhaseProgress = this.scenario.checkpoints.length <= 1 ? 0 : this.checkpointIndex / (this.scenario.checkpoints.length - 1);
    const stopLineDistance = rampStopGeometry(this.vehicle, this.scenario).stopLineDistance;
    const grade = this.scenario.project === "ramp" ? SUBJECT2_STANDARD.ramp.grade : 0;
    const requiredHoldSteps = Math.round(SUBJECT2_STANDARD.ramp.holdDurationSeconds / SUBJECT2_VEHICLE.timeStep);
    const holdProgress = this.scenario.project === "ramp" ? Math.min(1, this.rampHoldSteps / requiredHoldSteps) : 0;
    const projectEncoding = SUBJECT2_PROJECT_ORDER.map((project) => project === this.scenario.project ? 1 : 0);
    const processStageEncoding = Array.from({ length: 4 }, (_, index) => index === this.checkpointIndex ? 1 : 0);
    const vector = [
      ...scan.beams.map((beam) => beam.distanceMeters / SUBJECT2_SENSOR_RANGE),
      Math.min(1, targetDistance / Math.hypot(this.scenario.width, this.scenario.height)),
      Math.sin(targetBearing), Math.cos(targetBearing), Math.sin(targetHeadingError), Math.cos(targetHeadingError),
      this.vehicle.speed / SUBJECT2_VEHICLE.maxForwardSpeed, localPhaseProgress, this.vehicle.steer, targetMotion,
      this.vehicle.longitudinalIntent, this.vehicle.driveDirection, this.vehicle.isBrakeHolding ? 1 : 0,
      Math.max(-1, Math.min(1, this.vehicle.acceleration / SUBJECT2_VEHICLE.serviceBrakeDeceleration)),
      Math.max(-1, Math.min(1, stopLineDistance / 20)), grade / .1, holdProgress,
      ...projectEncoding, ...processStageEncoding,
    ];
    if (vector.length !== SUBJECT2_OBSERVATION_SIZE) throw new Error("Subject 2 observation shape changed unexpectedly.");
    return {
      vector, scan, targetDistance, targetBearing, targetHeadingError, targetMotion, localPhaseProgress,
      stopLineDistance, grade, longitudinalIntent: this.vehicle.longitudinalIntent,
      isBrakeHolding: this.vehicle.isBrakeHolding, longitudinalAcceleration: this.vehicle.acceleration,
      holdProgress, rampPhase: this.rampPhase,
      projectEncoding, processStageEncoding,
    };
  }

  snapshot(): Subject2VehicleState { return this.vehicle; }
  currentCheckpoint(): Subject2PoseCheckpoint { return this.scenario.checkpoints[this.checkpointIndex]; }
  currentGoal(): Subject2PoseCheckpoint { return this.scenario.checkpoints[this.scenario.checkpoints.length - 1]; }
  currentCheckpointIndex(): number { return this.checkpointIndex; }
  currentScenario(): Subject2Scenario { return this.scenario; }
  setVehicleForTest(vehicle: Subject2VehicleState): void {
    this.vehicle = vehicle;
    this.lastMotion = vehicle.speed > .05 ? 1 : vehicle.speed < -.05 ? -1 : 0;
    this.bestProcessError = checkpointPoseError(vehicle, this.currentCheckpoint()).total;
    this.lastProgressStep = this.stepCount;
  }
}
