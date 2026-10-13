import { CONTINUOUS_ACTION_SIZE, CONTINUOUS_OBSERVATION_SIZE } from "@/driving/continuous-control";

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

export function resolveTd3Config(config: Td3Config = {}, defaultActionSize: number = DEFAULTS.actionSize): Required<Td3Config> {
  return {
    observationSize: config.observationSize ?? DEFAULTS.observationSize,
    actionSize: config.actionSize ?? defaultActionSize,
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
}

export function describeTd3Config(config: Td3Config = {}): Td3Description {
  const resolved = resolveTd3Config(config);
  const { observationSize, actionSize, hiddenUnits } = resolved;
  const actorParameters = (observationSize + 1) * hiddenUnits
    + (hiddenUnits + 1) * hiddenUnits
    + (hiddenUnits + 1) * actionSize;
  const criticParametersEach = (observationSize + actionSize + 1) * hiddenUnits
    + (hiddenUnits + 1) * hiddenUnits
    + (hiddenUnits + 1);
  return {
    algorithm: "TD3",
    observationSize,
    actionSize,
    hiddenUnits,
    actorParameters,
    criticParametersEach,
    onlineTrainableParameters: actorParameters + criticParametersEach * 2,
    totalParameters: actorParameters * 2 + criticParametersEach * 4,
    actorLearningRate: resolved.actorLearningRate,
    criticLearningRate: resolved.criticLearningRate,
    gamma: resolved.gamma,
    tau: resolved.tau,
    policyNoise: resolved.policyNoise,
    noiseClip: resolved.noiseClip,
    policyDelay: resolved.policyDelay,
  };
}
