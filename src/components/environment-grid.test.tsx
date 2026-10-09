import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ACTIONS } from "@/domain/cliff-walking";
import { EnvironmentGrid } from "./environment-grid";

describe("EnvironmentGrid", () => {
  it("centers the agent independently from the directional Q labels", () => {
    renderGrid();

    expect(screen.getByTestId("agent-marker")).toHaveClass(
      "absolute",
      "left-1/2",
      "top-1/2",
      "-translate-x-1/2",
      "-translate-y-1/2",
    );
  });

  it("ranks heat colors inside each state instead of using global extremes", () => {
    const qMatrix = emptyQMatrix();
    qMatrix[0] = [-2, -1, -3, -4];
    qMatrix[1] = [0, 0, 0, 0];

    renderGrid(qMatrix);

    const firstCell = screen.getAllByTestId("grid-cell")[0];
    const bestSegment = within(firstCell).getByTestId(`q-heat-${ACTIONS.RIGHT}`);
    const worstSegment = within(firstCell).getByTestId(`q-heat-${ACTIONS.LEFT}`);
    expect(bestSegment).toHaveAttribute("data-heat", "best");
    expect(bestSegment).toHaveStyle({ backgroundColor: "rgba(220, 38, 38, 0.62)" });
    expect(worstSegment).toHaveAttribute("data-heat", "worst");
    expect(worstSegment).toHaveStyle({ backgroundColor: "rgba(37, 99, 235, 0.62)" });

    const equalCell = screen.getAllByTestId("grid-cell")[1];
    expect(within(equalCell).getAllByTestId(/q-heat-/)).toHaveLength(4);
    within(equalCell).getAllByTestId(/q-heat-/).forEach((segment) => {
      expect(segment).toHaveAttribute("data-heat", "neutral");
    });
  });

  it("flashes only the changed state-action and restarts on repeated updates", () => {
    const qMatrix = emptyQMatrix();
    qMatrix[0] = [-2, -1, -3, -4];
    const view = renderGrid(qMatrix, { state: 0, action: ACTIONS.RIGHT, version: 1 });

    const firstFlash = within(screen.getAllByTestId("grid-cell")[0]).getByTestId(`q-heat-${ACTIONS.RIGHT}`);
    expect(firstFlash).toHaveAttribute("data-highlight", "true");
    expect(firstFlash).toHaveClass("q-heat-flash");
    expect(document.querySelectorAll('[data-highlight="true"]')).toHaveLength(1);

    view.rerender(grid(qMatrix, { state: 0, action: ACTIONS.RIGHT, version: 2 }));
    const secondFlash = within(screen.getAllByTestId("grid-cell")[0]).getByTestId(`q-heat-${ACTIONS.RIGHT}`);
    expect(secondFlash).not.toBe(firstFlash);
    expect(secondFlash).toHaveAttribute("data-update-version", "2");
  });
});

function renderGrid(
  qMatrix = emptyQMatrix(),
  lastQUpdate?: { state: number; action: typeof ACTIONS[keyof typeof ACTIONS]; version: number },
) {
  return render(grid(qMatrix, lastQUpdate));
}

function grid(
  qMatrix: number[][],
  lastQUpdate?: { state: number; action: typeof ACTIONS[keyof typeof ACTIONS]; version: number },
) {
  return (
    <EnvironmentGrid
      currentState={0}
      selectedState={0}
      path={[0]}
      qMatrix={qMatrix}
      lastQUpdate={lastQUpdate}
      greedyActions={(state) => state === 0 ? [ACTIONS.RIGHT] : [ACTIONS.UP, ACTIONS.RIGHT, ACTIONS.DOWN, ACTIONS.LEFT]}
      onSelectState={vi.fn()}
    />
  );
}

function emptyQMatrix() {
  return Array.from({ length: 48 }, () => [0, 0, 0, 0]);
}
