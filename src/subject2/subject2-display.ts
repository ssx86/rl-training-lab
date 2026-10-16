import { normalizeAngle } from "@/simulation/geometry";
import type { Subject2VehicleState } from "./subject2-vehicle";

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function interpolateSubject2Vehicle(from: Subject2VehicleState, to: Subject2VehicleState, progress: number): Subject2VehicleState {
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: mix(from.x, to.x, t),
    y: mix(from.y, to.y, t),
    heading: normalizeAngle(from.heading + normalizeAngle(to.heading - from.heading) * t),
    speed: mix(from.speed, to.speed, t),
    steer: mix(from.steer, to.steer, t),
    longitudinalIntent: mix(from.longitudinalIntent, to.longitudinalIntent, t),
    driveDirection: t < .5 ? from.driveDirection : to.driveDirection,
    acceleration: mix(from.acceleration, to.acceleration, t),
    isBrakeHolding: t < .5 ? from.isBrakeHolding : to.isBrakeHolding,
  };
}
