import { normalizeAngle } from "@/simulation/geometry";
import type { Td3ActionCodec } from "@/rl/continuous/td3-agent";

export interface Subject2VehicleState {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly speed: number;
  readonly steer: number;
  readonly throttle: number;
  readonly brake: number;
  readonly gear: -1 | 0 | 1;
  readonly acceleration: number;
  readonly isBrakeHolding: boolean;
}

export interface Subject2Action {
  readonly steer: number;
  readonly throttle: number;
  readonly brake?: number;
  readonly gear?: number;
}

export interface Subject2PhysicsContext {
  /** Rise/run ratio, e.g. 0.1 for a 10% grade. */
  readonly grade?: number;
  /** World-space heading that points uphill. */
  readonly uphillHeading?: number;
}

export const SUBJECT2_ACTION_SIZE = 3;
const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
const clampBipolar = (value: number | undefined) => Math.max(-1, Math.min(1, finite(value)));
const clampUnit = (value: number | undefined, fallback = 0) => Math.max(0, Math.min(1, finite(value, fallback)));

export const SUBJECT2_ACTION_CODEC: Td3ActionCodec<Subject2Action> = {
  size: SUBJECT2_ACTION_SIZE,
  decode: (values) => {
    const longitudinal = clampBipolar(values[1]);
    return {
      steer: clampBipolar(values[0]),
      throttle: Math.max(0, longitudinal),
      brake: Math.max(0, -longitudinal),
      gear: clampBipolar(values[2]),
    };
  },
  encode: (action) => [
    clampBipolar(action.steer), clampUnit(action.throttle) - clampUnit(action.brake), clampBipolar(action.gear),
  ],
};

export const SUBJECT2_VEHICLE = {
  length: 4.473,
  width: 1.706,
  wheelBase: 2.548,
  trackWidth: 1.414,
  timeStep: .1,
  maxSteerRadians: .58,
  maxForwardSpeed: 4,
  maxReverseSpeed: -2.5,
  forwardAcceleration: 2.2,
  reverseAcceleration: 1.7,
  serviceBrakeDeceleration: 6,
  rollingDrag: .45,
  throttleResponsePerSecond: 3,
  brakeResponsePerSecond: 5,
  steeringResponsePerSecond: 4,
  gravity: 9.80665,
} as const;

/** Minimum service-brake command for an idling vehicle aligned uphill. */
export function minimumServiceBrakeForStaticHold(grade: number): number {
  const slopePull = SUBJECT2_VEHICLE.gravity * Math.sin(Math.atan(Math.abs(grade)));
  return Math.max(0, Math.min(1, (slopePull - SUBJECT2_VEHICLE.rollingDrag) / SUBJECT2_VEHICLE.serviceBrakeDeceleration));
}

export function createSubject2Vehicle(values: Pick<Subject2VehicleState, "x" | "y" | "heading"> & Partial<Subject2VehicleState>): Subject2VehicleState {
  return {
    speed: 0, steer: 0, throttle: 0, brake: 0,
    gear: 1, acceleration: 0, isBrakeHolding: false, ...values,
  };
}

function approach(current: number, target: number, maximumDelta: number): number {
  return current + Math.max(-maximumDelta, Math.min(maximumDelta, target - current));
}

export function advanceSubject2Vehicle(state: Subject2VehicleState, action: Subject2Action, physics: Subject2PhysicsContext = {}): Subject2VehicleState {
  const steerCommand = Math.max(-1, Math.min(1, Number.isFinite(action.steer) ? action.steer : 0));
  let throttleCommand = Math.max(0, Math.min(1, Number.isFinite(action.throttle) ? action.throttle : 0));
  const brakeCommand = Math.max(0, Math.min(1, Number.isFinite(action.brake) ? action.brake! : 0));
  // Automatic transmission: accelerator and service brake are one mutually
  // exclusive longitudinal control. Direct callers that request both get
  // brake priority, matching the safer physical interpretation.
  if (brakeCommand > 0) throttleCommand = 0;
  const requestedGear: -1 | 0 | 1 = !Number.isFinite(action.gear) ? state.gear : action.gear! < -.25 ? -1 : action.gear! > .25 ? 1 : 0;
  const steer = approach(state.steer, steerCommand, SUBJECT2_VEHICLE.steeringResponsePerSecond * SUBJECT2_VEHICLE.timeStep);
  let throttle: number;
  let brake: number;
  if (brakeCommand > 0 && state.throttle > 0) {
    throttle = approach(state.throttle, 0, SUBJECT2_VEHICLE.throttleResponsePerSecond * SUBJECT2_VEHICLE.timeStep);
    brake = 0;
  } else if (throttleCommand > 0 && state.brake > 0) {
    brake = approach(state.brake, 0, SUBJECT2_VEHICLE.brakeResponsePerSecond * SUBJECT2_VEHICLE.timeStep);
    throttle = 0;
  } else {
    throttle = approach(state.throttle, throttleCommand, SUBJECT2_VEHICLE.throttleResponsePerSecond * SUBJECT2_VEHICLE.timeStep);
    brake = approach(state.brake, brakeCommand, SUBJECT2_VEHICLE.brakeResponsePerSecond * SUBJECT2_VEHICLE.timeStep);
  }
  const gear = Math.abs(state.speed) <= .15 ? requestedGear : state.gear;
  const driveAcceleration = gear === 0 ? 0 : gear * throttle
    * (gear > 0 ? SUBJECT2_VEHICLE.forwardAcceleration : SUBJECT2_VEHICLE.reverseAcceleration);
  const grade = Math.max(-.3, Math.min(.3, physics.grade ?? 0));
  const slopeAngle = Math.atan(grade);
  const uphillHeading = physics.uphillHeading ?? state.heading;
  const gradeAcceleration = -SUBJECT2_VEHICLE.gravity * Math.sin(slopeAngle) * Math.cos(normalizeAngle(state.heading - uphillHeading));
  const baseAcceleration = driveAcceleration + gradeAcceleration;
  const brakeCapacity = brake * SUBJECT2_VEHICLE.serviceBrakeDeceleration;
  const rollingResistance = throttle < .02 ? SUBJECT2_VEHICLE.rollingDrag : 0;
  const totalResistance = brakeCapacity + rollingResistance;
  let rawSpeed: number;
  if (Math.abs(state.speed) <= .001) {
    rawSpeed = Math.abs(baseAcceleration) <= totalResistance
      ? 0
      : (baseAcceleration - Math.sign(baseAcceleration) * totalResistance) * SUBJECT2_VEHICLE.timeStep;
  } else {
    const effectiveAcceleration = baseAcceleration - Math.sign(state.speed) * totalResistance;
    rawSpeed = state.speed + effectiveAcceleration * SUBJECT2_VEHICLE.timeStep;
    if (Math.sign(rawSpeed) !== Math.sign(state.speed) && totalResistance >= Math.abs(baseAcceleration)) rawSpeed = 0;
  }
  const speed = Math.max(SUBJECT2_VEHICLE.maxReverseSpeed, Math.min(SUBJECT2_VEHICLE.maxForwardSpeed, rawSpeed));
  const acceleration = (speed - state.speed) / SUBJECT2_VEHICLE.timeStep;
  const isBrakeHolding = speed === 0 && brakeCapacity > 0 && brakeCapacity >= Math.abs(baseAcceleration);
  const averageSpeed = (state.speed + speed) / 2;
  const steerAngle = steer * SUBJECT2_VEHICLE.maxSteerRadians;
  const headingDelta = averageSpeed / SUBJECT2_VEHICLE.wheelBase * Math.tan(steerAngle) * SUBJECT2_VEHICLE.timeStep;
  const midpointHeading = state.heading + headingDelta / 2;
  const heading = normalizeAngle(state.heading + headingDelta);
  return {
    x: state.x + Math.cos(midpointHeading) * averageSpeed * SUBJECT2_VEHICLE.timeStep,
    y: state.y + Math.sin(midpointHeading) * averageSpeed * SUBJECT2_VEHICLE.timeStep,
    heading,
    speed,
    steer,
    throttle, brake, gear, acceleration, isBrakeHolding,
  };
}
