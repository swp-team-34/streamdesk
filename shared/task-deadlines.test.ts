import { describe, expect, it } from "vitest";
import {
  getTaskDeadlineStatus,
  getTaskDeadlineTimestamp,
  isTaskDeadlineOverdue,
} from "./task-deadlines";

describe("shared task deadline semantics", () => {
  it("uses an exact instant for date-time deadlines", () => {
    const now = new Date("2026-07-16T12:00:00.000Z");

    expect(getTaskDeadlineStatus("2026-07-16T11:59:59.000Z", { now })).toBe("overdue");
    expect(getTaskDeadlineStatus("2026-07-16T12:00:00.000Z", { now })).toBe("soon");
    expect(getTaskDeadlineStatus("2026-07-18T12:00:00.000Z", { now })).toBe("upcoming");
  });

  it("keeps a Moscow date-only deadline active through the end of that date", () => {
    const lateSameDay = new Date("2026-07-16T20:30:00.000Z");
    const startOfNextDay = new Date("2026-07-16T21:00:00.000Z");

    expect(isTaskDeadlineOverdue("2026-07-16", { now: lateSameDay })).toBe(false);
    expect(isTaskDeadlineOverdue("2026-07-16", { now: startOfNextDay })).toBe(true);
  });

  it("parses timezone-less date-times in the configured application timezone", () => {
    expect(getTaskDeadlineTimestamp("2026-07-16T15:00")).toBe(
      new Date("2026-07-16T12:00:00.000Z").getTime(),
    );
  });

  it("never marks a completed card overdue", () => {
    expect(
      getTaskDeadlineStatus("2026-07-01T12:00:00.000Z", {
        isComplete: true,
        now: new Date("2026-07-16T12:00:00.000Z"),
      }),
    ).toBe("complete");
  });

  it("treats missing and invalid deadlines as none", () => {
    expect(getTaskDeadlineStatus(null)).toBe("none");
    expect(getTaskDeadlineStatus("not-a-date")).toBe("none");
    expect(getTaskDeadlineStatus("2026-02-30")).toBe("none");
  });
});
