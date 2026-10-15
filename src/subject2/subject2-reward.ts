import type { RequiredMotion } from "./subject2-course";

export interface RewardPoseError {
  readonly distance: number;
  readonly heading: number;
  readonly speed: number;
}

export interface Subject2RewardBreakdown {
  readonly poseProgress: number;
  readonly bayOverlapProgress: number;
  readonly checkpoint: number;
  readonly passBonus: number;
  readonly timeCost: number;
  readonly inactivity: number;
  readonly wrongDirection: number;
  readonly unsafeSpeed: number;
  readonly controlSmoothness: number;
  readonly clearance: number;
  readonly collision: number;
  readonly outOfBounds: number;
  readonly rollback: number;
  readonly stableHold: number;
  readonly startTimeout: number;
  readonly stalled: number;
  readonly timeout: number;
  readonly total: number;
}

export interface Subject2RewardContext {
  readonly previousError: RewardPoseError;
  readonly nextError: RewardPoseError;
  readonly target: { readonly motion: RequiredMotion; readonly reward: number; readonly speedMax?: number };
  readonly speed: number;
  readonly steerChange: number;
  readonly throttleChange: number;
  readonly brakeChange?: number;
  readonly minimumClearance: number;
  readonly checkpointReached: boolean;
  readonly isFinalCheckpoint: boolean;
  readonly shapePoseProgress?: boolean;
  readonly previousBayOverlap?: number;
  readonly nextBayOverlap?: number;
  readonly collided: boolean;
  readonly outOfBounds?: boolean;
  readonly rollbackExceeded?: boolean;
  readonly requiredHold?: boolean;
  readonly validHoldStep?: boolean;
  readonly startTimedOut?: boolean;
  readonly stalled?: boolean;
  readonly timedOut: boolean;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function posePotential(error: RewardPoseError, speedLimit: number): number {
  const cost = error.distance + 4 * Math.abs(error.heading) + .8 * Math.max(0, error.speed - speedLimit);
  return Math.exp(-cost / 12);
}

export function calculateSubject2Reward(context: Subject2RewardContext): Subject2RewardBreakdown {
  const speedLimit = context.target.speedMax ?? .8;
  const poseProgress = context.shapePoseProgress === false ? 0 : clamp(12 * (posePotential(context.nextError, speedLimit)
    - posePotential(context.previousError, speedLimit)), -4, 4);
  const bayOverlapProgress = clamp(30 * ((context.nextBayOverlap ?? 0) - (context.previousBayOverlap ?? 0)), -8, 8);
  const wrongWay = (context.target.motion === "forward" && context.speed < -.05)
    || (context.target.motion === "reverse" && context.speed > .05);
  const safeSpeed = speedLimit + Math.min(2.2, context.nextError.distance * .28);
  const speedExcess = Math.max(0, Math.abs(context.speed) - safeSpeed);
  const clearanceDeficit = Math.max(0, .6 - context.minimumClearance);
  const parts = {
    poseProgress,
    bayOverlapProgress,
    checkpoint: context.checkpointReached ? context.target.reward : 0,
    passBonus: context.checkpointReached && context.isFinalCheckpoint ? 100 : 0,
    timeCost: -.005,
    inactivity: Math.abs(context.speed) < .08 && !context.requiredHold ? -.05 : 0,
    wrongDirection: wrongWay ? -.3 - .1 * Math.abs(context.speed) : 0,
    unsafeSpeed: -.12 * speedExcess ** 2,
    controlSmoothness: -.04 * (context.steerChange ** 2 + .5 * context.throttleChange ** 2 + .5 * (context.brakeChange ?? 0) ** 2),
    clearance: clearanceDeficit > 0 ? -1.2 * clearanceDeficit ** 2 : 0,
    collision: context.collided ? -100 : 0,
    outOfBounds: context.outOfBounds ? -100 : 0,
    rollback: context.rollbackExceeded ? -100 : 0,
    stableHold: context.validHoldStep ? .25 : 0,
    startTimeout: context.startTimedOut ? -100 : 0,
    stalled: context.stalled ? -35 : 0,
    timeout: context.timedOut && !context.collided && !context.outOfBounds && !context.rollbackExceeded && !context.startTimedOut && !context.stalled
      && !(context.checkpointReached && context.isFinalCheckpoint) ? -30 : 0,
  };
  return { ...parts, total: Object.values(parts).reduce((sum, value) => sum + value, 0) };
}
