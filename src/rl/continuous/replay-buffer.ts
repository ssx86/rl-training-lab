import type { ContinuousDrivingAction } from "@/driving/continuous-control";
import type { ContinuousExperience } from "./td3-agent";

function cloneExperience<TAction extends object>(experience: ContinuousExperience<TAction>): ContinuousExperience<TAction> {
  return {
    ...experience,
    observation: [...experience.observation],
    nextObservation: [...experience.nextObservation],
    action: { ...experience.action },
  };
}

export class ContinuousReplayBuffer<TAction extends object = ContinuousDrivingAction> {
  private readonly experiences: ContinuousExperience<TAction>[] = [];

  constructor(readonly capacity = 50_000) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError("Replay capacity must be positive.");
  }

  get size(): number { return this.experiences.length; }

  add(experience: ContinuousExperience<TAction>): void {
    this.experiences.push(cloneExperience(experience));
    if (this.experiences.length > this.capacity) this.experiences.shift();
  }

  sample(batchSize: number, random: () => number = Math.random): ContinuousExperience<TAction>[] {
    if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > this.size) throw new RangeError("Invalid continuous replay sample size.");
    const candidates = this.experiences.map((_, index) => index);
    return Array.from({ length: batchSize }, () => {
      const candidateIndex = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
      const [experienceIndex] = candidates.splice(candidateIndex, 1);
      return cloneExperience(this.experiences[experienceIndex]);
    });
  }
}
