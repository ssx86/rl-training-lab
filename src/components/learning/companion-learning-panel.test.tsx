import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CompanionLearningPanel } from "./companion-learning-panel";

describe("CompanionLearningPanel", () => {
  it("requires a prediction before revealing the mechanism and formula", async () => {
    const user = userEvent.setup();
    render(<CompanionLearningPanel labId="q-learning" />);

    expect(screen.getAllByText("先预测")).toHaveLength(2);
    expect(screen.queryByTestId("algorithm-formula")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "不应该，target 只剩终止奖励" }));

    expect(screen.getByText("判断正确")).toBeInTheDocument();
    expect(screen.getByTestId("algorithm-formula")).toHaveTextContent("Q(s,a)");
  });

  it("links the experiment to its exact field-guide chapter and shows all five stages", () => {
    render(<CompanionLearningPanel labId="subject-2" />);

    expect(screen.getByRole("link", { name: /Design rewards without confusing the score with the goal/ })).toHaveAttribute(
      "href",
      "https://ssx86.github.io/rl-field-guide/en/learn/reward-design/",
    );
    for (const label of ["先预测", "再运行", "看证据", "讲机制", "做迁移"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/真实道路安全/)).toBeInTheDocument();
  });
});
