import { describe, expect, it } from "vitest";

import {
  commandRequiresRuntime,
  createTrainerEnvelope,
  isDrivingTrainerCommand,
} from "./driving-trainer-protocol";

describe("driving trainer worker protocol", () => {
  it("adds schema, mode and monotonic sequence to worker messages", () => {
    const envelope = createTrainerEnvelope(
      "training",
      4,
      { type: "status", status: "running" },
    );

    expect(envelope).toMatchObject({
      schemaVersion: "driving-v3",
      mode: "training",
      sequence: 4,
      payload: { type: "status", status: "running" },
    });
  });

  it("rejects malformed commands at the worker boundary", () => {
    expect(
      isDrivingTrainerCommand({ type: "start", mode: "training", level: "L1" }),
    ).toBe(true);
    expect(
      isDrivingTrainerCommand({ type: "start", mode: "manual", level: "L1" }),
    ).toBe(false);
    expect(isDrivingTrainerCommand({ type: "unknown" })).toBe(false);
    expect(isDrivingTrainerCommand(null)).toBe(false);
  });

  it("allows reset and dispose before a trainer has been created", () => {
    expect(commandRequiresRuntime({ type: "reset", level: "L1" })).toBe(false);
    expect(commandRequiresRuntime({ type: "dispose" })).toBe(false);
    expect(commandRequiresRuntime({ type: "pause" })).toBe(false);
  });
});
