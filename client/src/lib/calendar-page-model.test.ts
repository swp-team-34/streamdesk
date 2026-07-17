import { beforeEach, describe, expect, it } from "vitest";
import {
  CALENDAR_SETTINGS_STORAGE_KEY,
  EVENT_COLOR_STORAGE_KEY,
  buildCalendarEntries,
  entryOverlapsDate,
  getCalendarEntryKey,
  getEventTypeText,
  isAllDayEntry,
  loadCalendarSettings,
  normalizeHexColor,
  readEventColorMap,
  roundDateToStep,
  slotNumberToTime,
  type EventEntry,
} from "./calendar-page-model";

const eventEntry = (startTime: string, endTime: string): EventEntry => ({
  id: "event-1",
  title: "Event",
  startTime,
  endTime,
  kind: "event",
  badgeText: "Событие",
  statusLabel: null,
  responsibleLabel: null,
});

describe("calendar page model", () => {
  beforeEach(() => window.localStorage.clear());

  it("loads valid saved settings while recovering malformed values", () => {
    window.localStorage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, JSON.stringify({
      workdayStart: "8",
      workdayEnd: "bad",
      gridStep: 30,
      showWeekends: false,
    }));

    expect(loadCalendarSettings()).toMatchObject({
      workdayStart: 8,
      workdayEnd: 24,
      gridStep: 30,
      showWeekends: false,
      showAllDay: true,
    });
  });

  it("recovers invalid local storage and validates event colors", () => {
    window.localStorage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, "{");
    window.localStorage.setItem(EVENT_COLOR_STORAGE_KEY, JSON.stringify({ "event-1": "#aabbcc" }));

    expect(loadCalendarSettings().gridStep).toBe(15);
    expect(readEventColorMap()).toEqual({ "event-1": "#aabbcc" });
    expect(normalizeHexColor(" #A1b2C3 ")).toBe("#A1b2C3");
    expect(normalizeHexColor("red")).toBeNull();
  });

  it("keeps calendar time and date helpers stable", () => {
    expect(slotNumberToTime(9.5)).toBe("09:30");
    expect(roundDateToStep(new Date("2026-07-17T10:44:27"), 30).toISOString())
      .toBe(new Date("2026-07-17T10:30:00").toISOString());
    expect(getEventTypeText("recording")).toBe("Запись");
    expect(getEventTypeText()).toBe("Событие");
  });

  it("detects all-day entries and entries spanning a requested day", () => {
    const entry = eventEntry("2026-07-16T00:00:00", "2026-07-17T00:00:00");

    expect(isAllDayEntry(entry)).toBe(true);
    expect(entryOverlapsDate(entry, new Date("2026-07-17T12:00:00"))).toBe(true);
    expect(entryOverlapsDate(entry, new Date("2026-07-18T12:00:00"))).toBe(false);
  });

  it("builds event, task and Kanban entries without duplicate legacy deadlines", () => {
    const entries = buildCalendarEntries({
      events: [
        {
          id: "legacy",
          title: "Дедлайн: Prepare stage",
          description: "Задача: Prepare stage",
          startTime: "2026-07-17T10:00:00Z",
          endTime: "2026-07-17T11:00:00Z",
          type: "meeting",
          status: "scheduled",
          location: "Офис",
        },
        {
          id: "event-1",
          title: "Recording",
          startTime: "2026-07-17T12:00:00Z",
          endTime: "2026-07-17T13:00:00Z",
          type: "recording",
        },
      ],
      tasks: [{
        id: "task-1",
        title: "Prepare stage",
        status: "in_progress",
        assigneeId: "user-1",
        dueDate: "2026-07-17T15:00:00Z",
      }],
      kanbanCards: [{
        id: "card-1",
        boardId: "board-1",
        listId: "list-1",
        title: "Check stream",
        listName: "Review",
        startDate: "2026-07-17T16:00:00Z",
        assigneeUserId: "user-2",
      }],
      userNameById: new Map([
        ["user-1", "Tim"],
        ["user-2", "Alex"],
      ]),
    });

    expect(entries.map(getCalendarEntryKey)).toEqual([
      "event:event-1",
      "task:task-task-1",
      "kanban:kanban-card-1",
    ]);
    expect(entries[0].badgeText).toBe("Запись");
    expect(entries[1]).toMatchObject({ statusLabel: "В работе", responsibleLabel: "Tim" });
    expect(entries[2]).toMatchObject({ statusLabel: "Review", responsibleLabel: "Alex" });
  });
});
