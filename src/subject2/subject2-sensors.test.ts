import { describe, expect, it } from "vitest";
import { senseSubject2Course } from "./subject2-sensors";
import { createSubject2Vehicle } from "./subject2-vehicle";

describe("subject 2 all-around sensors", () => {
  it("casts 32 beams over the complete 360 degree body perimeter", () => {
    const scan = senseSubject2Course(createSubject2Vehicle({ x: 20, y: 20, heading: 0 }), [
      { id: "rear-wall", ax: 10, ay: 15, bx: 10, by: 25, kind: "boundary" },
    ]);
    expect(scan.beams).toHaveLength(32);
    expect(scan.beams.some((beam) => beam.relativeAngle < -Math.PI * 0.9)).toBe(true);
    expect(scan.beams.some((beam) => beam.relativeAngle > Math.PI * 0.9)).toBe(true);
    expect(Math.min(...scan.beams.map((beam) => beam.distanceMeters))).toBeLessThan(11);
  });

  it("treats scoring control lines as transparent instead of nearby obstacles", () => {
    const scan = senseSubject2Course(createSubject2Vehicle({ x: 20, y: 20, heading: 0 }), [
      { id: "future-control", ax: 24, ay: 15, bx: 24, by: 25, kind: "exam-line" },
      { id: "real-edge", ax: 30, ay: 15, bx: 30, by: 25, kind: "boundary" },
    ]);
    const forwardBeam = scan.beams.find((beam) => Math.abs(beam.relativeAngle) < 1e-9)!;
    expect(forwardBeam.distanceMeters).toBeCloseTo(10, 6);
    expect(forwardBeam.hit).toBe("boundary");
  });
});
