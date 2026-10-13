import { describe, expect, it } from "vitest";
import { collidesWithCourse, isVehicleFullyInsideBay } from "./subject2-collision";
import { SUBJECT2_STANDARD } from "./subject2-standard";
import { createSubject2Vehicle, SUBJECT2_VEHICLE } from "./subject2-vehicle";

describe("subject 2 body collision", () => {
  it("detects the rectangular car body touching a curb", () => {
    const vehicle = createSubject2Vehicle({ x: 10, y: 10, heading: 0 });
    expect(collidesWithCourse(vehicle, [{ id: "curb", ax: 11, ay: 8, bx: 11, by: 12, kind: "curb" }])).toBe(true);
  });

  it("fails when any part of the body touches a painted parking boundary", () => {
    const vehicle = createSubject2Vehicle({ x: 10, y: 10, heading: 0 });
    expect(collidesWithCourse(vehicle, [{ id: "paint", ax: 11, ay: 8, bx: 11, by: 12, kind: "parking-line" }])).toBe(true);
  });

  it("requires all four rotated body corners to be inside a parking bay", () => {
    const bay = { id: "bay", label: "测试车位", x: 10, y: 10, width: 3, length: 6, heading: 0 } as const;
    expect(isVehicleFullyInsideBay(createSubject2Vehicle({ x: 10, y: 10, heading: 0 }), bay)).toBe(true);
    expect(isVehicleFullyInsideBay(createSubject2Vehicle({ x: 12.1, y: 10, heading: 0 }), bay)).toBe(false);
    expect(isVehicleFullyInsideBay(createSubject2Vehicle({ x: 10, y: 10, heading: Math.PI / 4 }), bay)).toBe(false);
  });

  it("accepts a legally contained car with only a small positive clearance instead of adding a hidden margin", () => {
    const bay = { id: "bay", label: "倒车库", x: 10, y: 10, width: SUBJECT2_STANDARD.reverseParking.bayWidth, length: SUBJECT2_STANDARD.reverseParking.bayLength, heading: Math.PI / 2 } as const;
    const legalLateralOffset = (bay.width - SUBJECT2_VEHICLE.width) / 2 - .02;
    const vehicle = createSubject2Vehicle({ x: 10 + legalLateralOffset, y: 10, heading: Math.PI / 2 });
    expect(isVehicleFullyInsideBay(vehicle, bay)).toBe(true);
  });
});
