import { describe, expect, it } from "vitest";
import { createSubject2Vehicle } from "./subject2-vehicle";
import { interpolateSubject2Vehicle } from "./subject2-display";

describe("subject 2 RAF vehicle interpolation", () => {
  it("interpolates position, speed and actuator positions between physics frames", () => {
    const from = createSubject2Vehicle({ x: 10, y: 20, heading: 0, speed: 0, steer: 0, longitudinalIntent: 0 });
    const to = createSubject2Vehicle({ x: 12, y: 21, heading: .2, speed: 2, steer: .4, longitudinalIntent: .6 });
    const halfway = interpolateSubject2Vehicle(from, to, .5);

    expect(halfway).toMatchObject({ x: 11, y: 20.5, speed: 1, steer: .2, longitudinalIntent: .3 });
    expect(halfway.heading).toBeCloseTo(.1, 6);
  });

  it("uses the shortest angle across the negative-pi boundary", () => {
    const from = createSubject2Vehicle({ x: 0, y: 0, heading: Math.PI - .1 });
    const to = createSubject2Vehicle({ x: 0, y: 0, heading: -Math.PI + .1 });
    const halfway = interpolateSubject2Vehicle(from, to, .5);

    expect(Math.abs(halfway.heading)).toBeCloseTo(Math.PI, 6);
  });
});
