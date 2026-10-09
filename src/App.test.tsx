import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("Q-learning Lab", () => {
  it("renders the 48-cell Cliff Walking environment", () => {
    render(<App />);

    expect(screen.getAllByTestId("grid-cell")).toHaveLength(48);
    expect(screen.getByRole("gridcell", { name: /起点/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /终点/ })).toBeInTheDocument();
  });

  it("shows four compact one-decimal Q values in each reachable cell", () => {
    render(<App />);

    const startCell = screen.getByRole("gridcell", { name: /状态 36.*起点/ });
    expect(startCell).toHaveTextContent("↑0.0");
    expect(startCell).toHaveTextContent("→0.0");
    expect(startCell).toHaveTextContent("↓0.0");
    expect(startCell).toHaveTextContent("←0.0");
  });

  it("advances one transition without implementing the learning formula", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "单步" }));

    expect(screen.getAllByText("算法待实现")).toHaveLength(2);
    expect(screen.getByTestId("episode-step")).toHaveTextContent("1");
    expect(document.querySelectorAll('[data-highlight="true"]')).toHaveLength(1);
  });

  it("switches to exploitation without modifying the Q table", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "利用模式" }));

    expect(screen.getByText("只读取当前 Q 表，不写入数值")).toBeInTheDocument();
  });

  it("keeps advancing while continuous running is active", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "连续运行" }));
    act(() => vi.advanceTimersByTime(800));

    expect(Number(screen.getByTestId("episode-step").textContent)).toBeGreaterThan(1);
    vi.useRealTimers();
  });
});

