import { describe, expect, it } from "vitest";
import {
  buildCalendarTimelineDays,
  CALENDAR_TIMELINE_BUFFER_DAYS,
  getCalendarTimelineNextBufferDays,
  getCalendarTimelineDayWidth,
  getCalendarTimelineScrollLeft,
  getCalendarTimelineSnapIndex,
  getCalendarTimelineVisibleDayCount,
  isCalendarTimelineNearBufferEdge,
} from "./calendar-timeline";

const dayKeys = (days: Date[]) => days.map((date) => date.toISOString().slice(0, 10));

describe("calendar timeline helpers", () => {
  it("keeps exact desktop viewport counts for timeline modes", () => {
    expect(getCalendarTimelineVisibleDayCount("day", true)).toBe(1);
    expect(getCalendarTimelineVisibleDayCount("3days", true)).toBe(3);
    expect(getCalendarTimelineVisibleDayCount("week", true)).toBe(7);
    expect(getCalendarTimelineVisibleDayCount("week", false)).toBe(5);
  });

  it("builds adjacent buffered dates around the selected leading day", () => {
    const days = buildCalendarTimelineDays({
      anchorDate: new Date("2026-07-15T12:00:00"),
      viewMode: "3days",
      showWeekends: true,
    });

    expect(days).toHaveLength(CALENDAR_TIMELINE_BUFFER_DAYS * 2 + 3);
    expect(dayKeys(days).slice(
      CALENDAR_TIMELINE_BUFFER_DAYS - 1,
      CALENDAR_TIMELINE_BUFFER_DAYS + 4,
    )).toEqual([
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
    ]);
  });

  it("skips weekends for multi-day views while retaining complete visible ranges", () => {
    const days = buildCalendarTimelineDays({
      anchorDate: new Date("2026-07-18T12:00:00"),
      viewMode: "3days",
      showWeekends: false,
      bufferDays: 1,
    });

    expect(dayKeys(days)).toEqual([
      "2026-07-17",
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
    ]);
  });

  it("fits the configured day count on desktop and enforces mobile minimums", () => {
    expect(getCalendarTimelineDayWidth({
      viewportWidth: 756,
      viewMode: "week",
      showWeekends: true,
    })).toBe(100);
    expect(getCalendarTimelineDayWidth({
      viewportWidth: 360,
      viewMode: "week",
      showWeekends: true,
    })).toBe(96);
  });

  it("snaps to the nearest bounded day", () => {
    expect(getCalendarTimelineSnapIndex({ scrollLeft: 749, dayWidth: 100, dayCount: 20 })).toBe(7);
    expect(getCalendarTimelineSnapIndex({ scrollLeft: 751, dayWidth: 100, dayCount: 20 })).toBe(8);
    expect(getCalendarTimelineSnapIndex({ scrollLeft: 9999, dayWidth: 100, dayCount: 20 })).toBe(19);
    expect(getCalendarTimelineScrollLeft(7, 100)).toBe(700);
  });

  it("extends the date buffer before the viewport reaches either edge", () => {
    const baseInput = {
      viewportWidth: 756,
      dayWidth: 100,
      dayCount: 49,
      bufferDays: 28,
      gutterWidth: 56,
      thresholdDays: 14,
      incrementDays: 21,
      maxBufferDays: 49,
    };

    expect(getCalendarTimelineNextBufferDays({ ...baseInput, scrollLeft: 2_100 })).toBe(28);
    expect(getCalendarTimelineNextBufferDays({ ...baseInput, scrollLeft: 650 })).toBe(49);
    expect(getCalendarTimelineNextBufferDays({ ...baseInput, scrollLeft: 3_600 })).toBe(49);
  });

  it("caps progressive timeline buffering", () => {
    expect(getCalendarTimelineNextBufferDays({
      scrollLeft: 0,
      viewportWidth: 756,
      dayWidth: 100,
      dayCount: 105,
      bufferDays: 49,
    })).toBe(49);
  });

  it("detects both prefetch edges before the viewport reaches the end", () => {
    const input = {
      viewportWidth: 756,
      dayWidth: 100,
      dayCount: 105,
      gutterWidth: 56,
      thresholdDays: 14,
    };

    expect(isCalendarTimelineNearBufferEdge({ ...input, scrollLeft: 1_500 })).toBe(false);
    expect(isCalendarTimelineNearBufferEdge({ ...input, scrollLeft: 1_400 })).toBe(true);
    expect(isCalendarTimelineNearBufferEdge({ ...input, scrollLeft: 8_400 })).toBe(true);
  });
});
