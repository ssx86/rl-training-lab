import { describe, expect, it } from "vitest";
import { StratifiedReplayBuffer } from "./stratified-replay-buffer";

const experience = (bucket: number, value: number) => ({
  observation: [bucket, value], action: value, reward: value,
  nextObservation: [bucket, value + 1], done: false,
});

describe("StratifiedReplayBuffer", () => {
  it("samples every populated bucket before taking a second item from one bucket", () => {
    const replay = new StratifiedReplayBuffer<number, string>(["a", "b", "c"], 12);
    for (let index = 0; index < 6; index += 1) replay.add("a", experience(0, index));
    replay.add("b", experience(1, 0));
    replay.add("c", experience(2, 0));
    const sample = replay.sample(6, () => .5);
    expect(new Set(sample.map((item) => item.observation[0]))).toEqual(new Set([0, 1, 2]));
    expect(sample.filter((item) => item.observation[0] === 0)).toHaveLength(4);
  });

  it("enforces a fair per-bucket capacity and reports bucket sizes", () => {
    const replay = new StratifiedReplayBuffer<number, string>(["a", "b"], 4);
    for (let index = 0; index < 5; index += 1) replay.add("a", experience(0, index));
    replay.add("b", experience(1, 0));
    expect(replay.size).toBe(3);
    expect(replay.sizeFor("a")).toBe(2);
    expect(replay.sizeFor("b")).toBe(1);
  });
});
