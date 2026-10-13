import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATE_COUNT } from "@/domain/cliff-walking";
import { App } from "./App";

describe("RL Navigation Lab", () => {
  beforeEach(() => window.history.replaceState({}, "", "/q-learning"));

  it("opens the independent subject 2 training page from its own URL", () => {
    window.history.replaceState({}, "", "/subject-2");
    render(<App />);
    expect(screen.getByRole("heading", { name: "中国科目二 · 固定标准训练场" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Q-learning" })).not.toBeInTheDocument();
    expect(screen.getByText("只显示最终目标")).toBeInTheDocument();
  });

  it("canonicalizes the default entry to the persistent subject 2 URL", () => {
    window.history.replaceState({}, "", "/");
    render(<App />);
    expect(window.location.hash).toBe("#/subject-2");
  });
  it("renders the 160-state canyon environment", () => {
    render(<App />);
    expect(screen.getAllByTestId("grid-cell")).toHaveLength(STATE_COUNT);
    expect(screen.getByRole("gridcell", { name: /起点/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /目标/ })).toBeInTheDocument();
  });

  it("shows the real update-function status after one transition", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "单步" }));
    expect(screen.getAllByText("Q-learning 更新链路已接通").length).toBeGreaterThan(0);
    expect(screen.getByTestId("episode-step")).toHaveTextContent("1");
  });

  it("switches to exploitation without modifying the Q table", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "利用模式" }));
    expect(screen.getByText("冻结学习，只检验当前策略形成的路径")).toBeInTheDocument();
  });

  it("keeps advancing while continuous running is active", () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));
    act(() => vi.advanceTimersByTime(800));
    expect(Number(screen.getByTestId("episode-step").textContent)).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("shows the reusable evidence contract for future algorithms", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "算法路径" }));

    expect(screen.getByText("signals: bootstrap · target · tdError")).toBeInTheDocument();
    expect(screen.getByText("signals: nextAction · target · tdError")).toBeInTheDocument();
    expect(screen.getByText(/未标为“当前实验”的算法尚未实现/)).toBeInTheDocument();
  });

  it("organizes the lab as four observable reinforcement-learning courses", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("link", { name: /Q-learning 峡谷/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /DQN 单车/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /TD3 城市车队/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /TD3 科目二/ })).toBeInTheDocument();
    expect(screen.queryByText("Q(s,a) <- Q(s,a) + alpha [r + gamma max Q(s',a') - Q(s,a)]")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /target 只剩终止奖励/ }));
    expect(screen.getByText("Q(s,a) <- Q(s,a) + alpha [r + gamma max Q(s',a') - Q(s,a)]")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /DQN 单车/ }));
    await user.click(screen.getByRole("button", { name: /强相关样本会让回归目标更不稳定/ }));
    expect(screen.getByText("y = r + gamma (1 - done) max Q_target(s', a')")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DQN 单车驾驶训练" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "手动" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "脚本" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /TD3 城市车队/ }));
    await user.click(screen.getByRole("button", { name: /异步非平稳更新可能互相覆盖/ }));
    expect(screen.getByText(/min\(Q1_target, Q2_target\)/)).toBeInTheDocument();
  });

  it("opens the autonomous driving TD3 course without disturbing the canyon course", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: /TD3 城市车队/ }));

    expect(screen.getByRole("img", { name: /多车出租车训练地图/ })).toBeInTheDocument();
    expect(screen.getByText(/一个 learner 用连续控制写入共享 Replay/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "手动" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "脚本" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("grid-cell")).not.toBeInTheDocument();
  });
});
