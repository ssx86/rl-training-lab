import type { VehicleState } from "./vehicle-model";

const HALF_LENGTH = 2.25;
const HALF_WIDTH = 1;
const COLLISION_PADDING = 0.08;

function axes(vehicle: VehicleState) {
  return [
    { x: Math.cos(vehicle.heading), y: Math.sin(vehicle.heading), extent: HALF_LENGTH + COLLISION_PADDING },
    { x: -Math.sin(vehicle.heading), y: Math.cos(vehicle.heading), extent: HALF_WIDTH + COLLISION_PADDING },
  ] as const;
}

function projectionRadius(vehicle: VehicleState, axis: { x: number; y: number }): number {
  const [forward, side] = axes(vehicle);
  return Math.abs(axis.x * forward.x + axis.y * forward.y) * forward.extent
    + Math.abs(axis.x * side.x + axis.y * side.y) * side.extent;
}

export function vehiclesCollide(first: VehicleState, second: VehicleState): boolean {
  const delta = { x: second.x - first.x, y: second.y - first.y };
  const separatingAxes = [...axes(first), ...axes(second)];
  return separatingAxes.every((axis) => {
    const centreDistance = Math.abs(delta.x * axis.x + delta.y * axis.y);
    return centreDistance <= projectionRadius(first, axis) + projectionRadius(second, axis);
  });
}
