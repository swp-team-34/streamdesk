import { describe, expect, it } from "vitest";
import { buildDashboardWidgetDefinitions } from "./dashboard-widget-definitions";

const build = (permissions?: string[]) => buildDashboardWidgetDefinitions({
  currentUser: permissions ? { id: "user-1", permissions } : null,
  stats: {},
  events: [],
  systems: [],
  equipment: [],
  streams: [],
});

describe("dashboard widget definitions", () => {
  it("keeps the status widget and all feature widgets for unrestricted users", () => {
    const definitions = build();
    const ids = definitions.map((widget) => widget.id);

    expect(ids[0]).toBe("status");
    expect(definitions[0].layout).toMatchObject({ defaultH: 5, minH: 5 });
    expect(ids).toContain("work-progress");
    expect(ids).toContain("quick-calendar");
    expect(ids).toContain("equipment-status");
  });

  it("only exposes widgets backed by permitted tabs", () => {
    const ids = build(["tab:calendar"]).map((widget) => widget.id);

    expect(ids).toEqual(["status", "upcoming-events", "current-activity", "quick-calendar"]);
  });
});
