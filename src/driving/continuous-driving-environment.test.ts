import { describe, expect, it } from "vitest";
import type { CityMap } from "./city-map";
import { CONTINUOUS_OBSERVATION_SIZE } from "./continuous-control";
import { ContinuousDrivingEnvironment } from "./continuous-driving-environment";
import type { DrivingMap } from "./maps";

const city: CityMap = {
  id: "continuous-test", name: "Continuous", width: 200, height: 60, roadWidth: 12,
  nodes: [{ id: "a", x: 10, y: 30, label: "A" }, { id: "b", x: 190, y: 30, label: "B" }],
  edges: [{ from: "a", to: "b" }], objects: [], destinationNodeIds: ["a", "b"],
};
const map: DrivingMap = {
  id: "route", width: 200, height: 60, roadHalfWidth: 6, route: city.nodes,
  obstacles: [], start: { x: 10, y: 30, heading: 0 }, goalRadius: 4,
  checkpointFractions: [.25, .5, .75], sensorMaxDistance: 24,
  speedToDistanceScale: 1 / 3.6, wheelBase: 2.75, collisionRadius: 1.55,
};

describe("ContinuousDrivingEnvironment", () => {
  it("accepts proportional steering and pedal values with a 93-value radar observation", () => {
    const environment = new ContinuousDrivingEnvironment(map, city, "b");
    const initial = environment.reset();
    const transition = environment.step({ steer: .27, throttle: .42 });

    expect(initial.vector).toHaveLength(CONTINUOUS_OBSERVATION_SIZE);
    expect(transition.action).toEqual({ steer: .27, throttle: .42 });
    expect(environment.snapshot().steer).toBeCloseTo(.27);
    expect(environment.snapshot().acceleration).toBeCloseTo(.42);
    expect(transition.nextObservation.vector.every(Number.isFinite)).toBe(true);
  });

  it("clamps unsafe actor output to the physical control range", () => {
    const environment = new ContinuousDrivingEnvironment(map, city, "b");
    environment.reset();
    const transition = environment.step({ steer: 8, throttle: -3 });
    expect(transition.action).toEqual({ steer: 1, throttle: -1 });
  });

  it("ends and restarts an unproductive episode before the long timeout", () => {
    const environment = new ContinuousDrivingEnvironment(map, city, "b");
    environment.reset();
    let transition = environment.step({ steer: 0, throttle: 0 });
    for (let index = 1; index < 100 && !transition.done; index += 1) {
      transition = environment.step({ steer: 0, throttle: 0 });
    }

    expect(transition.done).toBe(true);
    expect(transition.event).toBe("stalled");
    expect(transition.stepIndex).toBeLessThan(600);
    expect(transition.rewardBreakdown.stalled).toBeLessThanOrEqual(-12);
  });
});
