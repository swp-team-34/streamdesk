import { describe, expect, it } from "vitest";
import {
  getCalendarEventHref,
  getEquipmentHref,
  getKanbanCardHref,
  getLocalDateKey,
  getProjectHref,
  readCalendarRouteState,
} from "./entity-navigation";

describe("entity navigation", () => {
  it("builds deep links for dashboard entities", () => {
    expect(getKanbanCardHref("board 1", "card 2")).toBe("/tasks?boardId=board+1&cardId=card+2");
    expect(getProjectHref("project-1")).toBe("/projects?projectId=project-1");
    expect(getEquipmentHref("equipment-1")).toBe("/equipment?equipmentId=equipment-1");
    expect(getCalendarEventHref("event-1", "2026-07-17T14:00:00+03:00"))
      .toBe("/calendar?date=2026-07-17&view=day&eventId=event-1");
  });

  it("reads a valid calendar deep link and ignores invalid values", () => {
    const valid = readCalendarRouteState("?date=2026-07-17&view=day&eventId=event-1");
    expect(valid.date?.getFullYear()).toBe(2026);
    expect(valid.date?.getMonth()).toBe(6);
    expect(valid.date?.getDate()).toBe(17);
    expect(valid.view).toBe("day");
    expect(valid.eventId).toBe("event-1");

    expect(readCalendarRouteState("?date=nope&view=agenda")).toEqual({
      date: null,
      view: null,
      eventId: null,
    });
  });

  it("rejects impossible date-only values instead of normalizing them into another day", () => {
    expect(getLocalDateKey("2026-02-31")).toBe("");
    expect(getLocalDateKey("2026-00-10")).toBe("");

    expect(readCalendarRouteState("?date=2026-02-31&view=day")).toEqual({
      date: null,
      view: "day",
      eventId: null,
    });
  });
});
