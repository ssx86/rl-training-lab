import type { Subject2Project } from "./subject2-course";
import { SUBJECT2_VEHICLE, type Subject2Action, type Subject2VehicleState } from "./subject2-vehicle";

export type Subject2ExplorationOptionKind = "drive" | "adjust" | "brake" | "coast";
export type Subject2ExplorationMotionBand = "stopped-braked" | "stopped-free" | "moving-forward" | "moving-reverse";

export interface Subject2ExplorationOption {
  readonly kind: Subject2ExplorationOptionKind;
  readonly action: Subject2Action;
  readonly durationSteps: number;
}

const BASE_OPTION_KINDS: readonly Subject2ExplorationOptionKind[] = ["drive", "brake", "coast"];
const PARKING_OPTION_KINDS: readonly Subject2ExplorationOptionKind[] = ["drive", "adjust", "brake", "coast"];

export function subject2ExplorationMotionBand(vehicle: Subject2VehicleState): Subject2ExplorationMotionBand {
  if (Math.abs(vehicle.speed) < .08) return vehicle.brake > .08 || vehicle.isBrakeHolding ? "stopped-braked" : "stopped-free";
  return vehicle.speed > 0 ? "moving-forward" : "moving-reverse";
}

export function explorationCoverageKey(
  project: Subject2Project,
  vehicle: Subject2VehicleState,
  kind: Subject2ExplorationOptionKind,
): string {
  return `${project}:${subject2ExplorationMotionBand(vehicle)}:${kind}`;
}

export function subject2ExplorationOptionProbability(step: number, vehicle: Subject2VehicleState): number {
  if (Math.abs(vehicle.speed) < .08) return .18;
  const progress = Math.min(1, Math.max(0, step) / 120_000);
  return .08 + (.03 - .08) * progress;
}

/**
 * Selects an option with an upper-confidence-bound exploration bonus. The
 * bonus affects exploration choice only; it is never added to exam reward.
 */
export function chooseSubject2ExplorationOption(
  counts: Readonly<Record<string, number>>,
  project: Subject2Project,
  vehicle: Subject2VehicleState,
  random: () => number,
): Subject2ExplorationOptionKind {
  const optionKinds = project === "reverse-parking" || project === "side-parking" ? PARKING_OPTION_KINDS : BASE_OPTION_KINDS;
  const visits = optionKinds.map((kind) => Math.max(0, counts[explorationCoverageKey(project, vehicle, kind)] ?? 0));
  const totalVisits = visits.reduce((sum, count) => sum + count, 0);
  return optionKinds.reduce((best, kind, index) => {
    const bonus = Math.sqrt(2 * Math.log(totalVisits + optionKinds.length + 1) / (visits[index] + 1));
    const score = bonus + random() * 1e-4;
    return score > best.score ? { kind, score } : best;
  }, { kind: optionKinds[0], score: Number.NEGATIVE_INFINITY }).kind;
}

const clampSteps = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, Math.ceil(value)));

export function planSubject2ExplorationOption(
  kind: Subject2ExplorationOptionKind,
  vehicle: Subject2VehicleState,
  requiredMotion: -1 | 0 | 1,
  random: () => number,
): Subject2ExplorationOption {
  const intendedGear: -1 | 1 = requiredMotion === -1 ? -1 : 1;
  if (kind === "brake") {
    const durationSeconds = Math.abs(vehicle.speed) / SUBJECT2_VEHICLE.serviceBrakeDeceleration + .5;
    return {
      kind,
      action: { steer: vehicle.steer * .5, throttle: 0, brake: 1, gear: vehicle.gear || intendedGear },
      durationSteps: clampSteps(durationSeconds / SUBJECT2_VEHICLE.timeStep, 12, 24),
    };
  }
  if (kind === "coast") {
    return {
      kind,
      action: { steer: vehicle.steer * .7, throttle: 0, brake: 0, gear: Math.abs(vehicle.speed) < .15 ? intendedGear : vehicle.gear },
      durationSteps: Math.round(.6 / SUBJECT2_VEHICLE.timeStep),
    };
  }
  const broadTurn = random() < .25;
  const steer = broadTurn ? (random() * 2 - 1) * .75 : (random() + random() - 1) * .28;
  return {
    kind,
    action: { steer, throttle: .65 + random() * .25, brake: 0, gear: kind === "adjust" ? -intendedGear : intendedGear },
    // One second covers full brake release, throttle build-up, and measurable motion.
    durationSteps: Math.round(1 / SUBJECT2_VEHICLE.timeStep),
  };
}
