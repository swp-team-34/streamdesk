import { describe, expect, it } from "vitest";
import {
  createCalendarEventTypeValue,
  DEFAULT_CALENDAR_EVENT_TYPES,
  normalizeCalendarEventTypes,
} from "./calendar-event-types";

describe("calendar event types", () => {
  it("normalizes valid values and returns isolated defaults for invalid settings", () => {
    expect(normalizeCalendarEventTypes([
      { value: "MEETING", label: "  Встреча  " },
    ])).toEqual([{ value: "meeting", label: "Встреча" }]);

    const firstFallback = normalizeCalendarEventTypes([]);
    firstFallback[0].label = "Изменено";
    expect(normalizeCalendarEventTypes([])).toEqual(DEFAULT_CALENDAR_EVENT_TYPES);
  });

  it("creates stable unique values for custom labels", () => {
    const existing = [{ value: "event-2", label: "Другое" }];

    expect(createCalendarEventTypeValue("Podcast recording", existing)).toBe("podcast-recording");
    expect(createCalendarEventTypeValue("Событие", existing)).toBe("event-2-2");
  });
});
