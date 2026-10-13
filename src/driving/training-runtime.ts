import type { TrainerStatus, TrainerWorkerMode } from "../workers/driving-trainer-protocol";
import { DqnAgent, createEpsilonSchedule } from "./dqn-agent";
import { DrivingEnvironment, type DrivingEvent } from "./driving-environment";
import type { DrivingMap } from "./maps";
import { ReplayBuffer, type DrivingExperience } from "./replay-buffer";
import { drivingObservationToVector, type DrivingObservation } from "./types";
import type { EnvironmentStep } from "../domain/environment-adapter";
import type { RuntimeMode } from "../domain/environment-adapter";
import type { VehicleState } from "./vehicle-model";
import { evaluateDrivingPolicy, type EvaluationReport } from "./evaluator";
import { exportDqnModel, importDqnModel, type SerializedDqnModel } from "./model-format";

export interface DrivingTrainingRuntimeConfig {
  readonly map: DrivingMap;
  readonly seed?: number;
  readonly hiddenUnits?: number;
  readonly replayCapacity?: number;
  readonly warmupSteps?: number;
  readonly batchSize?: number;
  readonly targetSyncEvery?: number;
  readonly trainEvery?: number;
  readonly epsilonStart?: number;
  readonly epsilonEnd?: number;
  readonly epsilonDecaySteps?: number;
}

export interface TrainingRuntimeSnapshot {
  readonly status: TrainerStatus;
  readonly mode: RuntimeMode;
  readonly environmentStep: number;
  readonly trainingUpdates: number;
  readonly episode: number;
  readonly bufferSize: number;
  readonly targetSyncAge: number;
  readonly recentEpisodes: readonly EpisodeSummary[];
}

export interface EpisodeSummary {
  readonly episode: number;
  readonly outcome: DrivingEvent;
  readonly steps: number;
  readonly totalReward: number;
}

export interface ReplaySampleEvidence extends DrivingExperience {
  readonly targetQ: number;
  readonly tdError: number;
}

export interface TrainingStepEvidence extends TrainingRuntimeSnapshot {
  readonly transition: EnvironmentStep<DrivingObservation, number, DrivingEvent>;
  readonly qValues: number[];
  readonly source: "explore" | "exploit";
  readonly epsilon: number;
  readonly loss: number | null;
  readonly vehicle: VehicleState;
  readonly replaySample: ReplaySampleEvidence | null;
  readonly map: DrivingMap;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export class DrivingTrainingRuntime {
  private environment: DrivingEnvironment;
  private readonly agent: DqnAgent;
  private readonly replay: ReplayBuffer;
  private readonly random: () => number;
  private readonly warmupSteps: number;
  private readonly batchSize: number;
  private readonly targetSyncEvery: number;
  private readonly trainEvery: number;
  private epsilonAt: (step: number) => number;
  private epsilonScheduleStartStep = 0;
  private map: DrivingMap;
  private observation: DrivingObservation;
  private status: TrainerStatus = "idle";
  private mode: TrainerWorkerMode = "training";
  private environmentStep = 0;
  private trainingUpdates = 0;
  private lastTargetSyncStep = 0;
  private episode = 1;
  private episodeReward = 0;
  private episodeSteps = 0;
  private readonly recentEpisodes: EpisodeSummary[] = [];

  constructor(config: DrivingTrainingRuntimeConfig) {
    this.map = config.map;
    this.environment = new DrivingEnvironment(config.map);
    this.observation = this.environment.reset(config.seed);
    this.agent = new DqnAgent({
      hiddenUnits: config.hiddenUnits,
      seed: config.seed,
    });
    this.replay = new ReplayBuffer(config.replayCapacity ?? 50_000);
    this.random = createSeededRandom(config.seed ?? 1);
    this.warmupSteps = config.warmupSteps ?? 1_000;
    this.batchSize = config.batchSize ?? 64;
    this.targetSyncEvery = config.targetSyncEvery ?? 500;
    this.trainEvery = config.trainEvery ?? 4;
    this.epsilonAt = createEpsilonSchedule({
      start: config.epsilonStart ?? 1,
      end: config.epsilonEnd ?? 0.05,
      steps: config.epsilonDecaySteps ?? 30_000,
    });
  }

  start(mode: TrainerWorkerMode): void {
    this.mode = mode;
    this.status = "running";
  }

  pause(): void {
    if (this.status === "running") this.status = "paused";
  }

  resume(): void {
    if (this.status === "paused") this.status = "running";
  }

  resetEnvironment(map: DrivingMap, seed?: number): void {
    this.map = map;
    this.environment = new DrivingEnvironment(map);
    this.observation = this.environment.reset(seed);
    this.episodeReward = 0;
    this.episodeSteps = 0;
    this.status = "idle";
  }

  configureExploration(decaySteps: number): void {
    this.epsilonAt = createEpsilonSchedule({ start: 1, end: 0.05, steps: decaySteps });
    this.epsilonScheduleStartStep = this.environmentStep;
  }

  async step(): Promise<TrainingStepEvidence> {
    if (this.status === "paused") {
      throw new Error("Training is paused. Resume before stepping.");
    }
    if (this.status !== "running") {
      throw new Error("Training runtime must be started before stepping.");
    }

    const observationVector = drivingObservationToVector(this.observation);
    const epsilon =
      this.mode === "evaluation"
        ? 0
        : this.epsilonAt(this.environmentStep - this.epsilonScheduleStartStep);
    const selection = this.agent.selectAction(observationVector, epsilon, this.random);
    const transition = this.environment.step(selection.action);
    const nextObservationVector = drivingObservationToVector(transition.nextObservation);
    this.environmentStep += 1;

    let loss: number | null = null;
    let replaySample: ReplaySampleEvidence | null = null;
    if (this.mode === "training") {
      this.replay.add({
        observation: observationVector,
        action: selection.action,
        reward: transition.reward,
        nextObservation: nextObservationVector,
        done: transition.done,
      });
      if (
        this.replay.size >= Math.max(this.warmupSteps, this.batchSize) &&
        this.environmentStep % this.trainEvery === 0
      ) {
        const batch = this.replay.sample(this.batchSize, this.random);
        const sampled = batch[0];
        const predictedQ = this.agent.predict(sampled.observation)[sampled.action];
        const result = await this.agent.trainBatch(batch);
        loss = result.loss;
        replaySample = {
          ...sampled,
          targetQ: result.targets[0],
          tdError: result.targets[0] - predictedQ,
        };
        this.trainingUpdates += 1;
      }
      if (
        this.trainingUpdates > 0 &&
        this.trainingUpdates % this.targetSyncEvery === 0 &&
        this.trainingUpdates !== this.lastTargetSyncStep
      ) {
        this.agent.syncTargetNetwork();
        this.lastTargetSyncStep = this.trainingUpdates;
      }
    }

    this.observation = transition.nextObservation;
    this.episodeReward += transition.reward;
    this.episodeSteps += 1;
    const vehicle = this.environment.snapshot();
    const evidence: TrainingStepEvidence = {
      ...this.snapshot(),
      transition,
      qValues: selection.qValues,
      source: selection.source,
      epsilon,
      loss,
      vehicle,
      replaySample,
      map: this.map,
    };

    if (transition.done) {
      this.recentEpisodes.push({
        episode: this.episode,
        outcome: transition.event,
        steps: this.episodeSteps,
        totalReward: this.episodeReward,
      });
      if (this.recentEpisodes.length > 20) this.recentEpisodes.shift();
      this.episode += 1;
      this.episodeReward = 0;
      this.episodeSteps = 0;
      this.observation = this.environment.reset();
    }
    return evidence;
  }

  snapshot(): TrainingRuntimeSnapshot {
    return {
      status: this.status,
      mode: this.mode,
      environmentStep: this.environmentStep,
      trainingUpdates: this.trainingUpdates,
      episode: this.episode,
      bufferSize: this.replay.size,
      targetSyncAge: this.trainingUpdates - this.lastTargetSyncStep,
      recentEpisodes: [...this.recentEpisodes],
    };
  }

  weights(): number[][] {
    return this.agent.getWeights();
  }

  exportModel(): SerializedDqnModel {
    return exportDqnModel(this.agent);
  }

  importModel(model: SerializedDqnModel): void {
    importDqnModel(this.agent, model);
  }

  evaluate(fixedSeeds: readonly number[], unseenSeeds: readonly number[]): EvaluationReport {
    return evaluateDrivingPolicy({
      fixedSeeds,
      unseenSeeds,
      createPolicy: () => (observation) => {
        const qValues = this.agent.predict(drivingObservationToVector(observation));
        return qValues.indexOf(Math.max(...qValues));
      },
    });
  }

  dispose(): void {
    this.agent.dispose();
    this.status = "complete";
  }
}
