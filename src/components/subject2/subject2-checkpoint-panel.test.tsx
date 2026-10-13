import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Subject2CheckpointPanel } from "./subject2-checkpoint-panel";

const info = { available: true, savedAt: "2026-10-12T10:00:00.000Z", step: 12_000, updates: 2_800, reason: "existing" as const };

describe("subject 2 checkpoint controls", () => {
  it("asks before restoring a checkpoint found after page refresh", async () => {
    const restore = vi.fn(); const dismiss = vi.fn();
    render(<Subject2CheckpointPanel info={info} promptOpen canSave onSave={vi.fn()} onRestore={restore} onDismissPrompt={dismiss} error={null} />);
    expect(screen.getByRole("dialog", { name: "发现本地模型存档" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "使用之前的模型" }));
    expect(restore).toHaveBeenCalledOnce();
  });

  it("exposes manual save and load controls with visible progress metadata", () => {
    render(<Subject2CheckpointPanel info={info} promptOpen={false} canSave onSave={vi.fn()} onRestore={vi.fn()} onDismissPrompt={vi.fn()} error={null} />);
    expect(screen.getByRole("button", { name: "立即保存" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "载入存档" })).toBeEnabled();
    expect(screen.getByText(/12,000 步/)).toBeInTheDocument();
  });
});
