import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Subject2Environment } from "@/subject2/subject2-environment";
import { generateSubject2Scenario } from "@/subject2/subject2-scenario";
import { subject2CameraElevation } from "@/subject2/subject2-camera-geometry";
import { Subject2DriverView3D } from "./subject2-driver-view-3d";

describe("subject 2 driver camera", () => {
  it("renders an accessible fallback when WebGL2 is unavailable", () => {
    const environment = new Subject2Environment(generateSubject2Scenario(17, "reverse-parking"));
    render(<Subject2DriverView3D scenario={environment.currentScenario()} vehicle={environment.snapshot()} observation={environment.observe()} />);
    expect(screen.getByRole("status")).toHaveTextContent("无法启用立体驾驶员主视角");
  });

  it("raises the camera along the ten-percent hill instead of rendering a flat ramp", () => {
    const ramp = generateSubject2Scenario(17, "ramp");
    expect(subject2CameraElevation(ramp, 20) - subject2CameraElevation(ramp, 55)).toBeCloseTo(3.5, 6);
    expect(subject2CameraElevation(generateSubject2Scenario(17, "s-curve"), 20)).toBe(0);
  });
});
