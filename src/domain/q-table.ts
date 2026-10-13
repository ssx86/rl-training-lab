import { ACTIONS, STATE_COUNT, type Action } from "./cliff-walking";

const ACTION_COUNT = 4;
export type ActionSource = "exploration" | "exploitation";
export interface ActionSelection { action: Action; source: ActionSource }

export class QTable {
  private readonly values: Float64Array;

  constructor(initialValues?: Iterable<number>) {
    this.values = initialValues ? new Float64Array(initialValues) : new Float64Array(STATE_COUNT * ACTION_COUNT);
    if (this.values.length !== STATE_COUNT * ACTION_COUNT) {
      throw new RangeError(`Q table must contain ${STATE_COUNT} states with ${ACTION_COUNT} actions each.`);
    }
  }

  get(state: number, action: Action): number { return this.values[this.indexOf(state, action)]; }

  set(state: number, action: Action, value: number): void {
    if (!Number.isFinite(value)) throw new TypeError("Q values must be finite numbers.");
    this.values[this.indexOf(state, action)] = value;
  }

  valuesFor(state: number): [number, number, number, number] {
    this.assertState(state);
    const offset = state * ACTION_COUNT;
    return [this.values[offset], this.values[offset + 1], this.values[offset + 2], this.values[offset + 3]];
  }

  maxValue(state: number): number { return Math.max(...this.valuesFor(state)); }

  greedyActions(state: number): Action[] {
    const values = this.valuesFor(state);
    const maximum = Math.max(...values);
    return values.map((value, action) => ({ value, action: action as Action })).filter(({ value }) => value === maximum).map(({ action }) => action);
  }

  reset(): void { this.values.fill(0); }

  toMatrix(): number[][] {
    return Array.from({ length: STATE_COUNT }, (_, state) => [...this.valuesFor(state)]);
  }

  static fromMatrix(matrix: number[][]): QTable {
    if (matrix.length !== STATE_COUNT || matrix.some((row) => row.length !== ACTION_COUNT)) {
      throw new RangeError(`Imported Q table must have shape ${STATE_COUNT} x ${ACTION_COUNT}.`);
    }
    return new QTable(matrix.flat());
  }

  private indexOf(state: number, action: Action): number {
    this.assertState(state);
    if (action < ACTIONS.UP || action > ACTIONS.LEFT) throw new RangeError("Action must be between 0 and 3.");
    return state * ACTION_COUNT + action;
  }

  private assertState(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state >= STATE_COUNT) {
      throw new RangeError(`State must be an integer between 0 and ${STATE_COUNT - 1}.`);
    }
  }
}

export function selectAction(qTable: QTable, state: number, epsilon: number, random: () => number = Math.random): ActionSelection {
  if (random() < epsilon) return { action: Math.floor(random() * ACTION_COUNT) as Action, source: "exploration" };
  const candidates = qTable.greedyActions(state);
  return { action: candidates[Math.floor(random() * candidates.length)], source: "exploitation" };
}
