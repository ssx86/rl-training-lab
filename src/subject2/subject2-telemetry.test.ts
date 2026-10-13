import { describe, expect, it } from "vitest";
import { summarizeSubject2Controls } from "./subject2-telemetry";

describe("subject 2 control telemetry", () => {
  it("summarizes recent throttle, brake and stationary shares", () => {
    const summary = summarizeSubject2Controls([
      { throttle: .8, brake: 0, stopped: false },
      { throttle: .2, brake: 0, stopped: false },
      { throttle: 0, brake: .7, stopped: true },
      { throttle: 0, brake: 0, stopped: true },
    ]);
    expect(summary).toEqual({ throttlePercent: 50, brakePercent: 25, stationaryPercent: 50 });
  });

  it("returns zeros before training has produced samples", () => {
    expect(summarizeSubject2Controls([])).toEqual({ throttlePercent: 0, brakePercent: 0, stationaryPercent: 0 });
  });
});
