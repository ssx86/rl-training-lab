import {
  CliffWalkingEnvironment,
  START_STATE,
  type Transition,
} from "./cliff-walking";
import { QTable, selectAction, type ActionSource } from "./q-table";
import {
  updateQValue,
  type QUpdateResult,
  type QValueUpdater,
} from "@/exercise/update-q-value";

export interface LearningParameters {
  alpha: number;
  gamma: number;
  epsilon: number;
}

export interface StepResult extends Transition, QUpdateResult {
  source: ActionSource;
  oldQ: number;
  nextMaxQ: number;
  episode: number;
  episodeStep: number;
  cumulativeReward: number;
}

interface TrainingSessionOptions {
  updater?: QValueUpdater;
  random?: () => number;
  qTable?: QTable;
}

export class TrainingSession {
  readonly qTable: QTable;
  private readonly environment = new CliffWalkingEnvironment();
  private readonly updater: QValueUpdater;
  private readonly random: () => number;
  private episode = 1;
  private episodeStep = 0;
  private cumulativeReward = 0;

  constructor(options: TrainingSessionOptions = {}) {
    this.qTable = options.qTable ?? new QTable();
    this.updater = options.updater ?? updateQValue;
    this.random = options.random ?? Math.random;
  }

  get currentState(): number {
    return this.environment.position.state;
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
    const nextMaxQ = transition.done ? 0 : this.qTable.maxValue(transition.nextState);
    const update = learn
      ? this.updater({
          ...transition,
          oldQ,
          nextMaxQ,
          alpha: parameters.alpha,
          gamma: parameters.gamma,
        })
      : {
          newQ: oldQ,
          tdTarget: null,
          tdError: null,
          implemented: false,
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
      oldQ,
      nextMaxQ,
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

