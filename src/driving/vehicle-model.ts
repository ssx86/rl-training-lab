import type { Point } from "@/simulation/geometry";

export const VEHICLE_CONFIG = {
  timeStepSeconds: 0.1,
  wheelBase: 18,
  maxSteerRadians: Math.PI / 6,
  accelerationPerSecond: 30,
  brakePerSecond: 45,
  passiveDragPerSecond: 2,
  maxForwardSpeed: 80,
  maxReverseSpeed: -20,
  collisionRadius: 8,
} as const;

export interface VehicleState extends Point {
  readonly heading: number;
  readonly speed: number;
  readonly steer: number;
  readonly acceleration: number;
}

export interface VehicleCommand {
  readonly steer: number;
  readonly acceleration: number;
}

export interface VehiclePhysics {
  readonly speedToDistanceScale?: number;
  readonly wheelBase?: number;
}

export function createVehicleState(
  values: Partial<VehicleState> & Pick<VehicleState, "x" | "y" | "heading">,
): VehicleState {
  return {
    speed: 0,
    steer: 0,
    acceleration: 0,
    ...values,
  };
}

export function advanceVehicle(
  state: VehicleState,
  command: VehicleCommand,
  physics: VehiclePhysics = {},
): VehicleState {
  const config = VEHICLE_CONFIG;
  const steerCommand = Math.max(-1, Math.min(1, command.steer));
  const accelerationCommand = Math.max(-1, Math.min(1, command.acceleration));
  const acceleration =
    accelerationCommand > 0
      ? config.accelerationPerSecond * accelerationCommand
      : accelerationCommand < 0
        ? config.brakePerSecond * accelerationCommand
        : state.speed === 0
          ? 0
          : -Math.sign(state.speed) * config.passiveDragPerSecond;
  const rawSpeed = state.speed + acceleration * config.timeStepSeconds;
  const speed = Math.min(config.maxForwardSpeed, Math.max(0, rawSpeed));
  const steerAngle = steerCommand * config.maxSteerRadians;
  const movementSpeed = speed * (physics.speedToDistanceScale ?? 1);
  const heading =
    state.heading +
    (movementSpeed / (physics.wheelBase ?? config.wheelBase)) *
      Math.tan(steerAngle) *
      config.timeStepSeconds;

  return {
    x: state.x + Math.cos(heading) * movementSpeed * config.timeStepSeconds,
    y: state.y + Math.sin(heading) * movementSpeed * config.timeStepSeconds,
    heading,
    speed,
    steer: steerCommand,
    acceleration: accelerationCommand,
  };
}
