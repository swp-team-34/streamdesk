import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeadlineNow } from "./use-deadline-now";

describe("useDeadlineNow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes the current time without a page reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
    const { result } = renderHook(() => useDeadlineNow(60_000));

    expect(result.current.toISOString()).toBe("2026-07-16T12:00:00.000Z");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.toISOString()).toBe("2026-07-16T12:01:00.000Z");
  });
});
