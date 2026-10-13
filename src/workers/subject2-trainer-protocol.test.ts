import { describe, expect, it } from "vitest";
import { shouldAutoCheckpoint, subject2Cadence } from "./subject2-trainer-protocol";

describe("subject 2 trainer cadence", () => {
  it("maps 1x to the real 100 ms physics clock", () => {
    expect(subject2Cadence(1)).toEqual({ stepsPerBatch: 1, delayMs: 100 });
  });

  it("keeps explicit accelerated modes and an uncapped maximum mode", () => {
    expect(subject2Cadence(4)).toEqual({ stepsPerBatch: 1, delayMs: 25 });
    expect(subject2Cadence(16)).toEqual({ stepsPerBatch: 2, delayMs: 12.5 });
    expect(subject2Cadence("max")).toEqual({ stepsPerBatch: 16, delayMs: 0 });
  });

  it("requests an automatic browser checkpoint every 1,000 completed steps", () => {
    expect(shouldAutoCheckpoint(0, 999)).toBe(false);
    expect(shouldAutoCheckpoint(0, 1_000)).toBe(true);
    expect(shouldAutoCheckpoint(1_000, 1_999)).toBe(false);
    expect(shouldAutoCheckpoint(1_000, 2_000)).toBe(true);
  });
});
