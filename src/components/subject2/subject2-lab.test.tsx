import { render, screen } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { useSubject2Lab } from "@/hooks/use-subject2-lab";
import { Subject2TrainingRuntime } from "@/subject2/subject2-runtime";
import { Subject2Lab } from "./subject2-lab";

vi.mock("@/hooks/use-subject2-lab", () => ({ useSubject2Lab: vi.fn() }));
vi.mock("./subject2-course-canvas", () => ({ Subject2CourseCanvas: () => <div aria-label="科目二训练画面" /> }));
vi.mock("./subject2-driver-view-3d", () => ({ Subject2DriverView3D: () => <div aria-label="驾驶员立体主视角" /> }));
vi.mock("./subject2-learning-panel", () => ({ Subject2LearningPanel: () => null }));
vi.mock("./subject2-checkpoint-panel", () => ({ Subject2CheckpointPanel: () => null }));

const runtime = new Subject2TrainingRuntime({ seed: 17 });

afterAll(() => runtime.dispose());

describe("Subject2Lab attempt resets", () => {
  it("keeps the training view unobstructed after repeated attempt resets", () => {
    const snapshot = { ...runtime.snapshot(), sceneGeneration: 12 };
    vi.mocked(useSubject2Lab).mockReturnValue({
      snapshot,
      rewardHistory: [],
      mode: "training",
      speed: "max",
      status: "running",
      error: null,
      metrics: { backend: "webgl", stepsPerSecond: 1_000 },
      checkpointInfo: { available: false, savedAt: null, step: 0, updates: 0, reason: null },
      checkpointError: null,
      restorePromptOpen: false,
      setMode: vi.fn(),
      setSpeed: vi.fn(),
      start: vi.fn(),
      pause: vi.fn(),
      saveCheckpoint: vi.fn(),
      restoreCheckpoint: vi.fn(),
      dismissRestorePrompt: vi.fn(),
    });

    render(<Subject2Lab />);

    expect(screen.getAllByLabelText("科目二训练画面")).toHaveLength(2);
    expect(screen.getByText("attempt #12 · fixed course")).toBeInTheDocument();
    expect(screen.queryByText("下一次尝试 · 标准场地复位")).not.toBeInTheDocument();
    expect(screen.queryByText("attempt reset")).not.toBeInTheDocument();
  });
});
