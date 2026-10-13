import { describe, expect, it } from "vitest";
import {
  EXPERIMENTS,
  GUIDE_BASE_URL,
  LEARNING_LOOP,
  getExperiment,
  experimentFromHash,
} from "./experiment-catalog";

describe("experiment catalog", () => {
  it("maps every runnable experiment to one exact field-guide chapter", () => {
    expect(EXPERIMENTS.map((experiment) => [experiment.id, experiment.guide.slug])).toEqual([
      ["q-learning", "tabular-control"],
      ["dqn-driving", "dqn"],
      ["td3-fleet", "distributed-rl"],
      ["subject-2", "reward-design"],
    ]);

    for (const experiment of EXPERIMENTS) {
      expect(experiment.guide.url).toBe(`${GUIDE_BASE_URL}/${experiment.guide.slug}/`);
      expect(experiment.guide.title.length).toBeGreaterThan(12);
      expect(experiment.guide.reason.length).toBeGreaterThan(20);
    }
  });

  it("gives each experiment the complete evidence-first learning contract", () => {
    expect(LEARNING_LOOP.map((stage) => stage.id)).toEqual([
      "predict",
      "run",
      "inspect",
      "explain",
      "transfer",
    ]);

    for (const experiment of EXPERIMENTS) {
      expect(experiment.prediction.choices).toHaveLength(2);
      expect(experiment.prediction.choices).toContain(experiment.prediction.answer);
      expect(experiment.runInstruction.length).toBeGreaterThan(12);
      expect(experiment.evidenceSignals.length).toBeGreaterThanOrEqual(3);
      expect(experiment.formulas.length).toBeGreaterThan(0);
      expect(experiment.transfer.prompt.length).toBeGreaterThan(12);
      expect(experiment.boundary.length).toBeGreaterThan(20);
    }
  });

  it("keeps route parsing and lookup in the same source of truth", () => {
    expect(experimentFromHash("#/dqn-driving")).toBe("dqn-driving");
    expect(experimentFromHash("#/missing")).toBeNull();
    expect(getExperiment("subject-2").guide.prerequisites).toContain("continuous-control");
  });
});
