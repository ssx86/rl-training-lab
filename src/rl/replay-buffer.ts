export interface Experience<TAction> {
  readonly observation: readonly number[];
  readonly action: TAction;
  readonly reward: number;
  readonly nextObservation: readonly number[];
  readonly done: boolean;
}

type CloneAction<TAction> = (action: TAction) => TAction;

function cloneFlatAction<TAction>(action: TAction): TAction {
  if (typeof action !== "object" || action === null) return action;
  if (Array.isArray(action)) return [...action] as TAction;
  return { ...action };
}

export class ReplayBuffer<TAction> {
  private readonly experiences: Experience<TAction>[] = [];

  constructor(
    readonly capacity = 50_000,
    private readonly cloneAction: CloneAction<TAction> = cloneFlatAction,
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("Replay capacity must be a positive integer.");
    }
  }

  get size(): number {
    return this.experiences.length;
  }

  add(experience: Experience<TAction>): void {
    this.experiences.push(this.cloneExperience(experience));
    if (this.experiences.length > this.capacity) this.experiences.shift();
  }

  sample(batchSize: number, random: () => number = Math.random): Experience<TAction>[] {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new RangeError("Batch size must be a positive integer.");
    }
    if (batchSize > this.size) {
      throw new RangeError("Cannot sample more experiences than the buffer contains.");
    }

    const candidates = this.experiences.map((_, index) => index);
    return Array.from({ length: batchSize }, () => {
      const candidateIndex = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
      const [experienceIndex] = candidates.splice(candidateIndex, 1);
      return this.cloneExperience(this.experiences[experienceIndex]);
    });
  }

  clear(): void {
    this.experiences.length = 0;
  }

  toArray(): Experience<TAction>[] {
    return this.experiences.map((experience) => this.cloneExperience(experience));
  }

  private cloneExperience(experience: Experience<TAction>): Experience<TAction> {
    return {
      ...experience,
      observation: [...experience.observation],
      action: this.cloneAction(experience.action),
      nextObservation: [...experience.nextObservation],
    };
  }
}
