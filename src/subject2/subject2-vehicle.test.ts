import { describe, expect, it } from "vitest";
import { advanceSubject2Vehicle, createSubject2Vehicle, minimumServiceBrakeForStaticHold, SUBJECT2_ACTION_CODEC, SUBJECT2_ACTION_SIZE, SUBJECT2_VEHICLE } from "./subject2-vehicle";

describe("subject 2 continuous vehicle", () => {
  it("decodes one signed longitudinal axis into mutually exclusive automatic pedals", () => {
    expect(SUBJECT2_ACTION_SIZE).toBe(3);
    expect(SUBJECT2_ACTION_CODEC.decode([-1, .7, -1])).toEqual({ steer: -1, throttle: .7, brake: 0, gear: -1 });
    expect(SUBJECT2_ACTION_CODEC.decode([1, -.6, 1])).toEqual({ steer: 1, throttle: 0, brake: .6, gear: 1 });
    expect(SUBJECT2_ACTION_CODEC.decode([0, 0, 0])).toEqual({ steer: 0, throttle: 0, brake: 0, gear: 0 });
    expect(SUBJECT2_ACTION_CODEC.encode({ steer: 1, throttle: 0, brake: .6, gear: 1 })).toEqual([1, -.6, 1]);
  });
  it("uses a reverse gear with positive throttle instead of overloading the brake axis", () => {
    let vehicle = createSubject2Vehicle({ x: 20, y: 20, heading: 0 });
    for (let index = 0; index < 20; index += 1) {
      vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, throttle: 1, gear: -1 });
    }
    expect(vehicle.speed).toBeLessThan(0);
    expect(vehicle.x).toBeLessThan(20);
  });

  it("clamps out-of-range commands before rate-limited application", () => {
    const vehicle = advanceSubject2Vehicle(createSubject2Vehicle({ x: 0, y: 0, heading: 0 }), { steer: 5, throttle: 5, brake: 5 });
    expect(vehicle.steer).toBeCloseTo(.4, 6);
    expect(vehicle.throttle).toBe(0);
    expect(vehicle.brake).toBeCloseTo(.5, 6);
  });

  it("lets a coasting car settle at zero without oscillating across drive directions", () => {
    const vehicle = advanceSubject2Vehicle(createSubject2Vehicle({ x: 0, y: 0, heading: 0, speed: -.01 }), { steer: 0, throttle: 0 });
    expect(vehicle.speed).toBe(0);
  });

  it("uses real metre dimensions and a low-speed bicycle turning radius", () => {
    expect(SUBJECT2_VEHICLE.length).toBe(4.473);
    expect(SUBJECT2_VEHICLE.width).toBe(1.706);
    expect(SUBJECT2_VEHICLE.wheelBase).toBe(2.548);
    const minimumRadius = SUBJECT2_VEHICLE.wheelBase / Math.tan(SUBJECT2_VEHICLE.maxSteerRadians);
    expect(minimumRadius).toBeGreaterThan(3.8);
    expect(minimumRadius).toBeLessThan(4);
    expect(SUBJECT2_VEHICLE.maxForwardSpeed * 3.6).toBe(14.4);
    expect(Math.abs(SUBJECT2_VEHICLE.maxReverseSpeed) * 3.6).toBe(9);
  });

  it("exposes the calibrated static brake threshold for a ten-percent hill", () => {
    expect(minimumServiceBrakeForStaticHold(.1)).toBeCloseTo(.0876, 3);
    expect(minimumServiceBrakeForStaticHold(0)).toBe(0);
  });

  it("integrates continuous actions at a 100 ms physics step in metres", () => {
    const initial = createSubject2Vehicle({ x: 0, y: 0, heading: 0, speed: 2 });
    const next = advanceSubject2Vehicle(initial, { steer: 0, throttle: 0 });
    expect(next.x).toBeCloseTo(.19775, 5);
    expect(next.y).toBeCloseTo(0, 6);
    expect(next.speed).toBeCloseTo(1.955, 6);
  });

  it("rate-limits pedal travel so a full command produces smooth acceleration", () => {
    const initial = createSubject2Vehicle({ x: 0, y: 0, heading: 0 });
    const first = advanceSubject2Vehicle(initial, { steer: 0, throttle: 1 });
    const second = advanceSubject2Vehicle(first, { steer: 0, throttle: 1 });

    expect(first.throttle).toBeCloseTo(.3, 6);
    expect(second.throttle).toBeCloseTo(.6, 6);
    expect(first.speed).toBeGreaterThan(0);
    expect(second.speed).toBeGreaterThan(first.speed);
    expect(first.x).toBeCloseTo(first.speed * SUBJECT2_VEHICLE.timeStep / 2, 6);
  });

  it("never overlaps the actual throttle and brake while switching pedals", () => {
    const initial = createSubject2Vehicle({ x: 0, y: 0, heading: 0, speed: 1, throttle: 1 });
    let next = advanceSubject2Vehicle(initial, { steer: 0, throttle: 0, brake: 1 });
    expect(next.throttle).toBeCloseTo(.7, 6);
    expect(next.brake).toBe(0);
    for (let index = 0; index < 8; index += 1) {
      next = advanceSubject2Vehicle(next, { steer: 0, throttle: 0, brake: 1 });
      expect(next.throttle * next.brake).toBe(0);
    }
    expect(next.throttle).toBe(0);
    expect(next.brake).toBeGreaterThan(0);
  });

  it("brakes a moving car to a zero-speed lock without reversing it", () => {
    let vehicle = createSubject2Vehicle({ x: 0, y: 0, heading: 0, speed: 1.2 });
    for (let index = 0; index < 20; index += 1) vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, throttle: 0, brake: 1 });
    expect(vehicle.speed).toBe(0);
    expect(vehicle.isBrakeHolding).toBe(true);
  });

  it("holds a stopped car on a ten-percent grade with enough service brake", () => {
    let vehicle = createSubject2Vehicle({ x: 0, y: 0, heading: -Math.PI / 2 });
    for (let index = 0; index < 30; index += 1) {
      vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, throttle: 0, brake: .2 }, { grade: .1, uphillHeading: -Math.PI / 2 });
    }
    expect(vehicle.speed).toBe(0);
    expect(vehicle.isBrakeHolding).toBe(true);
  });

  it("still rolls backward when the available brake force is below the grade force", () => {
    let vehicle = createSubject2Vehicle({ x: 0, y: 0, heading: -Math.PI / 2 });
    for (let index = 0; index < 30; index += 1) {
      vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, throttle: 0, brake: .03 }, { grade: .1, uphillHeading: -Math.PI / 2 });
    }
    expect(vehicle.speed).toBeLessThan(0);
    expect(vehicle.isBrakeHolding).toBe(false);
  });

  it("rolls backward under gravity on a ten-percent uphill grade", () => {
    const initial = createSubject2Vehicle({ x: 0, y: 0, heading: -Math.PI / 2 });
    const next = advanceSubject2Vehicle(initial, { steer: 0, throttle: 0 }, { grade: .1, uphillHeading: -Math.PI / 2 });
    expect(next.speed).toBeLessThan(0);
    expect(next.y).toBeGreaterThan(0);
  });

  it("can overcome a ten-percent grade with sufficient forward throttle", () => {
    let vehicle = createSubject2Vehicle({ x: 0, y: 0, heading: -Math.PI / 2 });
    for (let index = 0; index < 10; index += 1) {
      vehicle = advanceSubject2Vehicle(vehicle, { steer: 0, throttle: 1 }, { grade: .1, uphillHeading: -Math.PI / 2 });
    }
    expect(vehicle.speed).toBeGreaterThan(0);
    expect(vehicle.y).toBeLessThan(0);
  });
});
