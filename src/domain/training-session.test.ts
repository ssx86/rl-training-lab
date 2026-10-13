import { describe, expect, it } from "vitest";
import { ACTIONS, START_STATE } from "./cliff-walking";
import { QTable, selectAction } from "./q-table";
import { TrainingSession } from "./training-session";
import type { QValueUpdater } from "@/exercise/update-q-value";
import type { LearningStrategy } from "./learning-strategy";

describe("QTable", () => {
  it("starts with four zero values for every state", () => {
    const table = new QTable();

    expect(table.valuesFor(36)).toEqual([0, 0, 0, 0]);
    expect(table.maxValue(36)).toBe(0);
  });

  it("round-trips through a JSON-safe matrix", () => {
    const table = new QTable();
    table.set(36, ACTIONS.UP, 2.5);

    const restored = QTable.fromMatrix(table.toMatrix());

    expect(restored.get(36, ACTIONS.UP)).toBe(2.5);
  });
});

describe("selectAction", () => {
  it("marks a random epsilon action as exploration", () => {
    const table = new QTable();

    const selection = selectAction(table, 36, 1, () => 0.4);

    expect(selection).toEqual({ action: ACTIONS.RIGHT, source: "exploration" });
  });

  it("chooses an action with the highest Q value during exploitation", () => {
    const table = new QTable();
    table.set(36, ACTIONS.LEFT, 8);

    const selection = selectAction(table, 36, 0, () => 0.1);

    expect(selection).toEqual({ action: ACTIONS.LEFT, source: "exploitation" });
  });
});

describe("TrainingSession", () => {
  it("writes the custom updater result into the Q table", () => {
    const updater: QValueUpdater = (input) => ({
      newQ: input.oldQ + 3,
      tdTarget: 3,
      tdError: 3,
      implemented: true,
    });
    const session = new TrainingSession({ updater, random: () => 0 });

    const step = session.step({ alpha: 0.1, gamma: 0.9, epsilon: 0 });

    expect(step.newQ).toBe(3);
    expect(session.qTable.get(START_STATE, ACTIONS.UP)).toBe(3);
  });

  it("does not update Q values in exploitation-only mode", () => {
    const updater: QValueUpdater = () => ({
      newQ: 99,
      tdTarget: 99,
      tdError: 99,
      implemented: true,
    });
    const session = new TrainingSession({ updater, random: () => 0 });

    const step = session.step(
      { alpha: 0.1, gamma: 0.9, epsilon: 0 },
      { learn: false },
    );

    expect(step.newQ).toBe(step.oldQ);
    expect(session.qTable.get(START_STATE, ACTIONS.UP)).toBe(0);
  });

  it("accepts a reusable lesson strategy with algorithm-specific signals", () => {
    const strategy: LearningStrategy = {
      id: "sarsa",
      update: ({ oldQ }) => ({
        newQ: oldQ + 2,
        tdTarget: 2,
        tdError: 2,
        nextMaxQ: 0,
        implemented: true,
        signals: { nextAction: "上", sampleSource: "environment" },
      }),
    };
    const session = new TrainingSession({ strategy, random: () => 0 });

    const step = session.step({ alpha: 0.1, gamma: 0.9, epsilon: 0 });

    expect(step.algorithmId).toBe("sarsa");
    expect(step.signals).toEqual({ nextAction: "上", sampleSource: "environment" });
    expect(session.qTable.get(START_STATE, ACTIONS.UP)).toBe(2);
  });

  it("rejects ambiguous updater and strategy configuration", () => {
    const strategy: LearningStrategy = {
      id: "test",
      update: () => ({ newQ: 0, tdTarget: 0, tdError: 0, nextMaxQ: 0, implemented: true, signals: {} }),
    };
    const updater: QValueUpdater = () => ({ newQ: 0, tdTarget: 0, tdError: 0, implemented: true });

    expect(() => new TrainingSession({ strategy, updater })).toThrow("either updater or strategy");
  });
});

