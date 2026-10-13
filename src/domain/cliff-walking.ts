export const ROWS = 10;
export const COLUMNS = 16;
export const STATE_COUNT = ROWS * COLUMNS;
export const START_STATE = (ROWS - 1) * COLUMNS;
export const GOAL_STATE = COLUMNS - 1;

export const REWARDS = {
  STEP: -1,
  MUD: -3,
  COLLISION: -4,
  CLIFF: -60,
  GOAL: 30,
} as const;

export const ACTIONS = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 } as const;
export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
export type Terrain = "plain" | "mud" | "wall" | "cliff" | "start" | "goal";
export type TransitionEvent = "move" | "mud" | "boundary" | "wall" | "cliff" | "goal";

export const ACTION_LABELS: Record<Action, string> = {
  [ACTIONS.UP]: "上",
  [ACTIONS.RIGHT]: "右",
  [ACTIONS.DOWN]: "下",
  [ACTIONS.LEFT]: "左",
};

export const EVENT_LABELS: Record<TransitionEvent, string> = {
  move: "普通移动",
  mud: "进入泥地",
  boundary: "撞到地图边界",
  wall: "撞到墙体",
  cliff: "掉入悬崖并返回起点",
  goal: "到达目标",
};

export interface Position { state: number; row: number; column: number }

export interface Transition {
  state: number;
  action: Action;
  reward: number;
  nextState: number;
  done: boolean;
  fell: boolean;
  collision: boolean;
  event: TransitionEvent;
}

function stateAt(row: number, column: number): number {
  return row * COLUMNS + column;
}

const WALL_STATES = new Set([
  ...[3, 4, 5, 6, 7].map((column) => stateAt(1, column)),
  ...[9, 10, 11, 12, 13].map((column) => stateAt(3, column)),
  ...[2, 3, 4, 5].map((column) => stateAt(5, column)),
  ...[10, 11, 12, 13].map((column) => stateAt(7, column)),
]);

const CLIFF_STATES = new Set([
  ...[7, 8, 9].map((column) => stateAt(6, column)),
  ...[2, 3, 4, 5, 6, 7].map((column) => stateAt(8, column)),
]);

const MUD_STATES = new Set([
  ...[11, 12, 13, 14].map((column) => stateAt(1, column)),
  ...[2, 3, 4].map((column) => stateAt(2, column)),
  ...[5, 6, 7].map((column) => stateAt(4, column)),
  ...[13, 14].map((column) => stateAt(5, column)),
  ...[1, 8, 9].map((column) => stateAt(9, column)),
]);

export function stateToPosition(state: number): Position {
  return { state, row: Math.floor(state / COLUMNS), column: state % COLUMNS };
}

export function isCliffState(state: number): boolean { return CLIFF_STATES.has(state); }
export function isWallState(state: number): boolean { return WALL_STATES.has(state); }
export function isMudState(state: number): boolean { return MUD_STATES.has(state); }

export function isReachableState(state: number): boolean {
  return state >= 0 && state < STATE_COUNT && !isCliffState(state) && !isWallState(state);
}

export function terrainForState(state: number): Terrain {
  if (state === START_STATE) return "start";
  if (state === GOAL_STATE) return "goal";
  if (isCliffState(state)) return "cliff";
  if (isWallState(state)) return "wall";
  if (isMudState(state)) return "mud";
  return "plain";
}

export class CliffWalkingEnvironment {
  private currentState = START_STATE;

  reset(): Position {
    this.currentState = START_STATE;
    return stateToPosition(this.currentState);
  }

  get position(): Position { return stateToPosition(this.currentState); }

  step(action: Action): Transition {
    const state = this.currentState;
    const { row, column } = stateToPosition(state);
    const [rowDelta, columnDelta] = this.deltaFor(action);
    const candidateRow = row + rowDelta;
    const candidateColumn = column + columnDelta;
    const outside = candidateRow < 0 || candidateRow >= ROWS || candidateColumn < 0 || candidateColumn >= COLUMNS;

    if (outside) return this.transition(state, action, REWARDS.COLLISION, state, "boundary", false, true);

    const candidateState = stateAt(candidateRow, candidateColumn);
    if (isWallState(candidateState)) return this.transition(state, action, REWARDS.COLLISION, state, "wall", false, true);

    if (isCliffState(candidateState)) {
      this.currentState = START_STATE;
      return this.transition(state, action, REWARDS.CLIFF, START_STATE, "cliff", true, false);
    }

    this.currentState = candidateState;
    if (candidateState === GOAL_STATE) return this.transition(state, action, REWARDS.GOAL, candidateState, "goal", false, false, true);
    if (isMudState(candidateState)) return this.transition(state, action, REWARDS.MUD, candidateState, "mud", false, false);
    return this.transition(state, action, REWARDS.STEP, candidateState, "move", false, false);
  }

  setStateForTesting(state: number): void {
    if (!isReachableState(state)) throw new RangeError("State must be a reachable grid cell.");
    this.currentState = state;
  }

  private transition(state: number, action: Action, reward: number, nextState: number, event: TransitionEvent, fell: boolean, collision: boolean, done = false): Transition {
    return { state, action, reward, nextState, event, fell, collision, done };
  }

  private deltaFor(action: Action): readonly [number, number] {
    switch (action) {
      case ACTIONS.UP: return [-1, 0];
      case ACTIONS.RIGHT: return [0, 1];
      case ACTIONS.DOWN: return [1, 0];
      case ACTIONS.LEFT: return [0, -1];
    }
  }
}
