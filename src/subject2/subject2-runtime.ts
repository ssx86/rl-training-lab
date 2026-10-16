import { StratifiedReplayBuffer } from "@/rl/stratified-replay-buffer";
import { Td3Agent, type Td3AgentState } from "@/rl/continuous/td3-agent";
import { describeTd3Config, type Td3Description } from "@/rl/continuous/td3-config";
import { SUBJECT2_PROJECT_ORDER, type Subject2PoseCheckpoint, type Subject2Project, type Subject2Scenario } from "./subject2-course";
import { Subject2Environment, SUBJECT2_OBSERVATION_SIZE, type Subject2Observation, type Subject2RewardBreakdown, type Subject2TerminalReason } from "./subject2-environment";
import { createSeededRandom, evaluationScenarioSeed, generateSubject2Scenario, trainingScenarioSeed } from "./subject2-scenario";
import { chooseSubject2ExplorationOption, explorationCoverageKey, planSubject2ExplorationOption, subject2ExplorationOptionProbability, type Subject2ExplorationOption } from "./subject2-exploration";
import { SUBJECT2_ACTION_CODEC, SUBJECT2_ACTION_SIZE, type Subject2Action, type Subject2VehicleState } from "./subject2-vehicle";

export type Subject2Mode = "training" | "evaluation";
export type Subject2TrainingScope = "rotation" | "single";
export interface Subject2RuntimeConfig { readonly seed?: number; readonly warmupSteps?: number; readonly batchSize?: number; readonly trainEvery?: number; readonly hiddenUnits?: number; readonly maxScenarioSteps?: number; readonly attemptsPerProject?: number }
export interface Subject2ProjectStats { readonly attempts: number; readonly passes: number; readonly passRate: number; readonly processCompletionRate: number }
export type Subject2StatsByProject = Record<Subject2Project, Subject2ProjectStats>;
export type Subject2CompletedTerminalReason = Exclude<Subject2TerminalReason, null>;
export type Subject2TerminationCounts = Record<Subject2CompletedTerminalReason, number>;

export interface Subject2RuntimeCheckpoint {
  readonly version: 3;
  readonly mode: Subject2Mode;
  readonly stepCount: number;
  readonly episode: number;
  readonly passes: number;
  readonly evaluationAttempts: number;
  readonly checkpointCompletions: number;
  readonly sceneGeneration: number;
  readonly trainingProjectIndex: number;
  readonly trainingScope?: Subject2TrainingScope;
  readonly selectedProject?: Subject2Project;
  readonly projectAttempts: number;
  readonly projectPasses: number;
  readonly updates: number;
  readonly trainingStats: Subject2StatsByProject;
  readonly evaluationStats: Subject2StatsByProject;
  readonly terminationCounts: Subject2TerminationCounts;
  readonly explorationOptionCounts?: Readonly<Record<string, number>>;
  readonly agent: Td3AgentState;
}

export interface Subject2Snapshot {
  readonly mode: Subject2Mode;
  readonly step: number;
  readonly episode: number;
  readonly passes: number;
  readonly evaluationAttempts: number;
  readonly checkpointCompletions: number;
  readonly vehicle: Subject2VehicleState;
  readonly scenario: Subject2Scenario;
  readonly sceneGeneration: number;
  readonly sceneChangedAtStep: number;
  readonly projectAttempts: number;
  readonly projectPasses: number;
  readonly attemptsPerProject: number;
  readonly trainingScope: Subject2TrainingScope;
  readonly selectedProject: Subject2Project;
  readonly checkpoint: Subject2PoseCheckpoint;
  readonly checkpointIndex: number;
  readonly observation: Subject2Observation;
  readonly action: Subject2Action;
  readonly reward: number;
  readonly episodeReward: number;
  readonly rewardBreakdown: Subject2RewardBreakdown;
  readonly checkpointReached: boolean;
  readonly lastTerminalReason: Subject2TerminalReason;
  readonly terminationCounts: Subject2TerminationCounts;
  readonly projectStats: Subject2StatsByProject;
  readonly replaySize: number;
  readonly replayByProject: Record<Subject2Project, number>;
  readonly updates: number;
  readonly criticLoss: number | null;
  readonly actorLoss: number | null;
  readonly explorationNoise: number;
  readonly explorationOption: Subject2ExplorationOption["kind"] | null;
  readonly explorationOptionStepsRemaining: number;
  readonly modelInfo: Td3Description;
  readonly inferenceMs: number;
}

function noiseAt(step: number): number { const progress = Math.min(1, step / 120_000); return .32 + (.04 - .32) * progress; }

function gaussian(random: () => number): number {
  const first = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
}

export function nextSubject2ExplorationNoise(
  previous: readonly number[],
  innovation: readonly number[],
  correlation = .85,
): number[] {
  const innovationScale = Math.sqrt(1 - correlation ** 2);
  return previous.map((value, index) => correlation * value + innovationScale * (innovation[index] ?? 0));
}

const EMPTY_REWARD: Subject2RewardBreakdown = { poseProgress: 0, bayApproachProgress: 0, bayAlignmentProgress: 0, bayOverlapProgress: 0, checkpoint: 0, passBonus: 0, timeCost: 0, inactivity: 0, wrongDirection: 0, unsafeSpeed: 0, controlSmoothness: 0, clearance: 0, collision: 0, outOfBounds: 0, rollback: 0, stableHold: 0, startTimeout: 0, stalled: 0, timeout: 0, total: 0 };
const emptyStats = (): Subject2StatsByProject => Object.fromEntries(SUBJECT2_PROJECT_ORDER.map((project) => [project, { attempts: 0, passes: 0, passRate: 0, processCompletionRate: 0 }])) as unknown as Subject2StatsByProject;
const emptyTerminationCounts = (): Subject2TerminationCounts => ({ passed: 0, collision: 0, "out-of-bounds": 0, rollback: 0, "start-timeout": 0, stalled: 0, timeout: 0 });

export function shouldAdvanceTrainingProject(completedAttempts: number, attemptsPerProject: number): boolean {
  return completedAttempts >= attemptsPerProject;
}

export function shouldUseProjectWarmup(projectSamples: number, warmupSteps: number): boolean {
  return projectSamples < warmupSteps;
}

export class Subject2TrainingRuntime {
  private readonly baseSeed: number;
  private readonly environment: Subject2Environment;
  private readonly agent: Td3Agent<Subject2Action>;
  private readonly replay = new StratifiedReplayBuffer<Subject2Action, Subject2Project>(SUBJECT2_PROJECT_ORDER, 100_000);
  private readonly random: () => number;
  private readonly warmupSteps: number;
  private readonly batchSize: number;
  private readonly trainEvery: number;
  private readonly maxScenarioSteps: number;
  private readonly attemptsPerProject: number;
  private mode: Subject2Mode = "training";
  private stepCount = 0;
  private episode = 1;
  private passes = 0;
  private evaluationAttempts = 0;
  private checkpointCompletions = 0;
  private sceneGeneration = 0;
  private sceneChangedAtStep = 0;
  private trainingProjectIndex = 0;
  private trainingScope: Subject2TrainingScope = "rotation";
  private selectedProject: Subject2Project = SUBJECT2_PROJECT_ORDER[0];
  private projectAttempts = 0;
  private projectPasses = 0;
  private updates = 0;
  private episodeReward = 0;
  private criticLoss: number | null = null;
  private actorLoss: number | null = null;
  private lastAction: Subject2Action = { steer: 0, longitudinal: 0 };
  private lastReward = 0;
  private lastRewardBreakdown = EMPTY_REWARD;
  private lastCheckpointReached = false;
  private lastTerminalReason: Subject2TerminalReason = null;
  private explorationOption: Subject2ExplorationOption | null = null;
  private explorationOptionStepsRemaining = 0;
  private explorationOptionCounts: Record<string, number> = {};
  private explorationState = Array(SUBJECT2_ACTION_SIZE).fill(0) as number[];
  private inferenceMs = 0;
  private readonly modelInfo: Td3Description;
  private readonly trainingStats = emptyStats();
  private readonly evaluationStats = emptyStats();
  private terminationCounts = emptyTerminationCounts();

  constructor(config: Subject2RuntimeConfig = {}) {
    this.baseSeed = config.seed ?? 17;
    this.random = createSeededRandom(this.baseSeed);
    this.warmupSteps = config.warmupSteps ?? 500;
    this.batchSize = config.batchSize ?? 64;
    this.trainEvery = config.trainEvery ?? 4;
    this.maxScenarioSteps = config.maxScenarioSteps ?? 1_600;
    this.attemptsPerProject = Math.max(1, Math.floor(config.attemptsPerProject ?? 100));
    const scenario = generateSubject2Scenario(trainingScenarioSeed(this.baseSeed, 0), SUBJECT2_PROJECT_ORDER[this.trainingProjectIndex]);
    this.environment = new Subject2Environment(scenario, this.maxScenarioSteps);
    this.agent = new Td3Agent<Subject2Action>({ observationSize: SUBJECT2_OBSERVATION_SIZE, actionSize: SUBJECT2_ACTION_SIZE, hiddenUnits: config.hiddenUnits ?? 128, seed: config.seed }, SUBJECT2_ACTION_CODEC);
    this.modelInfo = describeTd3Config({ observationSize: SUBJECT2_OBSERVATION_SIZE, actionSize: SUBJECT2_ACTION_SIZE, hiddenUnits: config.hiddenUnits ?? 128 });
  }

  setMode(mode: Subject2Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.episodeReward = 0;
    this.projectAttempts = 0;
    this.projectPasses = 0;
    if (mode === "training" && this.trainingScope === "rotation") {
      this.trainingProjectIndex = 0;
      this.selectedProject = SUBJECT2_PROJECT_ORDER[0];
    }
    this.advanceScenario();
  }

  setTrainingSelection(scope: Subject2TrainingScope, project: Subject2Project): void {
    if (scope !== "rotation" && scope !== "single") throw new RangeError("未知的科目二训练范围。");
    if (!SUBJECT2_PROJECT_ORDER.includes(project)) throw new RangeError("未知的科目二训练项目。");
    if (scope === this.trainingScope && project === this.selectedProject) return;
    this.trainingScope = scope;
    this.selectedProject = project;
    this.trainingProjectIndex = SUBJECT2_PROJECT_ORDER.indexOf(project);
    this.projectAttempts = 0;
    this.projectPasses = 0;
    if (this.mode === "training") this.advanceScenario();
  }

  private nextSeed(): number {
    return this.mode === "training" ? trainingScenarioSeed(this.baseSeed, this.sceneGeneration) : evaluationScenarioSeed(this.baseSeed, this.sceneGeneration);
  }

  private activeTrainingProject(): Subject2Project {
    return this.trainingScope === "single" ? this.selectedProject : SUBJECT2_PROJECT_ORDER[this.trainingProjectIndex];
  }

  private advanceScenario(): void {
    this.sceneGeneration += 1;
    this.sceneChangedAtStep = this.stepCount;
    this.episode += 1;
    this.episodeReward = 0;
    this.explorationOption = null;
    this.explorationOptionStepsRemaining = 0;
    this.explorationState.fill(0);
    const project = this.mode === "training" ? this.activeTrainingProject() : undefined;
    this.environment.reset(generateSubject2Scenario(this.nextSeed(), project));
  }

  private selectAction(observation: Subject2Observation): Subject2Action {
    if (this.mode === "evaluation") return this.agent.selectAction(observation.vector, 0, this.random);
    const project = this.environment.currentScenario().project;
    if (this.explorationOption && this.explorationOptionStepsRemaining > 0) {
      this.explorationOptionStepsRemaining -= 1;
      return this.explorationOption.action;
    }
    const vehicle = this.environment.snapshot();
    const projectWarmup = shouldUseProjectWarmup(this.replay.sizeFor(project), this.warmupSteps);
    const policyOptionProbability = subject2ExplorationOptionProbability(this.stepCount, vehicle);
    if (projectWarmup || this.random() < policyOptionProbability) {
      const kind = chooseSubject2ExplorationOption(this.explorationOptionCounts, project, vehicle, this.random);
      const key = explorationCoverageKey(project, vehicle, kind);
      this.explorationOptionCounts[key] = (this.explorationOptionCounts[key] ?? 0) + 1;
      this.explorationOption = planSubject2ExplorationOption(kind, vehicle, observation.targetMotion, this.random);
      this.explorationOptionStepsRemaining = this.explorationOption.durationSteps - 1;
      return this.explorationOption.action;
    }
    this.explorationOption = null;
    const policyAction = this.agent.selectAction(observation.vector, 0, this.random);
    const sigma = noiseAt(this.stepCount);
    const innovation = Array.from({ length: SUBJECT2_ACTION_SIZE }, () => gaussian(this.random) * sigma);
    this.explorationState = nextSubject2ExplorationNoise(this.explorationState, innovation);
    const noisy = SUBJECT2_ACTION_CODEC.encode(policyAction).map((value, index) => value + this.explorationState[index]);
    return SUBJECT2_ACTION_CODEC.decode(noisy);
  }

  private recordAttempt(project: Subject2Project, passed: boolean, completedConditions: number, totalConditions: number): void {
    const stats = this.mode === "training" ? this.trainingStats : this.evaluationStats;
    const old = stats[project];
    const attempts = old.attempts + 1;
    const passes = old.passes + (passed ? 1 : 0);
    const completion = Math.max(0, Math.min(1, completedConditions / Math.max(1, totalConditions)));
    stats[project] = { attempts, passes, passRate: passes / attempts, processCompletionRate: (old.processCompletionRate * old.attempts + completion) / attempts };
  }

  exportCheckpoint(): Subject2RuntimeCheckpoint {
    return {
      version: 3,
      mode: this.mode,
      stepCount: this.stepCount,
      episode: this.episode,
      passes: this.passes,
      evaluationAttempts: this.evaluationAttempts,
      checkpointCompletions: this.checkpointCompletions,
      sceneGeneration: this.sceneGeneration,
      trainingProjectIndex: this.trainingProjectIndex,
      trainingScope: this.trainingScope,
      selectedProject: this.selectedProject,
      projectAttempts: this.projectAttempts,
      projectPasses: this.projectPasses,
      updates: this.updates,
      trainingStats: structuredClone(this.trainingStats),
      evaluationStats: structuredClone(this.evaluationStats),
      terminationCounts: structuredClone(this.terminationCounts),
      explorationOptionCounts: structuredClone(this.explorationOptionCounts),
      agent: this.agent.exportState(),
    };
  }

  importCheckpoint(checkpoint: Subject2RuntimeCheckpoint): void {
    if (checkpoint.version !== 3 || checkpoint.trainingProjectIndex < 0 || checkpoint.trainingProjectIndex >= SUBJECT2_PROJECT_ORDER.length) {
      throw new RangeError("科目二模型存档版本或项目位置不兼容。");
    }
    const trainingScope = checkpoint.trainingScope ?? "rotation";
    const selectedProject = checkpoint.selectedProject ?? SUBJECT2_PROJECT_ORDER[checkpoint.trainingProjectIndex];
    if ((trainingScope !== "rotation" && trainingScope !== "single") || !SUBJECT2_PROJECT_ORDER.includes(selectedProject)) {
      throw new RangeError("科目二模型存档的训练范围不兼容。");
    }
    const explorationOptionCounts = checkpoint.explorationOptionCounts ?? {};
    if (Object.values(explorationOptionCounts).some((count) => !Number.isFinite(count) || count < 0)) {
      throw new RangeError("科目二模型存档的探索覆盖计数无效。");
    }
    this.agent.importState(checkpoint.agent);
    this.mode = checkpoint.mode;
    this.stepCount = checkpoint.stepCount;
    this.episode = checkpoint.episode;
    this.passes = checkpoint.passes;
    this.evaluationAttempts = checkpoint.evaluationAttempts;
    this.checkpointCompletions = checkpoint.checkpointCompletions;
    this.sceneGeneration = checkpoint.sceneGeneration;
    this.sceneChangedAtStep = checkpoint.stepCount;
    this.trainingProjectIndex = checkpoint.trainingProjectIndex;
    this.trainingScope = trainingScope;
    this.selectedProject = selectedProject;
    this.projectAttempts = checkpoint.projectAttempts;
    this.projectPasses = checkpoint.projectPasses;
    this.updates = checkpoint.updates;
    Object.assign(this.trainingStats, structuredClone(checkpoint.trainingStats));
    Object.assign(this.evaluationStats, structuredClone(checkpoint.evaluationStats));
    this.terminationCounts = structuredClone(checkpoint.terminationCounts);
    this.explorationOptionCounts = structuredClone(explorationOptionCounts);
    this.episodeReward = 0;
    this.lastAction = { steer: 0, longitudinal: 0 };
    this.lastReward = 0;
    this.lastRewardBreakdown = EMPTY_REWARD;
    this.lastCheckpointReached = false;
    this.lastTerminalReason = null;
    this.criticLoss = null;
    this.actorLoss = null;
    this.explorationOption = null;
    this.explorationOptionStepsRemaining = 0;
    this.explorationState.fill(0);
    const project = this.mode === "training" ? this.activeTrainingProject() : undefined;
    this.environment.reset(generateSubject2Scenario(this.nextSeed(), project));
  }

  async step(): Promise<Subject2Snapshot> {
    const observation = this.environment.observe();
    const attemptedProject = this.environment.currentScenario().project;
    const attemptedCheckpointIndex = this.environment.currentCheckpointIndex();
    const totalConditions = this.environment.currentScenario().checkpoints.length;
    const inferenceStartedAt = performance.now();
    const action = this.selectAction(observation);
    const inferenceElapsed = performance.now() - inferenceStartedAt;
    this.inferenceMs = this.inferenceMs === 0 ? inferenceElapsed : this.inferenceMs * .9 + inferenceElapsed * .1;
    const result = this.environment.step(action);
    this.stepCount += 1;
    this.episodeReward += result.reward;
    this.lastAction = action;
    this.lastReward = result.reward;
    this.lastRewardBreakdown = result.rewardBreakdown;
    this.lastCheckpointReached = result.checkpointReached;
    if (result.terminalReason) this.lastTerminalReason = result.terminalReason;
    if (result.checkpointReached) this.checkpointCompletions += 1;

    if (this.mode === "training") {
      this.replay.add(attemptedProject, { observation: observation.vector, action, reward: result.reward, nextObservation: result.observation.vector, done: result.done });
      if (this.replay.size >= Math.max(this.warmupSteps, this.batchSize) && this.stepCount % this.trainEvery === 0) {
        const trained = await this.agent.trainBatch(this.replay.sample(this.batchSize, this.random));
        this.criticLoss = trained.criticLoss;
        this.actorLoss = trained.actorLoss ?? this.actorLoss;
        this.updates += 1;
      }
    }

    if (result.done) {
      const completedConditions = attemptedCheckpointIndex + (result.checkpointReached ? 1 : 0);
      this.recordAttempt(attemptedProject, result.passed, completedConditions, totalConditions);
      if (result.terminalReason) this.terminationCounts[result.terminalReason] += 1;
      if (this.mode === "evaluation") {
        this.evaluationAttempts += 1;
        if (result.passed) this.passes += 1;
        this.advanceScenario();
      } else {
        this.projectAttempts += 1;
        if (result.passed) this.projectPasses += 1;
        if (this.trainingScope === "rotation" && shouldAdvanceTrainingProject(this.projectAttempts, this.attemptsPerProject)) {
          this.trainingProjectIndex = (this.trainingProjectIndex + 1) % SUBJECT2_PROJECT_ORDER.length;
          this.selectedProject = SUBJECT2_PROJECT_ORDER[this.trainingProjectIndex];
          this.projectAttempts = 0;
          this.projectPasses = 0;
        }
        this.advanceScenario();
      }
    }
    return this.snapshot();
  }

  snapshot(): Subject2Snapshot {
    return {
      mode: this.mode, step: this.stepCount, episode: this.episode, passes: this.passes, evaluationAttempts: this.evaluationAttempts,
      checkpointCompletions: this.checkpointCompletions, vehicle: this.environment.snapshot(), scenario: this.environment.currentScenario(),
      sceneGeneration: this.sceneGeneration, sceneChangedAtStep: this.sceneChangedAtStep,
      projectAttempts: this.projectAttempts, projectPasses: this.projectPasses, attemptsPerProject: this.attemptsPerProject,
      trainingScope: this.trainingScope, selectedProject: this.selectedProject,
      checkpoint: this.environment.currentGoal(),
      checkpointIndex: this.environment.currentCheckpointIndex(), observation: this.environment.observe(), action: this.lastAction,
      reward: this.lastReward, episodeReward: this.episodeReward, rewardBreakdown: this.lastRewardBreakdown,
      checkpointReached: this.lastCheckpointReached, lastTerminalReason: this.lastTerminalReason, terminationCounts: structuredClone(this.terminationCounts),
      projectStats: structuredClone(this.mode === "training" ? this.trainingStats : this.evaluationStats), replaySize: this.replay.size,
      replayByProject: Object.fromEntries(SUBJECT2_PROJECT_ORDER.map((project) => [project, this.replay.sizeFor(project)])) as Record<Subject2Project, number>, updates: this.updates,
      criticLoss: this.criticLoss, actorLoss: this.actorLoss, explorationNoise: this.mode === "training" ? noiseAt(this.stepCount) : 0,
      explorationOption: this.explorationOption?.kind ?? null, explorationOptionStepsRemaining: this.explorationOptionStepsRemaining,
      modelInfo: this.modelInfo, inferenceMs: this.inferenceMs,
    };
  }

  dispose(): void { this.agent.dispose(); }
}
