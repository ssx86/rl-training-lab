import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("global training navigation", () => {
  beforeEach(() => window.history.replaceState({}, "", "/#/subject-2"));

  it("shows every implemented training lab from the subject 2 page", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /Q-learning 峡谷/ })).toHaveAttribute("href", "#/q-learning");
    expect(screen.getByRole("link", { name: /DQN 单车/ })).toHaveAttribute("href", "#/dqn-driving");
    expect(screen.getByRole("link", { name: /TD3 城市车队/ })).toHaveAttribute("href", "#/td3-fleet");
    expect(screen.getByRole("link", { name: /TD3 科目二/ })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the selected lab in the URL and restores it after remounting", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);

    await user.click(screen.getByRole("link", { name: /DQN 单车/ }));
    await waitFor(() => expect(window.location.hash).toBe("#/dqn-driving"));
    expect(screen.getByRole("heading", { name: "DQN 单车驾驶训练" })).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);
    expect(screen.getByRole("link", { name: /DQN 单车/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "DQN 单车驾驶训练" })).toBeInTheDocument();
  });

  it("shows an explicit recovery page for an unknown lab URL", () => {
    window.history.replaceState({}, "", "/#/not-a-lab");
    render(<App />);

    expect(screen.getByRole("heading", { name: "找不到这个训练实验" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回科目二/ })).toHaveAttribute("href", "#/subject-2");
  });
});
