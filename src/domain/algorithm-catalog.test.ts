import { describe, expect, it } from "vitest";
import { ALGORITHM_LESSONS, getAlgorithmLesson } from "./algorithm-catalog";

describe("algorithm learning catalog", () => {
  it("gives every implemented course a beginner-readable learning contract", () => {
    for (const id of ["q-learning", "dqn", "td3"] as const) {
      const lesson = getAlgorithmLesson(id);
      expect(lesson.status).toBe("active");
      expect(lesson.formulas.length).toBeGreaterThan(0);
      expect(lesson.concepts).toHaveLength(4);
      expect(lesson.observationGuide.length).toBeGreaterThan(2);
    }
  });

  it("orders the active path from table values to networks to continuous control", () => {
    expect(ALGORITHM_LESSONS.filter((lesson) => lesson.status === "active").map((lesson) => lesson.id)).toEqual([
      "q-learning",
      "dqn",
      "td3",
    ]);
  });
});
