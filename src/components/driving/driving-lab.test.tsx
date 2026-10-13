import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DrivingLab } from "./driving-lab";

describe("DrivingLab", () => {
  it("shows the real city overview and separate training speed controls", () => {
    render(<DrivingLab />);

    expect(screen.getByRole("img", { name: /多车出租车训练地图/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MAX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "60 FPS" })).toBeInTheDocument();
    expect(screen.getByText(/32m 前向雷达/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "跟随选中车辆" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20 辆" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50 辆" })).toBeInTheDocument();
    expect(screen.queryByText("训练池车辆")).not.toBeInTheDocument();
    expect(screen.getByText("实时交通车辆")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4 视角" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("keeps only training and inference modes", () => {
    render(<DrivingLab />);

    for (const label of ["训练", "推理评估"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("tab", { name: "手动" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "脚本" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "城市" })).toHaveLength(3);
  });
});
