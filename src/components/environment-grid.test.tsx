import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ACTIONS, START_STATE, STATE_COUNT } from "@/domain/cliff-walking";
import { EnvironmentGrid } from "./environment-grid";

describe("EnvironmentGrid", () => {
  it("renders the complete 160-state map with terrain semantics", () => {
    renderGrid();
    expect(screen.getAllByTestId("grid-cell")).toHaveLength(STATE_COUNT);
    expect(screen.getByRole("gridcell", { name: /起点/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /目标/ })).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell", { name: /墙体/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("gridcell", { name: /悬崖/ }).length).toBeGreaterThan(0);
  });

  it("switches observation layers without changing the map", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole("button", { name: "策略" }));
    expect(screen.getByRole("button", { name: "策略" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("grid-cell")).toHaveLength(STATE_COUNT);
  });

  it("highlights the state whose Q value changed", () => {
    renderGrid({ state: START_STATE, action: ACTIONS.UP, version: 1 });
    expect(screen.getByRole("gridcell", { name: /智能体当前位置/ })).toHaveClass("q-heat-flash");
  });
});

function renderGrid(lastQUpdate?: { state: number; action: typeof ACTIONS[keyof typeof ACTIONS]; version: number }) {
  const qMatrix = Array.from({ length: STATE_COUNT }, () => [0, 0, 0, 0]);
  return render(
    <EnvironmentGrid
      currentState={START_STATE}
      selectedState={START_STATE}
      path={[START_STATE]}
      qMatrix={qMatrix}
      visitCounts={Array.from({ length: STATE_COUNT }, (_, state) => state === START_STATE ? 1 : 0)}
      lastQUpdate={lastQUpdate}
      greedyActions={() => [ACTIONS.UP, ACTIONS.RIGHT, ACTIONS.DOWN, ACTIONS.LEFT]}
      onSelectState={vi.fn()}
    />,
  );
}
