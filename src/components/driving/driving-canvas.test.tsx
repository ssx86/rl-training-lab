import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createStraightTrainingMap } from "@/driving/maps";
import { createDrivingObservation } from "@/driving/types";
import { createVehicleState } from "@/driving/vehicle-model";
import { DrivingCanvas } from "./driving-canvas";

describe("DrivingCanvas", () => {
  it("renders the road, vehicle, obstacle and five sensor rays with a text summary", () => {
    const map = createStraightTrainingMap({
      obstacles: [{ id: "test-obstacle", x: 260, y: 320, radius: 18 }],
    });
    render(
      <DrivingCanvas
        map={map}
        vehicle={createVehicleState({ x: 80, y: 320, heading: 0 })}
        observation={createDrivingObservation({
          lidarFarLeft: 0.5,
          lidarLeft: 0.6,
          lidarFront: 0.7,
          lidarRight: 0.8,
          lidarFarRight: 0.9,
          routeProgress: 0.1,
        })}
      />,
    );

    expect(screen.getByRole("img", { name: /自动驾驶环境/ })).toBeInTheDocument();
    expect(screen.getAllByTestId("sensor-ray")).toHaveLength(5);
    expect(screen.getByTestId("obstacle-test-obstacle")).toBeInTheDocument();
    expect(screen.getByText(/路线进度 10%/)).toBeInTheDocument();
  });
});
