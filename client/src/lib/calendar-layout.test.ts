import { describe, expect, it } from "vitest";
import {
  getCalendarEntryDensity,
  getCalendarEntryLaneLayout,
  getCalendarLaneStyle,
  getCalendarResizeHandleClassName,
} from "./calendar-layout";

const entry = (id: string, start: string, end: string, kind = "task") => ({
  id,
  kind,
  startTime: `2026-07-10T${start}:00`,
  endTime: `2026-07-10T${end}:00`,
});

describe("calendar layout helpers", () => {
  it("places overlapping entries into separate lanes", () => {
    const layout = getCalendarEntryLaneLayout([
      entry("a", "09:00", "10:00"),
      entry("b", "09:30", "10:30"),
      entry("c", "10:30", "11:00"),
    ], (item) => `${item.kind}:${item.id}`);

    expect(layout.get("task:a")).toEqual({ laneIndex: 0, totalLanes: 2 });
    expect(layout.get("task:b")).toEqual({ laneIndex: 1, totalLanes: 2 });
    expect(layout.get("task:c")).toEqual({ laneIndex: 0, totalLanes: 1 });
  });

  it("keeps task and kanban entries with the same id as separate layout keys", () => {
    const layout = getCalendarEntryLaneLayout([
      entry("same", "12:00", "13:00", "task"),
      entry("same", "12:15", "13:00", "kanban"),
    ], (item) => `${item.kind}:${item.id}`);

    expect(layout.get("task:same")).toEqual({ laneIndex: 0, totalLanes: 2 });
    expect(layout.get("kanban:same")).toEqual({ laneIndex: 1, totalLanes: 2 });
  });

  it("returns a full width style for non-overlapping entries", () => {
    const layout = getCalendarEntryLaneLayout([entry("a", "09:00", "10:00")], (item) => `${item.kind}:${item.id}`);

    expect(getCalendarLaneStyle("task:a", layout)).toEqual({ left: "2%", width: "96%" });
  });

  it("keeps only the title on small calendar cards and shrinks the title on tiny cards", () => {
    expect(getCalendarEntryDensity(72)).toBe("full");
    expect(getCalendarEntryDensity(42)).toBe("title-only");
    expect(getCalendarEntryDensity(24)).toBe("tiny-title");
  });

  it("uses smaller resize handles for short calendar cards", () => {
    expect(getCalendarResizeHandleClassName(72)).toContain("h-3");
    expect(getCalendarResizeHandleClassName(24)).toContain("h-1.5");
  });
});
