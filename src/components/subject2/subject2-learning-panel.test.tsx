import { render, screen } from "@testing-library/react";
import { afterAll, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { Subject2TrainingRuntime } from "@/subject2/subject2-runtime";
import { Subject2LearningPanel } from "./subject2-learning-panel";

const runtime = new Subject2TrainingRuntime({ seed: 17 });
afterAll(() => runtime.dispose());

describe("Subject2LearningPanel diagnostics", () => {
  it("shows process completion as a separate normalized learning signal", async () => {
    render(<Subject2LearningPanel snapshot={runtime.snapshot()} backend="webgl" history={[{
      step: 1, total: 0, progress: 0, task: 0, penalties: 0, throttle: 0, brake: 0, stopped: true, completionRate: 25,
    }]} />);
    expect(screen.getByLabelText("过程完成率曲线")).toBeInTheDocument();
    expect(screen.getByText(/0–100%/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "奖励公式" }));
    expect(screen.getByText(/12 秒无进展/)).toBeInTheDocument();
  });
});
