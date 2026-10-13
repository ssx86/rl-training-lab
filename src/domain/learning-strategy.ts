import type { QUpdateResult, QValueUpdater } from "@/exercise/update-q-value";
import type { Transition } from "./cliff-walking";
import type { QTable } from "./q-table";

export type LearningSignal = number | string | boolean | null;

export interface LearningStrategyContext {
  transition: Transition;
  qTable: QTable;
  oldQ: number;
  alpha: number;
  gamma: number;
  epsilon: number;
  random: () => number;
}

export interface LearningStrategyUpdate extends QUpdateResult {
  nextMaxQ: number;
  signals: Record<string, LearningSignal>;
}

/**
 * Shared contract for every lesson algorithm.
 *
 * A strategy owns its update semantics and exposes the intermediate signals
 * required by the teaching UI. It does not own the environment or playback.
 */
export interface LearningStrategy {
  id: string;
  update(context: LearningStrategyContext): LearningStrategyUpdate;
}

export function createQLearningStrategy(updater: QValueUpdater): LearningStrategy {
  return {
    id: "q-learning",
    update({ transition, qTable, oldQ, alpha, gamma }) {
      const nextMaxQ = transition.done ? 0 : qTable.maxValue(transition.nextState);
      const result = updater({
        ...transition,
        oldQ,
        nextMaxQ,
        alpha,
        gamma,
      });

      return {
        ...result,
        nextMaxQ,
        signals: {
          bootstrap: nextMaxQ,
          target: result.tdTarget,
          tdError: result.tdError,
        },
      };
    },
  };
}
