import { describe, expect, it } from "vitest";
import { SUBJECT2_PROJECT_ORDER } from "./subject2-course";
import { generateSubject2Scenario } from "./subject2-scenario";

describe("subject 2 project catalogue", () => {
  it("contains the five current C1 projects without encoding a runtime order", () => {
    expect(new Set(SUBJECT2_PROJECT_ORDER)).toEqual(new Set(["reverse-parking", "side-parking", "ramp", "s-curve", "right-angle"]));
    const sampled = Array.from({ length: 12 }, (_, index) => generateSubject2Scenario(index + 1).project);
    expect(sampled).not.toEqual([...SUBJECT2_PROJECT_ORDER, ...SUBJECT2_PROJECT_ORDER, "reverse-parking", "side-parking"]);
  });

  it("keeps reverse parking on one fixed standard map", () => {
    const variants = Array.from({ length: 20 }, (_, index) => generateSubject2Scenario(index + 20, "reverse-parking"));
    expect(variants.every((scenario) => !scenario.mirrored && scenario.rotationQuarterTurns === 0 && scenario.scale === 1)).toBe(true);
  });
});
