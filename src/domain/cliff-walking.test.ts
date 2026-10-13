import { describe, expect, it } from "vitest";
import { ACTIONS, CliffWalkingEnvironment, GOAL_STATE, isReachableState, REWARDS, START_STATE, STATE_COUNT, type Action } from "./cliff-walking";

describe("Canyon navigation environment", () => {
  it("starts in the bottom-left cell of the 10 x 16 map", () => {
    const environment = new CliffWalkingEnvironment();
    expect(environment.reset()).toEqual({ state: START_STATE, row: 9, column: 0 });
  });

  it("charges the normal movement cost on plain terrain", () => {
    const environment = new CliffWalkingEnvironment();
    const transition = environment.step(ACTIONS.UP);
    expect(transition).toMatchObject({ state: START_STATE, reward: REWARDS.STEP, nextState: 128, event: "move", collision: false });
  });

  it("charges a stronger penalty and stays in place at the map boundary", () => {
    const environment = new CliffWalkingEnvironment();
    const transition = environment.step(ACTIONS.LEFT);
    expect(transition).toMatchObject({ reward: REWARDS.COLLISION, nextState: START_STATE, event: "boundary", collision: true });
  });

  it("charges a stronger penalty and stays in place when hitting a wall", () => {
    const environment = new CliffWalkingEnvironment();
    environment.setStateForTesting(18);
    const transition = environment.step(ACTIONS.RIGHT);
    expect(transition).toMatchObject({ reward: REWARDS.COLLISION, nextState: 18, event: "wall", collision: true });
  });

  it("returns to the start after entering a cliff", () => {
    const environment = new CliffWalkingEnvironment();
    environment.setStateForTesting(129);
    const transition = environment.step(ACTIONS.RIGHT);
    expect(transition).toMatchObject({ reward: REWARDS.CLIFF, nextState: START_STATE, event: "cliff", fell: true });
  });

  it("uses a higher traversal cost for mud", () => {
    const environment = new CliffWalkingEnvironment();
    const transition = environment.step(ACTIONS.RIGHT);
    expect(transition).toMatchObject({ reward: REWARDS.MUD, nextState: 145, event: "mud" });
  });

  it("ends with a positive reward at the goal", () => {
    const environment = new CliffWalkingEnvironment();
    environment.setStateForTesting(GOAL_STATE - 1);
    const transition = environment.step(ACTIONS.RIGHT);
    expect(transition).toMatchObject({ nextState: GOAL_STATE, reward: REWARDS.GOAL, event: "goal", done: true });
  });

  it("offers multiple shortest safe routes whose shaped return stays positive", () => {
    const result = shortestSafeRoutes();

    expect(result.distance).toBe(24);
    expect(result.routeCount).toBeGreaterThan(1);
    expect(result.bestReturn).toBeGreaterThan(0);
  });
});

function shortestSafeRoutes() {
  const distances = Array<number>(STATE_COUNT).fill(Number.POSITIVE_INFINITY);
  const routeCounts = Array<number>(STATE_COUNT).fill(0);
  const bestReturns = Array<number>(STATE_COUNT).fill(Number.NEGATIVE_INFINITY);
  const queue = [START_STATE];
  distances[START_STATE] = 0;
  routeCounts[START_STATE] = 1;
  bestReturns[START_STATE] = 0;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const state = queue[cursor];
    for (const action of Object.values(ACTIONS) as Action[]) {
      const environment = new CliffWalkingEnvironment();
      environment.setStateForTesting(state);
      const transition = environment.step(action);
      if (!isReachableState(transition.nextState) || transition.nextState === state || transition.fell) continue;

      const distance = distances[state] + 1;
      const candidateReturn = bestReturns[state] + transition.reward;
      if (distance < distances[transition.nextState]) {
        distances[transition.nextState] = distance;
        routeCounts[transition.nextState] = routeCounts[state];
        bestReturns[transition.nextState] = candidateReturn;
        queue.push(transition.nextState);
      } else if (distance === distances[transition.nextState]) {
        routeCounts[transition.nextState] = Math.min(2, routeCounts[transition.nextState] + routeCounts[state]);
        bestReturns[transition.nextState] = Math.max(bestReturns[transition.nextState], candidateReturn);
      }
    }
  }

  return {
    distance: distances[GOAL_STATE],
    routeCount: routeCounts[GOAL_STATE],
    bestReturn: bestReturns[GOAL_STATE],
  };
}
