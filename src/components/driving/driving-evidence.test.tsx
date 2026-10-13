import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDrivingObservation } from "@/driving/types";
import type { TrainingStepEvidence } from "@/driving/training-runtime";
import { createVehicleState } from "@/driving/vehicle-model";
import { createStraightTrainingMap } from "@/driving/maps";
import { DrivingEvidence } from "./driving-evidence";

describe("DrivingEvidence", () => {
  it("shows empty guidance before the first real transition", () => {
    render(<DrivingEvidence evidence={null} />);
    expect(screen.getByText(/单步或开始训练后/)).toBeInTheDocument();
    expect(screen.queryByTestId("action-q-value")).not.toBeInTheDocument();
  });

  it("shows observation, nine Q values and reward components from evidence", () => {
    const observation = createDrivingObservation({ lidarFront: 0.5 });
    const evidence: TrainingStepEvidence = {
      status: "running",
      mode: "training",
      environmentStep: 10,
      trainingUpdates: 2,
      episode: 1,
      bufferSize: 10,
      targetSyncAge: 10,
      recentEpisodes: [],
      transition: {
        observation,
        action: 5,
        reward: 0.98,
        nextObservation: observation,
        done: false,
        event: "step",
        rewardBreakdown: { progress: 1, step: -0.02 },
        stepIndex: 10,
      },
      qValues: Array.from({ length: 9 }, (_, index) => index / 10),
      source: "exploit",
      epsilon: 0.2,
      loss: 0.4,
      vehicle: createVehicleState({ x: 100, y: 320, heading: 0 }),
      replaySample: null,
      map: createStraightTrainingMap(),
    };

    render(<DrivingEvidence evidence={evidence} />);

    expect(screen.getAllByTestId("action-q-value")).toHaveLength(9);
    expect(screen.getByText("进度奖励")).toBeInTheDocument();
    expect(screen.getByText("步进成本")).toBeInTheDocument();
    expect(screen.getByText(/利用 · ε/)).toBeInTheDocument();
  });
});
