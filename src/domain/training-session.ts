import {
  START_STATE,
  type Transition,
} from "./cliff-walking";
import { CliffWalkingAdapter } from "./cliff-walking-adapter";
import { QTable, selectAction, type ActionSource } from "./q-table";
import {
  updateQValue,
  type QUpdateResult,
  type QValueUpdater,
} from "@/exercise/update-q-value";
import {
  createQLearningStrategy,
  type LearningSignal,
  type LearningStrategy,
} from "./learning-strategy";

export interface LearningParameters {
  alpha: number;
  gamma: number;
  epsilon: number;
}

export interface StepResult extends Transition, QUpdateResult {
  algorithmId: string;
  signals: Record<string, LearningSignal>;
  source: ActionSource;
  oldQ: number;
  nextMaxQ: number;
  episode: number;
  episodeStep: number;
  cumulativeReward: number;
}

interface TrainingSessionOptions {
  updater?: QValueUpdater;
  strategy?: LearningStrategy;
  random?: () => number;
  qTable?: QTable;
}

export class TrainingSession {
  readonly qTable: QTable;
  private readonly environment = new CliffWalkingAdapter();
  private readonly strategy: LearningStrategy;
  private readonly random: () => number;
  private episode = 1;
  private episodeStep = 0;
  private cumulativeReward = 0;

  constructor(options: TrainingSessionOptions = {}) {
    this.qTable = options.qTable ?? new QTable();
    if (options.updater && options.strategy) {
      throw new Error("Provide either updater or strategy, not both.");
    }
    this.strategy = options.strategy ?? createQLearningStrategy(options.updater ?? updateQValue);
    this.random = options.random ?? Math.random;
  }

  get currentState(): number {
    return this.environment.state;
  }

  get currentEpisode(): number {
    return this.episode;
  }

  step(
    parameters: LearningParameters,
    options: { learn?: boolean } = {},
  ): StepResult {
    const learn = options.learn ?? true;
    const state = this.currentState;
    const selection = selectAction(
      this.qTable,
      state,
      learn ? parameters.epsilon : 0,
      this.random,
    );
    const transition = this.environment.step(selection.action);
    const oldQ = this.qTable.get(state, selection.action);
    const update = learn
      ? this.strategy.update({
          transition,
          qTable: this.qTable,
          oldQ,
          alpha: parameters.alpha,
          gamma: parameters.gamma,
          epsilon: parameters.epsilon,
          random: this.random,
        })
      : {
          newQ: oldQ,
          tdTarget: null,
          tdError: null,
          implemented: false,
          nextMaxQ: transition.done ? 0 : this.qTable.maxValue(transition.nextState),
          signals: {},
        };

    if (learn) {
      this.qTable.set(state, selection.action, update.newQ);
    }

    this.episodeStep += 1;
    this.cumulativeReward += transition.reward;

    return {
      ...transition,
      ...update,
      source: selection.source,
      algorithmId: this.strategy.id,
      oldQ,
      nextMaxQ: update.nextMaxQ,
      signals: update.signals,
      episode: this.episode,
      episodeStep: this.episodeStep,
      cumulativeReward: this.cumulativeReward,
    };
  }

  nextEpisode(): void {
    this.environment.reset();
    this.episode += 1;
    this.episodeStep = 0;
    this.cumulativeReward = 0;
  }

  resetAll(): void {
    this.environment.reset();
    this.qTable.reset();
    this.episode = 1;
    this.episodeStep = 0;
    this.cumulativeReward = 0;
  }

  resetEpisode(): void {
    this.environment.reset();
    this.episodeStep = 0;
    this.cumulativeReward = 0;
  }

  isAtStart(): boolean {
    return this.currentState === START_STATE;
  }
}

