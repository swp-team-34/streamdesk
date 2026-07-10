import { describe, expect, it } from "vitest";
import {
  calculateDashboardWidgetRowSpan,
  normalizeDashboardHiddenWidgetIds,
  normalizeDashboardLayoutState,
  normalizeDashboardWidgetOrder,
  normalizeDashboardWidgetSizes,
  reorderDashboardWidgetIds,
} from "./dashboard-layout";

describe("dashboard layout helpers", () => {
  it("keeps saved widget order while adding missing visible widgets and dropping unknown ids", () => {
    expect(normalizeDashboardWidgetOrder(["unknown", "calendar", "stats"], ["stats", "activity", "calendar"])).toEqual([
      "calendar",
      "stats",
      "activity",
    ]);
  });

  it("reorders widget ids without duplicating entries", () => {
    expect(reorderDashboardWidgetIds(["stats", "activity", "calendar"], 0, 2)).toEqual([
      "activity",
      "calendar",
      "stats",
    ]);
  });

  it("normalizes widget sizes with defaults and ignores invalid saved values", () => {
    expect(
      normalizeDashboardWidgetSizes(
        { stats: "wide", calendar: "giant" },
        ["stats", "activity", "calendar"],
        { activity: "compact", calendar: "normal" },
      ),
    ).toEqual({
      stats: "wide",
      activity: "compact",
      calendar: "normal",
    });
  });

  it("supports legacy array layout storage", () => {
    expect(
      normalizeDashboardLayoutState(["calendar", "stats"], ["stats", "activity", "calendar"], {
        stats: "full",
        activity: "normal",
        calendar: "wide",
      }),
    ).toEqual({
      order: ["calendar", "stats", "activity"],
      hidden: [],
      sizes: {
        calendar: "wide",
        stats: "full",
        activity: "normal",
      },
    });
  });

  it("calculates masonry row span from measured widget height", () => {
    expect(calculateDashboardWidgetRowSpan(96)).toBe(9);
    expect(calculateDashboardWidgetRowSpan(241)).toBe(18);
  });

  it("normalizes hidden widget ids against currently visible widgets", () => {
    expect(normalizeDashboardHiddenWidgetIds(["stats", "unknown", "stats"], ["stats", "activity"])).toEqual(["stats"]);
  });

  it("keeps hidden widget ids in normalized layout state", () => {
    expect(
      normalizeDashboardLayoutState(
        { order: ["activity", "stats"], sizes: { stats: "wide" }, hidden: ["stats", "missing"] },
        ["stats", "activity"],
        { stats: "normal", activity: "compact" },
      ),
    ).toEqual({
      order: ["activity", "stats"],
      hidden: ["stats"],
      sizes: {
        activity: "compact",
        stats: "wide",
      },
    });
  });
});
