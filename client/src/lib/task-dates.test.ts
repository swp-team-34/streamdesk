import { describe, expect, it } from "vitest";
import {
  buildQuarterHourOptions,
  combineDateWithTime,
  moveDateRange,
  normalizeDateRange,
  resizeDateRangeEnd,
  roundDateToQuarterHour,
} from "./task-dates";

describe("task date helpers", () => {
  it("builds 15-minute time options for a full day", () => {
    const options = buildQuarterHourOptions();

    expect(options).toHaveLength(96);
    expect(options.slice(0, 5)).toEqual(["00:00", "00:15", "00:30", "00:45", "01:00"]);
    expect(options.at(-1)).toBe("23:45");
  });

  it("combines a calendar date with a selected time", () => {
    const result = combineDateWithTime(new Date(2026, 5, 26, 9, 5), "14:30");

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(26);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it("rounds arbitrary dates down to the nearest quarter hour", () => {
    const rounded = roundDateToQuarterHour(new Date(2026, 5, 26, 14, 44, 59));

    expect(rounded.getHours()).toBe(14);
    expect(rounded.getMinutes()).toBe(30);
    expect(rounded.getSeconds()).toBe(0);
    expect(rounded.getMilliseconds()).toBe(0);
  });

  it("normalizes invalid ranges to the default duration", () => {
    const start = new Date(2026, 5, 27, 9, 0);
    const end = new Date(2026, 5, 27, 7, 45);

    const normalized = normalizeDateRange(start, end, 60);

    expect(normalized.start.getTime()).toBe(start.getTime());
    expect(normalized.end.getHours()).toBe(10);
    expect(normalized.end.getMinutes()).toBe(0);
  });

  it("moves ranges while preserving duration", () => {
    const moved = moveDateRange(
      {
        start: new Date(2026, 5, 27, 9, 0),
        end: new Date(2026, 5, 27, 10, 30),
      },
      new Date(2026, 5, 28, 14, 30),
    );

    expect(moved.start.getDate()).toBe(28);
    expect(moved.start.getHours()).toBe(14);
    expect(moved.start.getMinutes()).toBe(30);
    expect(moved.end.getHours()).toBe(16);
    expect(moved.end.getMinutes()).toBe(0);
  });

  it("resizes range end with a 15-minute minimum duration", () => {
    const resized = resizeDateRangeEnd(
      new Date(2026, 5, 27, 9, 0),
      new Date(2026, 5, 27, 8, 45),
    );

    expect(resized.end.getHours()).toBe(9);
    expect(resized.end.getMinutes()).toBe(15);
  });
});
