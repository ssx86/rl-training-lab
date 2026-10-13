import { describe, expect, it } from "vitest";

import { ReplayBuffer, type DrivingExperience } from "./replay-buffer";

function experience(id: number): DrivingExperience {
  return {
    observation: Array.from({ length: 12 }, () => id),
    action: id % 9,
    reward: id,
    nextObservation: Array.from({ length: 12 }, () => id + 1),
    done: false,
  };
}

describe("ReplayBuffer", () => {
  it("retains only the newest experiences at capacity", () => {
    const buffer = new ReplayBuffer(3);
    [0, 1, 2, 3].forEach((id) => buffer.add(experience(id)));

    expect(buffer.size).toBe(3);
    expect(buffer.toArray().map((item) => item.reward)).toEqual([1, 2, 3]);
  });

  it("samples deterministically with an injected random source", () => {
    const buffer = new ReplayBuffer(5);
    [0, 1, 2, 3, 4].forEach((id) => buffer.add(experience(id)));
    const randomValues = [0.9, 0.1, 0.5];
    let index = 0;

    const sample = buffer.sample(3, () => randomValues[index++]);

    expect(sample.map((item) => item.reward)).toEqual([4, 0, 2]);
    expect(new Set(sample).size).toBe(3);
  });

  it("does not expose mutable copies of stored transitions", () => {
    const buffer = new ReplayBuffer(2);
    const input = experience(1);
    buffer.add(input);
    input.observation[0] = 99;

    expect(buffer.toArray()[0].observation[0]).toBe(1);
  });
});
