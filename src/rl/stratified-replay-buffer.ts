import { ReplayBuffer, type Experience } from "./replay-buffer";

export class StratifiedReplayBuffer<TAction, TBucket extends PropertyKey> {
  private readonly buffers: Map<TBucket, ReplayBuffer<TAction>>;

  constructor(readonly buckets: readonly TBucket[], readonly capacity: number) {
    if (buckets.length === 0 || new Set(buckets).size !== buckets.length) {
      throw new RangeError("Replay buckets must be a non-empty unique list.");
    }
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError("Replay capacity must be a positive integer.");
    const perBucketCapacity = Math.max(1, Math.floor(capacity / buckets.length));
    this.buffers = new Map(buckets.map((bucket) => [bucket, new ReplayBuffer<TAction>(perBucketCapacity)]));
  }

  get size(): number {
    return [...this.buffers.values()].reduce((sum, buffer) => sum + buffer.size, 0);
  }

  sizeFor(bucket: TBucket): number {
    return this.requireBucket(bucket).size;
  }

  add(bucket: TBucket, experience: Experience<TAction>): void {
    this.requireBucket(bucket).add(experience);
  }

  sample(batchSize: number, random: () => number = Math.random): Experience<TAction>[] {
    if (!Number.isInteger(batchSize) || batchSize <= 0) throw new RangeError("Batch size must be a positive integer.");
    if (batchSize > this.size) throw new RangeError("Cannot sample more experiences than the buffer contains.");
    const pools = this.buckets
      .map((bucket) => this.requireBucket(bucket).toArray())
      .filter((pool) => pool.length > 0);
    const result: Experience<TAction>[] = [];
    while (result.length < batchSize) {
      for (const pool of pools) {
        if (result.length >= batchSize) break;
        if (pool.length === 0) continue;
        const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
        result.push(pool.splice(index, 1)[0]);
      }
    }
    return result;
  }

  private requireBucket(bucket: TBucket): ReplayBuffer<TAction> {
    const buffer = this.buffers.get(bucket);
    if (!buffer) throw new RangeError(`Unknown replay bucket: ${String(bucket)}`);
    return buffer;
  }
}
