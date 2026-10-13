import * as tf from "@tensorflow/tfjs";
import {
  clampContinuousAction,
  CONTINUOUS_ACTION_SIZE,
  CONTINUOUS_OBSERVATION_SIZE,
  type ContinuousDrivingAction,
} from "@/driving/continuous-control";

export interface ContinuousExperience<TAction = ContinuousDrivingAction> {
  readonly observation: readonly number[];
  readonly action: TAction;
  readonly reward: number;
  readonly nextObservation: readonly number[];
  readonly done: boolean;
}

export interface Td3ActionCodec<TAction> {
  readonly size: number;
  encode(action: TAction): readonly number[];
  decode(values: readonly number[]): TAction;
}

const CONTINUOUS_ACTION_CODEC: Td3ActionCodec<ContinuousDrivingAction> = {
  size: CONTINUOUS_ACTION_SIZE,
  encode: (action) => [action.steer, action.throttle],
  decode: (values) => clampContinuousAction({ steer: values[0], throttle: values[1] }),
};

export interface Td3Config {
  readonly observationSize?: number;
  readonly actionSize?: number;
  readonly hiddenUnits?: number;
  readonly actorLearningRate?: number;
  readonly criticLearningRate?: number;
  readonly gamma?: number;
  readonly tau?: number;
  readonly policyNoise?: number;
  readonly noiseClip?: number;
  readonly policyDelay?: number;
  readonly seed?: number;
}

export interface Td3TrainResult {
  readonly criticLoss: number;
  readonly actorLoss: number | null;
  readonly actorUpdated: boolean;
}

export interface Td3Description {
  readonly algorithm: "TD3";
  readonly observationSize: number;
  readonly actionSize: number;
  readonly hiddenUnits: number;
  readonly actorParameters: number;
  readonly criticParametersEach: number;
  readonly onlineTrainableParameters: number;
  readonly totalParameters: number;
  readonly actorLearningRate: number;
  readonly criticLearningRate: number;
  readonly gamma: number;
  readonly tau: number;
  readonly policyNoise: number;
  readonly noiseClip: number;
  readonly policyDelay: number;
}

export interface Td3SerializedTensor {
  readonly shape: readonly number[];
  readonly values: Float32Array;
}

export interface Td3AgentState {
  readonly version: 1;
  readonly updateCount: number;
  readonly networks: readonly (readonly Td3SerializedTensor[])[];
}

const DEFAULTS = {
  observationSize: CONTINUOUS_OBSERVATION_SIZE,
  actionSize: CONTINUOUS_ACTION_SIZE,
  hiddenUnits: 128,
  actorLearningRate: 0.0003,
  criticLearningRate: 0.001,
  gamma: 0.99,
  tau: 0.005,
  policyNoise: 0.2,
  noiseClip: 0.5,
  policyDelay: 2,
  seed: 7,
} as const;

export function describeTd3Config(config: Td3Config = {}): Td3Description {
  const observationSize = config.observationSize ?? DEFAULTS.observationSize;
  const actionSize = config.actionSize ?? DEFAULTS.actionSize;
  const hiddenUnits = config.hiddenUnits ?? DEFAULTS.hiddenUnits;
  const actorParameters = (observationSize + 1) * hiddenUnits
    + (hiddenUnits + 1) * hiddenUnits
    + (hiddenUnits + 1) * actionSize;
  const criticParametersEach = (observationSize + actionSize + 1) * hiddenUnits
    + (hiddenUnits + 1) * hiddenUnits
    + (hiddenUnits + 1);
  return {
    algorithm: "TD3", observationSize, actionSize, hiddenUnits,
    actorParameters, criticParametersEach,
    onlineTrainableParameters: actorParameters + criticParametersEach * 2,
    totalParameters: actorParameters * 2 + criticParametersEach * 4,
    actorLearningRate: config.actorLearningRate ?? DEFAULTS.actorLearningRate,
    criticLearningRate: config.criticLearningRate ?? DEFAULTS.criticLearningRate,
    gamma: config.gamma ?? DEFAULTS.gamma, tau: config.tau ?? DEFAULTS.tau,
    policyNoise: config.policyNoise ?? DEFAULTS.policyNoise,
    noiseClip: config.noiseClip ?? DEFAULTS.noiseClip,
    policyDelay: config.policyDelay ?? DEFAULTS.policyDelay,
  };
}

function dense(units: number, activation: "relu" | "tanh" | undefined, seed: number) {
  return tf.layers.dense({
    units,
    activation,
    kernelInitializer: tf.initializers.glorotUniform({ seed }),
    biasInitializer: "zeros",
  });
}

function createActor(config: Required<Td3Config>, seedOffset: number): tf.LayersModel {
  const observation = tf.input({ shape: [config.observationSize], name: "observation" });
  const hidden1 = dense(config.hiddenUnits, "relu", config.seed + seedOffset).apply(observation) as tf.SymbolicTensor;
  const hidden2 = dense(config.hiddenUnits, "relu", config.seed + seedOffset + 1).apply(hidden1) as tf.SymbolicTensor;
  const action = dense(config.actionSize, "tanh", config.seed + seedOffset + 2).apply(hidden2) as tf.SymbolicTensor;
  return tf.model({ inputs: observation, outputs: action, name: `td3-actor-${seedOffset}` });
}

function createCritic(config: Required<Td3Config>, seedOffset: number): tf.LayersModel {
  const observation = tf.input({ shape: [config.observationSize], name: `critic-observation-${seedOffset}` });
  const action = tf.input({ shape: [config.actionSize], name: `critic-action-${seedOffset}` });
  const joined = tf.layers.concatenate().apply([observation, action]) as tf.SymbolicTensor;
  const hidden1 = dense(config.hiddenUnits, "relu", config.seed + seedOffset).apply(joined) as tf.SymbolicTensor;
  const hidden2 = dense(config.hiddenUnits, "relu", config.seed + seedOffset + 1).apply(hidden1) as tf.SymbolicTensor;
  const value = dense(1, undefined, config.seed + seedOffset + 2).apply(hidden2) as tf.SymbolicTensor;
  return tf.model({ inputs: [observation, action], outputs: value, name: `td3-critic-${seedOffset}` });
}

function gaussian(random: () => number): number {
  const first = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
}

function trainableVariables(model: tf.LayersModel): tf.Variable[] {
  return model.trainableWeights.map((weight) =>
    (weight as unknown as { val: tf.Variable }).val);
}

export class Td3Agent<TAction = ContinuousDrivingAction> {
  private readonly config: Required<Td3Config>;
  private readonly actor: tf.LayersModel;
  private readonly targetActor: tf.LayersModel;
  private readonly critic1: tf.LayersModel;
  private readonly critic2: tf.LayersModel;
  private readonly targetCritic1: tf.LayersModel;
  private readonly targetCritic2: tf.LayersModel;
  private readonly actorOptimizer: tf.Optimizer;
  private readonly critic1Optimizer: tf.Optimizer;
  private readonly critic2Optimizer: tf.Optimizer;
  private updateCount = 0;

  constructor(config: Td3Config = {}, private readonly actionCodec: Td3ActionCodec<TAction> = CONTINUOUS_ACTION_CODEC as unknown as Td3ActionCodec<TAction>) {
    this.config = {
      observationSize: config.observationSize ?? DEFAULTS.observationSize,
      actionSize: config.actionSize ?? actionCodec.size,
      hiddenUnits: config.hiddenUnits ?? DEFAULTS.hiddenUnits,
      actorLearningRate: config.actorLearningRate ?? DEFAULTS.actorLearningRate,
      criticLearningRate: config.criticLearningRate ?? DEFAULTS.criticLearningRate,
      gamma: config.gamma ?? DEFAULTS.gamma,
      tau: config.tau ?? DEFAULTS.tau,
      policyNoise: config.policyNoise ?? DEFAULTS.policyNoise,
      noiseClip: config.noiseClip ?? DEFAULTS.noiseClip,
      policyDelay: config.policyDelay ?? DEFAULTS.policyDelay,
      seed: config.seed ?? DEFAULTS.seed,
    };
    if (this.config.actionSize !== actionCodec.size) throw new RangeError("TD3 action size must match its action codec.");
    this.actor = createActor(this.config, 0);
    this.targetActor = createActor(this.config, 100);
    this.critic1 = createCritic(this.config, 200);
    this.critic2 = createCritic(this.config, 300);
    this.targetCritic1 = createCritic(this.config, 400);
    this.targetCritic2 = createCritic(this.config, 500);
    this.actorOptimizer = tf.train.adam(this.config.actorLearningRate);
    this.critic1Optimizer = tf.train.adam(this.config.criticLearningRate);
    this.critic2Optimizer = tf.train.adam(this.config.criticLearningRate);
    this.hardUpdate(this.actor, this.targetActor);
    this.hardUpdate(this.critic1, this.targetCritic1);
    this.hardUpdate(this.critic2, this.targetCritic2);
  }

  describe(): Td3Description { return describeTd3Config(this.config); }

  exportState(): Td3AgentState {
    const networks = this.models().map((model) => {
      const weights = model.getWeights();
      return weights.map((weight) => ({ shape: [...weight.shape], values: Float32Array.from(weight.dataSync()) }));
    });
    return { version: 1, updateCount: this.updateCount, networks };
  }

  importState(state: Td3AgentState): void {
    if (state.version !== 1 || !Number.isSafeInteger(state.updateCount) || state.updateCount < 0) {
      throw new RangeError("Unsupported TD3 checkpoint metadata.");
    }
    const models = this.models();
    if (state.networks.length !== models.length) throw new RangeError("TD3 checkpoint network count does not match.");
    models.forEach((model, modelIndex) => {
      const expected = model.weights;
      const saved = state.networks[modelIndex];
      if (saved.length !== expected.length) throw new RangeError("TD3 checkpoint weight count does not match.");
      const tensors = saved.map((weight, weightIndex) => {
        const expectedShape = expected[weightIndex].shape;
        if (weight.shape.length !== expectedShape.length || weight.shape.some((size, index) => size !== expectedShape[index])) {
          throw new RangeError("TD3 checkpoint tensor shape does not match.");
        }
        return tf.tensor(weight.values, [...weight.shape]);
      });
      try { model.setWeights(tensors); } finally { tensors.forEach((tensor) => tensor.dispose()); }
    });
    this.updateCount = state.updateCount;
  }

  selectAction(observation: readonly number[], noiseStd = 0, random: () => number = Math.random): TAction {
    return this.selectActions([observation], [noiseStd], random)[0];
  }

  selectActions(
    observations: readonly (readonly number[])[],
    noiseStd: readonly number[] = observations.map(() => 0),
    random: () => number = Math.random,
  ): TAction[] {
    if (!observations.length) return [];
    observations.forEach((observation) => this.validateObservation(observation));
    if (noiseStd.length !== observations.length) throw new RangeError("TD3 noise vector must match actor count.");
    const values = tf.tidy(() => {
      const input = tf.tensor2d(observations.map((observation) => [...observation]), [observations.length, this.config.observationSize]);
      const prediction = this.actor.predict(input) as tf.Tensor;
      return Array.from(prediction.dataSync());
    });
    return observations.map((_, index) => this.actionCodec.decode(Array.from(
      { length: this.config.actionSize },
      (__, actionIndex) => values[index * this.config.actionSize + actionIndex] + gaussian(random) * noiseStd[index],
    )));
  }

  async trainBatch(batch: readonly ContinuousExperience<TAction>[]): Promise<Td3TrainResult> {
    if (!batch.length) throw new RangeError("A TD3 batch cannot be empty.");
    batch.forEach((experience) => {
      this.validateObservation(experience.observation);
      this.validateObservation(experience.nextObservation);
    });
    this.updateCount += 1;
    const observations = tf.tensor2d(batch.map((item) => [...item.observation]), [batch.length, this.config.observationSize]);
    const actions = tf.tensor2d(batch.map((item) => [...this.actionCodec.encode(item.action)]), [batch.length, this.config.actionSize]);
    const rewards = tf.tensor2d(batch.map((item) => [item.reward]), [batch.length, 1]);
    const nextObservations = tf.tensor2d(batch.map((item) => [...item.nextObservation]), [batch.length, this.config.observationSize]);
    const notDone = tf.tensor2d(batch.map((item) => [item.done ? 0 : 1]), [batch.length, 1]);
    const targetQ = tf.tidy(() => {
      const baseActions = this.targetActor.predict(nextObservations) as tf.Tensor2D;
      const noise = tf.randomNormal(baseActions.shape, 0, this.config.policyNoise)
        .clipByValue(-this.config.noiseClip, this.config.noiseClip);
      const smoothedActions = baseActions.add(noise).clipByValue(-1, 1);
      const first = this.targetCritic1.predict([nextObservations, smoothedActions]) as tf.Tensor2D;
      const second = this.targetCritic2.predict([nextObservations, smoothedActions]) as tf.Tensor2D;
      return rewards.add(tf.minimum(first, second).mul(notDone).mul(this.config.gamma)) as tf.Tensor2D;
    });
    try {
      const critic1Loss = this.minimizeCritic(this.critic1, this.critic1Optimizer, observations, actions, targetQ);
      const critic2Loss = this.minimizeCritic(this.critic2, this.critic2Optimizer, observations, actions, targetQ);
      const criticLoss = ((await critic1Loss.data())[0] + (await critic2Loss.data())[0]) / 2;
      critic1Loss.dispose(); critic2Loss.dispose();

      const actorUpdated = this.updateCount % this.config.policyDelay === 0;
      let actorLoss: number | null = null;
      if (actorUpdated) {
        const loss = this.actorOptimizer.minimize(() => tf.tidy(() => {
          const predictedActions = this.actor.apply(observations) as tf.Tensor2D;
          const values = this.critic1.apply([observations, predictedActions]) as tf.Tensor2D;
          return tf.neg(tf.mean(values));
        }), true, trainableVariables(this.actor));
        if (!loss) throw new Error("TD3 actor optimizer did not return a loss.");
        actorLoss = (await loss.data())[0]; loss.dispose();
        this.softUpdate(this.actor, this.targetActor);
        this.softUpdate(this.critic1, this.targetCritic1);
        this.softUpdate(this.critic2, this.targetCritic2);
      }
      return { criticLoss, actorLoss, actorUpdated };
    } finally {
      observations.dispose(); actions.dispose(); rewards.dispose(); nextObservations.dispose(); notDone.dispose(); targetQ.dispose();
    }
  }

  dispose(): void {
    this.models().forEach((model) => model.dispose());
    this.actorOptimizer.dispose(); this.critic1Optimizer.dispose(); this.critic2Optimizer.dispose();
  }

  private models(): tf.LayersModel[] {
    return [this.actor, this.targetActor, this.critic1, this.critic2, this.targetCritic1, this.targetCritic2];
  }

  private minimizeCritic(
    critic: tf.LayersModel,
    optimizer: tf.Optimizer,
    observations: tf.Tensor2D,
    actions: tf.Tensor2D,
    targetQ: tf.Tensor2D,
  ): tf.Scalar {
    const loss = optimizer.minimize(() => tf.tidy(() => {
      const prediction = critic.apply([observations, actions]) as tf.Tensor2D;
      return tf.mean(tf.losses.huberLoss(targetQ, prediction));
    }), true, trainableVariables(critic));
    if (!loss) throw new Error("TD3 critic optimizer did not return a loss.");
    return loss;
  }

  private hardUpdate(source: tf.LayersModel, target: tf.LayersModel): void {
    const weights = source.getWeights().map((weight) => weight.clone());
    try { target.setWeights(weights); } finally { weights.forEach((weight) => weight.dispose()); }
  }

  private softUpdate(source: tf.LayersModel, target: tf.LayersModel): void {
    const sourceWeights = source.getWeights(); const targetWeights = target.getWeights();
    const blended = sourceWeights.map((weight, index) => tf.tidy(() =>
      weight.mul(this.config.tau).add(targetWeights[index].mul(1 - this.config.tau))));
    try { target.setWeights(blended); } finally {
      blended.forEach((weight) => weight.dispose());
    }
  }

  private validateObservation(observation: readonly number[]): void {
    if (observation.length !== this.config.observationSize || observation.some((value) => !Number.isFinite(value))) {
      throw new RangeError(`TD3 expected ${this.config.observationSize} finite observation values.`);
    }
  }
}
