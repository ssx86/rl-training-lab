import { describe, expect, it } from "vitest";

import {
  DRIVING_ACTIONS,
  DRIVING_OBSERVATION_FIELDS,
  createDrivingObservation,
  drivingObservationToVector,
} from "./types";

describe("driving protocol", () => {
  it("serializes the 12 observation fields in one stable order", () => {
    const observation = createDrivingObservation({
      lidarFarLeft: 0.01,
      lidarLeft: 0.02,
      lidarFront: 0.03,
      lidarRight: 0.04,
      lidarFarRight: 0.05,
      speed: 0.06,
      headingSin: 0.07,
      headingCos: 0.08,
      lateralOffset: 0.09,
      routeProgress: 0.1,
      previousSteer: 0.11,
      previousAcceleration: 0.12,
    });

    expect(DRIVING_OBSERVATION_FIELDS).toHaveLength(12);
    expect(drivingObservationToVector(observation)).toEqual([
      0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11,
      0.12,
    ]);
  });

  it("clamps noisy environment readings to finite normalized values", () => {
    const observation = createDrivingObservation({
      lidarFarLeft: Number.POSITIVE_INFINITY,
      lidarLeft: -1,
      speed: 2,
      headingSin: -2,
      lateralOffset: Number.NaN,
      previousAcceleration: -4,
    });
    const vector = drivingObservationToVector(observation);

    expect(vector).toHaveLength(12);
    expect(vector.every(Number.isFinite)).toBe(true);
    expect(observation.lidarFarLeft).toBe(0);
    expect(observation.lidarLeft).toBe(0);
    expect(observation.speed).toBe(1);
    expect(observation.headingSin).toBe(-1);
    expect(observation.lateralOffset).toBe(0);
    expect(observation.previousAcceleration).toBe(-1);
  });

  it("defines exactly nine unique steer and acceleration combinations", () => {
    expect(DRIVING_ACTIONS).toHaveLength(9);
    expect(new Set(DRIVING_ACTIONS.map((action) => action.id)).size).toBe(9);
    expect(
      new Set(
        DRIVING_ACTIONS.map(
          (action) => `${action.steer}:${action.acceleration}`,
        ),
      ).size,
    ).toBe(9);
    expect(DRIVING_ACTIONS.every((action) => action.label.length > 0)).toBe(true);
  });
});
