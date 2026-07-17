import { describe, expect, it } from "vitest";
import {
  buildCalendarAllDayDraftSlot,
  hasCalendarDatePressMoved,
} from "./calendar-all-day";

describe("Calendar all-day creation", () => {
  it("builds a full local-day range for the selected date", () => {
    const selectedDate = new Date(2026, 6, 17, 14, 30);
    const draft = buildCalendarAllDayDraftSlot(selectedDate);
    const start = new Date(draft.startTime);
    const end = new Date(draft.endTime);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(17);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(17);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("keeps taps but cancels creation after a horizontal or vertical drag", () => {
    expect(hasCalendarDatePressMoved({ x: 10, y: 10 }, { x: 15, y: 14 })).toBe(false);
    expect(hasCalendarDatePressMoved({ x: 10, y: 10 }, { x: 19, y: 10 })).toBe(true);
    expect(hasCalendarDatePressMoved({ x: 10, y: 10 }, { x: 10, y: 19 })).toBe(true);
  });
});
