export const ROWS = 4;
export const COLUMNS = 12;
export const START_STATE = 36;
export const GOAL_STATE = 47;

export const ACTIONS = {
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export const ACTION_LABELS: Record<Action, string> = {
  [ACTIONS.UP]: "上",
  [ACTIONS.RIGHT]: "右",
  [ACTIONS.DOWN]: "下",
  [ACTIONS.LEFT]: "左",
};

export interface Position {
  state: number;
  row: number;
  column: number;
}

export interface Transition {
  state: number;
  action: Action;
  reward: number;
  nextState: number;
  done: boolean;
  fell: boolean;
}

export function stateToPosition(state: number): Position {
  return {
    state,
    row: Math.floor(state / COLUMNS),
    column: state % COLUMNS,
  };
}

export function isCliffState(state: number): boolean {
  const { row, column } = stateToPosition(state);
  return row === ROWS - 1 && column > 0 && column < COLUMNS - 1;
}

export class CliffWalkingEnvironment {
  private currentState = START_STATE;

  reset(): Position {
    this.currentState = START_STATE;
    return stateToPosition(this.currentState);
  }

  get position(): Position {
    return stateToPosition(this.currentState);
  }

  step(action: Action): Transition {
    const state = this.currentState;
    const { row, column } = stateToPosition(state);
    const [rowDelta, columnDelta] = this.deltaFor(action);
    const nextRow = Math.min(ROWS - 1, Math.max(0, row + rowDelta));
    const nextColumn = Math.min(COLUMNS - 1, Math.max(0, column + columnDelta));
    const candidateState = nextRow * COLUMNS + nextColumn;
    const fell = isCliffState(candidateState);

    this.currentState = fell ? START_STATE : candidateState;

    return {
      state,
      action,
      reward: fell ? -100 : -1,
      nextState: this.currentState,
      done: this.currentState === GOAL_STATE,
      fell,
    };
  }

  setStateForTesting(state: number): void {
    if (state < 0 || state >= ROWS * COLUMNS || isCliffState(state)) {
      throw new RangeError("State must be a reachable grid cell.");
    }
    this.currentState = state;
  }

  private deltaFor(action: Action): readonly [number, number] {
    switch (action) {
      case ACTIONS.UP:
        return [-1, 0];
      case ACTIONS.RIGHT:
        return [0, 1];
      case ACTIONS.DOWN:
        return [1, 0];
      case ACTIONS.LEFT:
        return [0, -1];
    }
  }
}

