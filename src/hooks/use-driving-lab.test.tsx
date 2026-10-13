import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDrivingLab } from "./use-driving-lab";

describe("useDrivingLab", () => {
  it("starts in training mode without exposing manual driving", () => {
    const { result } = renderHook(() => useDrivingLab());
    expect(result.current.mode).toBe("training");
    expect("drive" in result.current).toBe(false);
  });

  it("resets the training preview when the curriculum changes", () => {
    const { result } = renderHook(() => useDrivingLab());
    act(() => result.current.setLevel("L3"));
    expect(result.current.evidence).toBeNull();
    expect(result.current.map.id).toContain("seeded-static");
    expect(result.current.status).toBe("idle");
  });
});
