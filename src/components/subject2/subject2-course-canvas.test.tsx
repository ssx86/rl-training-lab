import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Subject2Environment } from "@/subject2/subject2-environment";
import { SUBJECT2_VEHICLE } from "@/subject2/subject2-vehicle";
import { Subject2CourseCanvas } from "./subject2-course-canvas";

describe("Subject2CourseCanvas", () => {
  it("shows a large car with 360 degree sensing and no navigation line", () => {
    const environment = new Subject2Environment();
    render(<Subject2CourseCanvas scenario={environment.currentScenario()} vehicle={environment.snapshot()} observation={environment.observe()} checkpoint={environment.currentGoal()} />);
    expect(screen.getAllByTestId("subject2-sensor-ray")).toHaveLength(32);
    const vehicle = screen.getByTestId("subject2-vehicle");
    expect(vehicle).toBeInTheDocument();
    expect(vehicle.querySelector("rect")?.getAttribute("width")).toBe(String(SUBJECT2_VEHICLE.length));
    expect(vehicle.querySelector("rect")?.getAttribute("height")).toBe(String(SUBJECT2_VEHICLE.width));
    const wheels = screen.getAllByTestId("subject2-wheel");
    expect(wheels).toHaveLength(4);
    expect(wheels.every((wheel) => {
      const y = Number(wheel.getAttribute("y"));
      const height = Number(wheel.getAttribute("height"));
      return Math.max(Math.abs(y), Math.abs(y + height)) <= SUBJECT2_VEHICLE.width / 2;
    })).toBe(true);
    expect(screen.getByRole("img").getAttribute("viewBox")?.split(" ").slice(-2)).toEqual(["30", "22.5"]);
    expect(screen.queryByTestId("navigation-line")).not.toBeInTheDocument();
  });

  it("renders the S course as continuous cubic road edges at real-world line weight", () => {
    const environment = new Subject2Environment();
    render(<Subject2CourseCanvas scenario={environment.currentScenario()} vehicle={environment.snapshot()} observation={environment.observe()} checkpoint={environment.currentGoal()} overview />);
    const edges = screen.getAllByTestId("smooth-road-edge");
    expect(edges).toHaveLength(2);
    expect(edges[0].getAttribute("d")).toContain(" C ");
    expect(Number(edges[0].getAttribute("stroke-width"))).toBeLessThan(.2);
  });
});
