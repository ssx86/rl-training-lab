import { describe, expect, it } from "vitest";
import { ACTIONS, CliffWalkingEnvironment } from "./cliff-walking";

describe("CliffWalkingEnvironment", () => {
  it("starts at state 36 in the bottom-left cell", () => {
    const environment = new CliffWalkingEnvironment();

    expect(environment.reset()).toEqual({ state: 36, row: 3, column: 0 });
  });

  it("moves through safe cells with a reward of -1", () => {
    const environment = new CliffWalkingEnvironment();
    environment.reset();

    const transition = environment.step(ACTIONS.UP);

    expect(transition).toMatchObject({
      state: 36,
      action: ACTIONS.UP,
      reward: -1,
      nextState: 24,
      done: false,
      fell: false,
    });
  });

  it("returns to the start with a -100 reward after entering the cliff", () => {
    const environment = new CliffWalkingEnvironment();
    environment.reset();

    const transition = environment.step(ACTIONS.RIGHT);

    expect(transition).toMatchObject({
      reward: -100,
      nextState: 36,
      done: false,
      fell: true,
    });
  });

  it("keeps the agent inside the grid", () => {
    const environment = new CliffWalkingEnvironment();
    environment.reset();

    const transition = environment.step(ACTIONS.LEFT);

    expect(transition.nextState).toBe(36);
    expect(transition.reward).toBe(-1);
  });

  it("ends the episode when the agent reaches the goal", () => {
    const environment = new CliffWalkingEnvironment();
    environment.setStateForTesting(35);

    const transition = environment.step(ACTIONS.DOWN);

    expect(transition).toMatchObject({
      nextState: 47,
      reward: -1,
      done: true,
      fell: false,
    });
  });
});

