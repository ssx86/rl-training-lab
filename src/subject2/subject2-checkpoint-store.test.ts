import { afterEach, describe, expect, it } from "vitest";
import { Subject2TrainingRuntime } from "./subject2-runtime";
import { SUBJECT2_CHECKPOINT_KEY, loadSubject2Checkpoint, saveSubject2Checkpoint } from "./subject2-checkpoint-store";

describe("subject 2 browser checkpoint store", () => {
  afterEach(() => localStorage.clear());

  it("round-trips typed model weights through localStorage", () => {
    const runtime = new Subject2TrainingRuntime({ seed: 41 });
    const checkpoint = runtime.exportCheckpoint();
    saveSubject2Checkpoint({ savedAt: "2026-10-12T10:00:00.000Z", checkpoint });
    const restored = loadSubject2Checkpoint();
    runtime.dispose();

    expect(restored?.savedAt).toBe("2026-10-12T10:00:00.000Z");
    expect(restored?.checkpoint.stepCount).toBe(0);
    expect(restored?.checkpoint.agent.networks[0][0].values).toBeInstanceOf(Float32Array);
    expect(restored?.checkpoint.agent.networks[0][0].values)
      .toEqual(checkpoint.agent.networks[0][0].values);
  });

  it("ignores a damaged or incompatible local checkpoint", () => {
    localStorage.setItem(SUBJECT2_CHECKPOINT_KEY, "{broken");
    expect(loadSubject2Checkpoint()).toBeNull();
  });
});
