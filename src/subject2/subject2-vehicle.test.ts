import { describe, expect, it } from "vitest";
import {
  advanceSubject2Vehicle,
  createSubject2Vehicle,
  minimumServiceBrakeForStaticHold,
  subject2RearAxlePoint,
  SUBJECT2_ACTION_CODEC,
  SUBJECT2_ACTION_SIZE,
  SUBJECT2_VEHICLE,
} from "./subject2-vehicle";

describe("subject 2 dual-axis vehicle", () => {
  it("decodes only steering and signed longitudinal intent", () => {
    expect(SUBJECT2_ACTION_SIZE).toBe(2);
    expect(SUBJECT2_ACTION_CODEC.decode([-1, .7])).toEqual({ steer: -1, longitudinal: .7 });
    expect(SUBJECT2_ACTION_CODEC.decode([1, -.6])).toEqual({ steer: 1, longitudinal: -.6 });
    expect(SUBJECT2_ACTION_CODEC.encode({ steer: .25, longitudinal: -.4 })).toEqual([.25, -.4]);
  });

  it("chooses reverse directly from rest without a gear action", () => {
    let vehicle = createSubject2Vehicle({ x: 20, y: 20, heading: 0 });
    for (let index = 0; index < 20; index += 1) vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: -1 });
    expect(vehicle.speed).toBeLessThan(0);
    expect(vehicle.x).toBeLessThan(20);
    expect(vehicle.driveDirection).toBe(-1);
  });

  it("brakes to zero without crossing into the opposite direction", () => {
    let vehicle = createSubject2Vehicle({ x: 0, y: 0, heading: 0, speed: 1.2, driveDirection: 1 });
    for (let index = 0; index < 20; index += 1) {
      vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: -1 });
      expect(vehicle.speed).toBeGreaterThanOrEqual(0);
    }
    expect(vehicle.speed).toBe(0);
    expect(vehicle.isBrakeHolding).toBe(true);
    expect(vehicle.driveDirection).toBe(1);
  });

  it("requires a released longitudinal command before selecting the opposite direction", () => {
    let vehicle = createSubject2Vehicle({ x: 0, y: 0, heading: 0, speed: .2, driveDirection: 1 });
    for (let index = 0; index < 8; index += 1) vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: -1 });
    expect(vehicle.speed).toBe(0);
    vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: -1 });
    expect(vehicle.speed).toBe(0);
    vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: 0 });
    expect(vehicle.driveDirection).toBe(0);
    vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: -1 });
    expect(vehicle.speed).toBeLessThan(0);
  });

  it("uses one consistent New Santana geometry", () => {
    expect(SUBJECT2_VEHICLE.length).toBe(4.473);
    expect(SUBJECT2_VEHICLE.width).toBe(1.706);
    expect(SUBJECT2_VEHICLE.wheelBase).toBe(2.603);
    expect(SUBJECT2_VEHICLE.frontOverhang + SUBJECT2_VEHICLE.wheelBase + SUBJECT2_VEHICLE.rearOverhang)
      .toBeCloseTo(SUBJECT2_VEHICLE.length, 6);
  });

  it("measures a full-lock outer-front-wheel turning diameter near 10.7 metres", () => {
    const rearRadius = SUBJECT2_VEHICLE.wheelBase / Math.tan(SUBJECT2_VEHICLE.maxSteerRadians);
    const outerFrontRadius = Math.hypot(rearRadius + SUBJECT2_VEHICLE.frontTrackWidth / 2, SUBJECT2_VEHICLE.wheelBase);
    expect(outerFrontRadius * 2).toBeCloseTo(10.7, 1);
  });

  it("integrates the rear axle then reconstructs the body centre", () => {
    const initial = createSubject2Vehicle({ x: 10, y: 10, heading: 0, speed: 1, steer: 1, driveDirection: 1 });
    const rearBefore = subject2RearAxlePoint(initial);
    const next = advanceSubject2Vehicle(initial, { steer: 1, longitudinal: 1 });
    const rearAfter = subject2RearAxlePoint(next);
    expect(Math.hypot(rearAfter.x - rearBefore.x, rearAfter.y - rearBefore.y)).toBeGreaterThan(0);
    expect(next.y).not.toBe(10);
  });

  it("clamps commands and rate-limits steering", () => {
    const vehicle = advanceSubject2Vehicle(createSubject2Vehicle({ x: 0, y: 0, heading: 0 }), { steer: 5, longitudinal: 5 });
    expect(vehicle.steer).toBeCloseTo(.4, 6);
    expect(vehicle.longitudinalIntent).toBe(1);
  });

  it("exposes the calibrated static brake threshold for a ten-percent hill", () => {
    expect(minimumServiceBrakeForStaticHold(.1)).toBeCloseTo(.0876, 3);
    expect(minimumServiceBrakeForStaticHold(0)).toBe(0);
  });

  it("holds while the brake command remains pressed and rolls when released on a grade", () => {
    let vehicle = createSubject2Vehicle({ x: 0, y: 0, heading: -Math.PI / 2, speed: .4, driveDirection: 1 });
    for (let index = 0; index < 20; index += 1) {
      vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: -1 }, { grade: .1, uphillHeading: -Math.PI / 2 });
    }
    expect(vehicle.speed).toBe(0);
    expect(vehicle.isBrakeHolding).toBe(true);
    vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, longitudinal: 0 }, { grade: .1, uphillHeading: -Math.PI / 2 });
    expect(vehicle.speed).toBeLessThan(0);
    expect(vehicle.isBrakeHolding).toBe(false);
  });

  it("still rolls backward from an unheld stop on a ten-percent uphill grade", () => {
    const initial = createSubject2Vehicle({ x: 0, y: 0, heading: -Math.PI / 2 });
    const next = advanceSubject2Vehicle(initial, { steer: 0, longitudinal: 0 }, { grade: .1, uphillHeading: -Math.PI / 2 });
    expect(next.speed).toBeLessThan(0);
    expect(next.y).toBeGreaterThan(0);
  });
});
