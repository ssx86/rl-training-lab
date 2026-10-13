import * as tf from "@tensorflow/tfjs";

import type { DrivingExperience } from "./replay-buffer";

export interface EpsilonScheduleConfig {
  readonly start: number;
  readonly end: number;
  readonly steps: number;
}

export interface DqnAgentConfig {
  readonly observationSize?: number;
  readonly actionCount?: number;
  readonly hiddenUnits?: number;
  readonly learningRate?: number;
  readonly gamma?: number;
  readonly seed?: number;
}

export interface DqnBatchResult {
  readonly loss: number;
  readonly targets: number[];
}

export interface SerializedWeight {
  readonly shape: number[];
  readonly values: number[];
}

const DEFAULT_CONFIG = {
  observationSize: 12,
  actionCount: 9,
  hiddenUnits: 128,
  learningRate: 0.0005,
  gamma: 0.99,
  seed: 1,
} as const;

export function computeBellmanTarget(
  reward: number,
  done: boolean,
  nextMaxQ: number,
  gamma: number,
): number {
  return done ? reward : reward + gamma * nextMaxQ;
}

export function createEpsilonSchedule(
  config: EpsilonScheduleConfig,
): (environmentStep: number) => number {
  if (config.steps <= 0 || config.start < config.end) {
    throw new RangeError("Epsilon schedule requires start >= end and steps > 0.");
  }
  return (environmentStep) => {
    if (environmentStep >= config.steps) return config.end;
    if (environmentStep <= 0) return config.start;
    const progress = Math.min(1, Math.max(0, environmentStep / config.steps));
    return config.start + (config.end - config.start) * progress;
  };
}

function createModel(config: Required<DqnAgentConfig>): tf.Sequential {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: config.hiddenUnits,
      activation: "relu",
      inputShape: [config.observationSize],
      kernelInitializer: tf.initializers.glorotUniform({ seed: config.seed }),
    }),
  );
  model.add(
    tf.layers.dense({
      units: config.hiddenUnits,
      activation: "relu",
      kernelInitializer: tf.initializers.glorotUniform({ seed: config.seed + 1 }),
    }),
  );
  model.add(
    tf.layers.dense({
      units: config.actionCount,
      kernelInitializer: tf.initializers.glorotUniform({ seed: config.seed + 2 }),
    }),
  );
  return model;
}

export class DqnAgent {
  private readonly config: Required<DqnAgentConfig>;
  private readonly onlineModel: tf.Sequential;
  private readonly targetModel: tf.Sequential;

  constructor(config: DqnAgentConfig = {}) {
    this.config = {
      observationSize: config.observationSize ?? DEFAULT_CONFIG.observationSize,
      actionCount: config.actionCount ?? DEFAULT_CONFIG.actionCount,
      hiddenUnits: config.hiddenUnits ?? DEFAULT_CONFIG.hiddenUnits,
      learningRate: config.learningRate ?? DEFAULT_CONFIG.learningRate,
      gamma: config.gamma ?? DEFAULT_CONFIG.gamma,
      seed: config.seed ?? DEFAULT_CONFIG.seed,
    };
    this.onlineModel = createModel(this.config);
    this.targetModel = createModel({ ...this.config, seed: this.config.seed + 10_000 });
    this.onlineModel.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: tf.losses.huberLoss,
    });
    this.syncTargetNetwork();
  }

  predict(observation: readonly number[]): number[] {
    return this.predictWithModel(this.onlineModel, observation);
  }

  predictTarget(observation: readonly number[]): number[] {
    return this.predictWithModel(this.targetModel, observation);
  }

  selectAction(
    observation: readonly number[],
    epsilon: number,
    random: () => number = Math.random,
  ): { action: number; source: "explore" | "exploit"; qValues: number[] } {
    const qValues = this.predict(observation);
    if (random() < epsilon) {
      return {
        action: Math.min(this.config.actionCount - 1, Math.floor(random() * this.config.actionCount)),
        source: "explore",
        qValues,
      };
    }
    const bestValue = Math.max(...qValues);
    return { action: qValues.indexOf(bestValue), source: "exploit", qValues };
  }

  async trainBatch(batch: readonly DrivingExperience[]): Promise<DqnBatchResult> {
    if (batch.length === 0) {
      throw new RangeError("A DQN batch cannot be empty.");
    }
    batch.forEach((experience) => this.validateExperience(experience));

    const nextQValues = this.predictBatch(
      this.targetModel,
      batch.map((experience) => experience.nextObservation),
    );
    const currentQValues = this.predictBatch(
      this.onlineModel,
      batch.map((experience) => experience.observation),
    );
    const targets = batch.map((experience, index) =>
      computeBellmanTarget(
        experience.reward,
        experience.done,
        Math.max(...nextQValues[index]),
        this.config.gamma,
      ),
    );
    const expectedQValues = currentQValues.map((values, index) => {
      const expected = [...values];
      expected[batch[index].action] = targets[index];
      return expected;
    });

    const observations = tf.tensor2d(
      batch.map((experience) => experience.observation),
      [batch.length, this.config.observationSize],
    );
    const labels = tf.tensor2d(expectedQValues, [batch.length, this.config.actionCount]);
    try {
      const history = await this.onlineModel.fit(observations, labels, {
        batchSize: batch.length,
        epochs: 1,
        verbose: 0,
      });
      const rawLoss = history.history.loss[0];
      return {
        loss: typeof rawLoss === "number" ? rawLoss : Number(rawLoss),
        targets,
      };
    } finally {
      observations.dispose();
      labels.dispose();
    }
  }

  syncTargetNetwork(): void {
    const weights = this.onlineModel.getWeights().map((weight) => weight.clone());
    try {
      this.targetModel.setWeights(weights);
    } finally {
      weights.forEach((weight) => weight.dispose());
    }
  }

  getWeights(): number[][] {
    const weights = this.onlineModel.getWeights();
    return weights.map((weight) => Array.from(weight.dataSync()));
  }

  exportWeights(): SerializedWeight[] {
    return this.onlineModel.getWeights().map((weight) => ({
      shape: [...weight.shape],
      values: Array.from(weight.dataSync()),
    }));
  }

  importWeights(weights: readonly SerializedWeight[]): void {
    const expected = this.onlineModel.getWeights();
    if (weights.length !== expected.length) {
      throw new RangeError("Model weight count does not match the DQN architecture.");
    }
    weights.forEach((weight, index) => {
      if (weight.shape.join("x") !== expected[index].shape.join("x")) {
        throw new RangeError(`Model weight ${index} has an incompatible shape.`);
      }
    });
    const tensors = weights.map((weight) => tf.tensor(weight.values, weight.shape));
    try {
      this.onlineModel.setWeights(tensors);
      this.syncTargetNetwork();
    } finally {
      tensors.forEach((tensor) => tensor.dispose());
    }
  }

  networkConfig(): Pick<Required<DqnAgentConfig>, "observationSize" | "actionCount" | "hiddenUnits"> {
    return {
      observationSize: this.config.observationSize,
      actionCount: this.config.actionCount,
      hiddenUnits: this.config.hiddenUnits,
    };
  }

  dispose(): void {
    this.onlineModel.dispose();
    this.targetModel.dispose();
  }

  private predictWithModel(
    model: tf.Sequential,
    observation: readonly number[],
  ): number[] {
    if (observation.length !== this.config.observationSize) {
      throw new RangeError(
        `Expected ${this.config.observationSize} observation values, received ${observation.length}.`,
      );
    }
    return tf.tidy(() => {
      const input = tf.tensor2d([[...observation]], [1, this.config.observationSize]);
      const output = model.predict(input) as tf.Tensor;
      return Array.from(output.dataSync());
    });
  }

  private predictBatch(
    model: tf.Sequential,
    observations: readonly (readonly number[])[],
  ): number[][] {
    observations.forEach((observation) => {
      if (observation.length !== this.config.observationSize) {
        throw new RangeError("Experience observation shape does not match the DQN.");
      }
    });
    return tf.tidy(() => {
      const input = tf.tensor2d(
        observations.map((observation) => [...observation]),
        [observations.length, this.config.observationSize],
      );
      const output = model.predict(input) as tf.Tensor2D;
      const values = Array.from(output.dataSync());
      return observations.map((_, row) =>
        values.slice(
          row * this.config.actionCount,
          (row + 1) * this.config.actionCount,
        ),
      );
    });
  }

  private validateExperience(experience: DrivingExperience): void {
    if (
      experience.observation.length !== this.config.observationSize ||
      experience.nextObservation.length !== this.config.observationSize
    ) {
      throw new RangeError("Experience observation shape does not match the DQN.");
    }
    if (
      !Number.isInteger(experience.action) ||
      experience.action < 0 ||
      experience.action >= this.config.actionCount
    ) {
      throw new RangeError("Experience action is outside the DQN action space.");
    }
  }
}
