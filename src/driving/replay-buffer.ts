export interface DrivingExperience {
  observation: number[];
  action: number;
  reward: number;
  nextObservation: number[];
  done: boolean;
}

function cloneExperience(experience: DrivingExperience): DrivingExperience {
  return {
    ...experience,
    observation: [...experience.observation],
    nextObservation: [...experience.nextObservation],
  };
}

export class ReplayBuffer {
  private readonly experiences: DrivingExperience[] = [];

  constructor(readonly capacity = 50_000) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("Replay capacity must be a positive integer.");
    }
  }

  get size(): number {
    return this.experiences.length;
  }

  add(experience: DrivingExperience): void {
    this.experiences.push(cloneExperience(experience));
    if (this.experiences.length > this.capacity) {
      this.experiences.shift();
    }
  }

  sample(batchSize: number, random: () => number = Math.random): DrivingExperience[] {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new RangeError("Batch size must be a positive integer.");
    }
    if (batchSize > this.size) {
      throw new RangeError("Cannot sample more experiences than the buffer contains.");
    }

    const candidates = this.experiences.map((_, index) => index);
    return Array.from({ length: batchSize }, () => {
      const candidateIndex = Math.min(
        candidates.length - 1,
        Math.floor(random() * candidates.length),
      );
      const [experienceIndex] = candidates.splice(candidateIndex, 1);
      return cloneExperience(this.experiences[experienceIndex]);
    });
  }

  clear(): void {
    this.experiences.length = 0;
  }

  toArray(): DrivingExperience[] {
    return this.experiences.map(cloneExperience);
  }
}
