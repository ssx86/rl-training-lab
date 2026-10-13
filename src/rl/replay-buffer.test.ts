import { describe, expect, it } from "vitest";
import { ReplayBuffer, type Experience } from "./replay-buffer";

function transition<TAction>(id: number, action: TAction): Experience<TAction> {
  return {
    observation: [id, id + 0.1],
    action,
    reward: id,
    nextObservation: [id + 1, id + 1.1],
    done: false,
  };
}

describe("generic ReplayBuffer", () => {
  it("supports scalar DQN actions and evicts the oldest experience", () => {
    const buffer = new ReplayBuffer<number>(2);
    buffer.add(transition(1, 3));
    buffer.add(transition(2, 4));
    buffer.add(transition(3, 5));

    expect(buffer.toArray().map((item) => item.reward)).toEqual([2, 3]);
    expect(buffer.toArray().map((item) => item.action)).toEqual([4, 5]);
  });

  it("supports object TD3 actions without leaking mutable references", () => {
    const action = { steer: 0.25, throttle: -0.4 };
    const observation = [1, 1.1];
    const experience: Experience<typeof action> = { ...transition(1, action), observation };
    const buffer = new ReplayBuffer<typeof action>(4);
    buffer.add(experience);

    action.steer = 1;
    observation[0] = 99;
    const stored = buffer.toArray()[0];
    expect(stored.action).toEqual({ steer: 0.25, throttle: -0.4 });
    expect(stored.observation).toEqual([1, 1.1]);

    stored.action.throttle = 1;
    expect(buffer.toArray()[0].action.throttle).toBe(-0.4);
  });

  it("samples without replacement and rejects invalid requests", () => {
    const buffer = new ReplayBuffer<number>(3);
    buffer.add(transition(1, 0));
    buffer.add(transition(2, 1));
    buffer.add(transition(3, 2));

    expect(buffer.sample(3, () => 0).map((item) => item.reward)).toEqual([1, 2, 3]);
    expect(() => buffer.sample(4)).toThrow(/more experiences/i);
    expect(() => new ReplayBuffer(0)).toThrow(/positive integer/i);
  });
});
