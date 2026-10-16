import { describe, expect, it } from "vitest";
import {
  shouldAutoCheckpoint,
  shouldPublishSubject2Snapshot,
  subject2Cadence,
  subject2DisplayInterpolationMs,
  type Subject2Command,
} from "./subject2-trainer-protocol";

describe("subject 2 trainer cadence", () => {
  it("maps 1x to the real 100 ms physics clock", () => {
    expect(subject2Cadence(1)).toEqual({ stepsPerBatch: 1, delayMs: 100 });
  });

  it("keeps explicit accelerated modes and an uncapped maximum mode", () => {
    expect(subject2Cadence(4)).toEqual({ stepsPerBatch: 1, delayMs: 25 });
    expect(subject2Cadence(16)).toEqual({ stepsPerBatch: 2, delayMs: 12.5 });
    expect(subject2Cadence("max")).toEqual({ stepsPerBatch: 16, delayMs: 0 });
  });

  it("keeps every capped speed interpolated and reserves sampling for MAX", () => {
    expect(subject2DisplayInterpolationMs(1)).toBe(100);
    expect(subject2DisplayInterpolationMs(4)).toBe(25);
    expect(subject2DisplayInterpolationMs(16)).toBeCloseTo(1_000 / 60);
    expect(subject2DisplayInterpolationMs("max")).toBe(0);

    expect(shouldPublishSubject2Snapshot(1, 1_000, 1_001)).toBe(true);
    expect(shouldPublishSubject2Snapshot(4, 1_000, 1_001)).toBe(true);
    expect(shouldPublishSubject2Snapshot(16, 1_000, 1_001)).toBe(true);
    expect(shouldPublishSubject2Snapshot("max", 1_000, 1_099)).toBe(false);
    expect(shouldPublishSubject2Snapshot("max", 1_000, 1_100)).toBe(true);
  });

  it("requests an automatic browser checkpoint every 1,000 completed steps", () => {
    expect(shouldAutoCheckpoint(0, 999)).toBe(false);
    expect(shouldAutoCheckpoint(0, 1_000)).toBe(true);
    expect(shouldAutoCheckpoint(1_000, 1_999)).toBe(false);
    expect(shouldAutoCheckpoint(1_000, 2_000)).toBe(true);
  });

  it("carries an explicit scope and subject when training selection changes", () => {
    const command = { type: "set-training-selection", scope: "single", project: "reverse-parking" } satisfies Subject2Command;
    expect(command).toEqual({ type: "set-training-selection", scope: "single", project: "reverse-parking" });
  });

  it("can initialize a new runtime with a selection made before training starts", () => {
    const command = { type: "start", mode: "training", speed: "max", seed: 17, trainingScope: "single", selectedProject: "s-curve" } satisfies Subject2Command;
    expect(command.trainingScope).toBe("single");
    expect(command.selectedProject).toBe("s-curve");
  });
});
