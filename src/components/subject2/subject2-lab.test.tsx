import { fireEvent, render, screen } from "@testing-library/react";
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
    const snapshot = {
      ...runtime.snapshot(), sceneGeneration: 12, lastTerminalReason: "collision" as const,
      terminationCounts: { ...runtime.snapshot().terminationCounts, collision: 7, stalled: 3 },
    };
    vi.mocked(useSubject2Lab).mockReturnValue({
      snapshot,
      rewardHistory: [],
      mode: "training",
      trainingScope: "rotation",
      selectedProject: "reverse-parking",
      speed: "max",
      status: "running",
      error: null,
      metrics: { backend: "webgl", stepsPerSecond: 1_000 },
      checkpointInfo: { available: false, savedAt: null, step: 0, updates: 0, reason: null },
      checkpointError: null,
      restorePromptOpen: false,
      setMode: vi.fn(),
      setSpeed: vi.fn(),
      setTrainingSelection: vi.fn(),
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
    expect(screen.getAllByText("碰线 / 碰撞")).toHaveLength(2);
    expect(screen.getByText("7 次")).toBeInTheDocument();
    expect(screen.getByText("3 次")).toBeInTheDocument();
  });

  it("switches training scope and selected subject through explicit controls", () => {
    const setTrainingSelection = vi.fn();
    vi.mocked(useSubject2Lab).mockReturnValue({
      snapshot: { ...runtime.snapshot(), trainingScope: "single", selectedProject: "s-curve" },
      rewardHistory: [], mode: "training", trainingScope: "single", selectedProject: "s-curve", speed: "max", status: "paused", error: null,
      metrics: { backend: "webgl", stepsPerSecond: 0 },
      checkpointInfo: { available: false, savedAt: null, step: 0, updates: 0, reason: null },
      checkpointError: null, restorePromptOpen: false,
      setMode: vi.fn(), setSpeed: vi.fn(), setTrainingSelection,
      start: vi.fn(), pause: vi.fn(), saveCheckpoint: vi.fn(), restoreCheckpoint: vi.fn(), dismissRestorePrompt: vi.fn(),
    });

    render(<Subject2Lab />);

    expect(screen.getByText("持续训练所选科目，不自动切换；切换科目不会清空已学权重或经验。")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("专训科目"), { target: { value: "right-angle" } });
    expect(setTrainingSelection).toHaveBeenCalledWith("single", "right-angle");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "五项轮换" }), { button: 0, ctrlKey: false });
    expect(setTrainingSelection).toHaveBeenCalledWith("rotation", "s-curve");
  });
});
