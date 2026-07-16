import { describe, expect, it } from "vitest";
import {
  moveDashboardWidget,
  normalizeDashboardLayoutState,
  normalizeDashboardWidgetOrder,
  reorderDashboardWidgetIds,
  resetDashboardLayout,
  resizeDashboardWidget,
  type DashboardWidgetConstraints,
} from "./dashboard-layout";

const constraints: Record<string, DashboardWidgetConstraints> = {
  stats: { defaultW: 6, defaultH: 10, minW: 3, maxW: 12, minH: 6, maxH: 24 },
  activity: { defaultW: 6, defaultH: 14, minW: 4, maxW: 12, minH: 8, maxH: 28 },
  calendar: { defaultW: 8, defaultH: 16, minW: 4, maxW: 12, minH: 8, maxH: 30 },
};

function expectNoOverlap(layout: ReturnType<typeof normalizeDashboardLayoutState>) {
  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  for (let index = 0; index < visible.length; index += 1) {
    const left = layout.items[visible[index]];
    for (let otherIndex = index + 1; otherIndex < visible.length; otherIndex += 1) {
      const right = layout.items[visible[otherIndex]];
      const overlaps =
        left.x < right.x + right.w &&
        left.x + left.w > right.x &&
        left.y < right.y + right.h &&
        left.y + left.h > right.y;
      expect(overlaps).toBe(false);
    }
  }
}

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

  it("migrates legacy size storage into explicit grid placements", () => {
    const layout = normalizeDashboardLayoutState(
      {
        order: ["calendar", "stats"],
        hidden: ["activity"],
        sizes: { calendar: "full", stats: "compact" },
      },
      ["stats", "activity", "calendar"],
      constraints,
    );

    expect(layout.version).toBe(2);
    expect(layout.order).toEqual(["calendar", "stats", "activity"]);
    expect(layout.hidden).toEqual(["activity"]);
    expect(layout.items.calendar.w).toBe(12);
    expect(layout.items.stats.w).toBe(4);
    expectNoOverlap(layout);
  });

  it("recovers malformed saved positions and dimensions without overlap", () => {
    const layout = normalizeDashboardLayoutState(
      {
        version: 2,
        order: ["stats", "activity", "calendar"],
        hidden: [],
        items: {
          stats: { x: Number.NaN, y: Number.NaN, w: 99, h: 1 },
          activity: { x: 0, y: 0, w: 6, h: 14 },
          calendar: { x: 0, y: 0, w: 8, h: 16 },
        },
      },
      ["stats", "activity", "calendar"],
      constraints,
    );

    expect(layout.items.stats).toMatchObject({ x: 0, y: 0, w: 12, h: 6 });
    expectNoOverlap(layout);
  });

  it("keeps the dragged widget at a valid target and deterministically pushes collisions", () => {
    const initial = normalizeDashboardLayoutState(null, ["stats", "activity", "calendar"], constraints);
    const first = moveDashboardWidget(initial, "calendar", { x: 0, y: 0 }, constraints);
    const second = moveDashboardWidget(initial, "calendar", { x: 0, y: 0 }, constraints);

    expect(first).toEqual(second);
    expect(first.items.calendar).toMatchObject({ x: 0, y: 0 });
    expectNoOverlap(first);
  });

  it("resizes in both dimensions, clamps bounds, and reflows neighbors", () => {
    const initial = normalizeDashboardLayoutState(null, ["stats", "activity", "calendar"], constraints);
    const resized = resizeDashboardWidget(initial, "stats", { w: 99, h: 99 }, constraints);

    expect(resized.items.stats).toMatchObject({ w: 12, h: 24 });
    expectNoOverlap(resized);
  });

  it("resets positions while preserving sizes and hidden widgets", () => {
    const initial = normalizeDashboardLayoutState(null, ["stats", "activity", "calendar"], constraints);
    const customized = {
      ...resizeDashboardWidget(initial, "stats", { w: 9, h: 17 }, constraints),
      hidden: ["activity"],
    };
    const reset = resetDashboardLayout(customized, ["stats", "activity", "calendar"], constraints, "positions");

    expect(reset.items.stats).toMatchObject({ w: 9, h: 17 });
    expect(reset.hidden).toEqual(["activity"]);
    expect(reset.order).toEqual(["stats", "activity", "calendar"]);
    expectNoOverlap(reset);
  });

  it("resets positions and sizes while preserving hidden widgets", () => {
    const initial = normalizeDashboardLayoutState(null, ["stats", "activity", "calendar"], constraints);
    const customized = {
      ...resizeDashboardWidget(initial, "stats", { w: 9, h: 17 }, constraints),
      hidden: ["activity"],
    };
    const reset = resetDashboardLayout(customized, ["stats", "activity", "calendar"], constraints, "positions-and-sizes");

    expect(reset.items.stats).toMatchObject({ w: 6, h: 10 });
    expect(reset.hidden).toEqual(["activity"]);
    expectNoOverlap(reset);
  });
});
