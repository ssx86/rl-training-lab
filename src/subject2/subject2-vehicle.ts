import { normalizeAngle } from "@/simulation/geometry";
import type { Td3ActionCodec } from "@/rl/continuous/td3-agent";

export interface Subject2VehicleState {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly speed: number;
  readonly steer: number;
  readonly longitudinalIntent: number;
  readonly driveDirection: -1 | 0 | 1;
  readonly acceleration: number;
  readonly isBrakeHolding: boolean;
}

export interface Subject2Action {
  readonly steer: number;
  readonly longitudinal: number;
}

export interface Subject2PhysicsContext {
  /** Rise/run ratio, e.g. 0.1 for a 10% grade. */
  readonly grade?: number;
  /** World-space heading that points uphill. */
  readonly uphillHeading?: number;
}

export const SUBJECT2_ACTION_SIZE = 2;
const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
const clampBipolar = (value: number | undefined) => Math.max(-1, Math.min(1, finite(value)));

export const SUBJECT2_ACTION_CODEC: Td3ActionCodec<Subject2Action> = {
  size: SUBJECT2_ACTION_SIZE,
  decode: (values) => ({ steer: clampBipolar(values[0]), longitudinal: clampBipolar(values[1]) }),
  encode: (action) => [clampBipolar(action.steer), clampBipolar(action.longitudinal)],
};

/**
 * Fixed New Santana exam-car geometry in metres. Body length/width/wheelbase
 * describe one vehicle generation; the axle offsets keep the rendered body,
 * wheel contacts, collision rectangle and kinematic reference point aligned.
 */
export const SUBJECT2_VEHICLE = {
  length: 4.473,
  width: 1.706,
  wheelBase: 2.603,
  frontOverhang: .852,
  rearOverhang: 1.018,
  frontAxleToCenter: 1.3845,
  rearAxleToCenter: 1.2185,
  frontTrackWidth: 1.46,
  rearTrackWidth: 1.50,
  timeStep: .1,
  maxSteerRadians: .583,
  maxForwardSpeed: 4,
  maxReverseSpeed: -2.5,
  forwardAcceleration: 2.2,
  reverseAcceleration: 1.7,
  serviceBrakeDeceleration: 6,
  rollingDrag: .45,
  steeringResponsePerSecond: 4,
  gravity: 9.80665,
  longitudinalDeadband: .04,
} as const;

/** Minimum service-brake command for an idling vehicle aligned uphill. */
export function minimumServiceBrakeForStaticHold(grade: number): number {
  const slopePull = SUBJECT2_VEHICLE.gravity * Math.sin(Math.atan(Math.abs(grade)));
  return Math.max(0, Math.min(1, (slopePull - SUBJECT2_VEHICLE.rollingDrag) / SUBJECT2_VEHICLE.serviceBrakeDeceleration));
}

export function createSubject2Vehicle(values: Pick<Subject2VehicleState, "x" | "y" | "heading"> & Partial<Subject2VehicleState>): Subject2VehicleState {
  return {
    speed: 0,
    steer: 0,
    longitudinalIntent: 0,
    driveDirection: 0,
    acceleration: 0,
    isBrakeHolding: false,
    ...values,
  };
}

export function subject2RearAxlePoint(vehicle: Pick<Subject2VehicleState, "x" | "y" | "heading">): { x: number; y: number } {
  return {
    x: vehicle.x - Math.cos(vehicle.heading) * SUBJECT2_VEHICLE.rearAxleToCenter,
    y: vehicle.y - Math.sin(vehicle.heading) * SUBJECT2_VEHICLE.rearAxleToCenter,
  };
}

function approach(current: number, target: number, maximumDelta: number): number {
  return current + Math.max(-maximumDelta, Math.min(maximumDelta, target - current));
}

function directionOf(value: number): -1 | 0 | 1 {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

export function advanceSubject2Vehicle(
  state: Subject2VehicleState,
  action: Subject2Action,
  physics: Subject2PhysicsContext = {},
): Subject2VehicleState {
  const steerCommand = clampBipolar(action.steer);
  const longitudinalIntent = clampBipolar(action.longitudinal);
  const intentDirection = Math.abs(longitudinalIntent) <= SUBJECT2_VEHICLE.longitudinalDeadband
    ? 0
    : directionOf(longitudinalIntent);
  const steer = approach(
    state.steer,
    steerCommand,
    SUBJECT2_VEHICLE.steeringResponsePerSecond * SUBJECT2_VEHICLE.timeStep,
  );

  const wasStopped = Math.abs(state.speed) <= .001;
  let driveDirection: -1 | 0 | 1 = wasStopped ? state.driveDirection : directionOf(state.speed);
  let isBrakeHolding = wasStopped && state.isBrakeHolding;

  if (wasStopped) {
    if (isBrakeHolding) {
      const continuedBrake = intentDirection !== 0
        && directionOf(state.longitudinalIntent) === intentDirection;
      if (intentDirection === 0) {
        driveDirection = 0;
        isBrakeHolding = false;
      }
      else if (!continuedBrake) {
        driveDirection = intentDirection;
        isBrakeHolding = false;
      }
    } else if (intentDirection !== 0) driveDirection = intentDirection;
    else driveDirection = 0;
  }

  const movingDirection = directionOf(state.speed);
  const requestsBrake = !wasStopped && intentDirection !== 0 && intentDirection !== movingDirection;
  const requestsDrive = intentDirection !== 0 && !isBrakeHolding
    && (wasStopped ? intentDirection === driveDirection : intentDirection === movingDirection);
  const driveAcceleration = requestsDrive
    ? intentDirection * Math.abs(longitudinalIntent)
      * (intentDirection > 0 ? SUBJECT2_VEHICLE.forwardAcceleration : SUBJECT2_VEHICLE.reverseAcceleration)
    : 0;
  const brakeCapacity = isBrakeHolding
    ? SUBJECT2_VEHICLE.serviceBrakeDeceleration
    : requestsBrake ? Math.abs(longitudinalIntent) * SUBJECT2_VEHICLE.serviceBrakeDeceleration : 0;

  const grade = Math.max(-.3, Math.min(.3, physics.grade ?? 0));
  const slopeAngle = Math.atan(grade);
  const uphillHeading = physics.uphillHeading ?? state.heading;
  const gradeAcceleration = -SUBJECT2_VEHICLE.gravity * Math.sin(slopeAngle)
    * Math.cos(normalizeAngle(state.heading - uphillHeading));
  const baseAcceleration = driveAcceleration + gradeAcceleration;
  const rollingResistance = requestsDrive ? 0 : SUBJECT2_VEHICLE.rollingDrag;
  const totalResistance = brakeCapacity + rollingResistance;

  let rawSpeed: number;
  if (wasStopped) {
    rawSpeed = Math.abs(baseAcceleration) <= totalResistance
      ? 0
      : (baseAcceleration - Math.sign(baseAcceleration) * totalResistance) * SUBJECT2_VEHICLE.timeStep;
  } else {
    const effectiveAcceleration = baseAcceleration - Math.sign(state.speed) * totalResistance;
    rawSpeed = state.speed + effectiveAcceleration * SUBJECT2_VEHICLE.timeStep;
    if (directionOf(rawSpeed) !== movingDirection) {
      rawSpeed = 0;
      if (requestsBrake) {
        isBrakeHolding = true;
        driveDirection = movingDirection;
      } else driveDirection = 0;
    }
  }

  const speed = Math.max(SUBJECT2_VEHICLE.maxReverseSpeed, Math.min(SUBJECT2_VEHICLE.maxForwardSpeed, rawSpeed));
  if (!wasStopped && speed === 0 && requestsBrake) isBrakeHolding = true;
  if (speed !== 0) {
    isBrakeHolding = false;
    driveDirection = directionOf(speed);
  }
  const acceleration = (speed - state.speed) / SUBJECT2_VEHICLE.timeStep;

  const averageSpeed = (state.speed + speed) / 2;
  const steerAngle = steer * SUBJECT2_VEHICLE.maxSteerRadians;
  const headingDelta = averageSpeed / SUBJECT2_VEHICLE.wheelBase * Math.tan(steerAngle) * SUBJECT2_VEHICLE.timeStep;
  const midpointHeading = state.heading + headingDelta / 2;
  const heading = normalizeAngle(state.heading + headingDelta);
  const rearAxle = subject2RearAxlePoint(state);
  const rearX = rearAxle.x + Math.cos(midpointHeading) * averageSpeed * SUBJECT2_VEHICLE.timeStep;
  const rearY = rearAxle.y + Math.sin(midpointHeading) * averageSpeed * SUBJECT2_VEHICLE.timeStep;

  return {
    x: rearX + Math.cos(heading) * SUBJECT2_VEHICLE.rearAxleToCenter,
    y: rearY + Math.sin(heading) * SUBJECT2_VEHICLE.rearAxleToCenter,
    heading,
    speed,
    steer,
    longitudinalIntent,
    driveDirection,
    acceleration,
    isBrakeHolding,
  };
}
