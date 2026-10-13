export interface DrivingRewardInput {
  readonly progressDelta: number;
  readonly checkpointPassed: boolean;
  readonly reachedGoal: boolean;
  readonly normalizedOffset: number;
  readonly nearestSensor: number;
  readonly steerDelta: number;
  readonly speed: number;
  readonly offRoad: boolean;
  readonly offRoadTerminal: boolean;
  readonly collision: boolean;
  readonly stalled?: boolean;
}

export type DrivingRewardBreakdown = Readonly<Record<string, number>>;

export function calculateDrivingReward(
  input: DrivingRewardInput,
): DrivingRewardBreakdown {
  const progress = Math.min(1, Math.max(-1, input.progressDelta * 2));
  const danger =
    input.nearestSensor < 0.15
      ? -0.2 * (1 - input.nearestSensor / 0.15)
      : 0;

  return {
    progress,
    checkpoint: input.checkpointPassed ? 3 : 0,
    goal: input.reachedGoal ? 30 : 0,
    step: -0.02,
    inactivity: Math.abs(input.progressDelta) < 0.01 ? -0.1 : 0,
    laneOffset: -0.03 * Math.abs(input.normalizedOffset),
    danger,
    steeringJerk: -0.05 * Math.abs(input.steerDelta),
    reverse: input.speed < 0 ? -0.2 : 0,
    offRoad: input.offRoad ? -1.5 : 0,
    offRoadTerminal: input.offRoadTerminal ? -15 : 0,
    collision: input.collision ? -25 : 0,
    stalled: input.stalled ? -12 : 0,
  };
}

export function sumReward(breakdown: DrivingRewardBreakdown): number {
  return Object.values(breakdown).reduce((sum, value) => sum + value, 0);
}
