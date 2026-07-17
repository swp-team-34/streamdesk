import { beforeEach, describe, expect, it } from "vitest";
import {
  DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY,
  LEGACY_DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY,
  canAccessTab,
  getCurrentUser,
  getDashboardLayoutStorageKey,
  readSavedWidgetLayout,
  saveWidgetLayout,
} from "./dashboard-page-model";
import type { DashboardLayoutState } from "./dashboard-layout";

describe("dashboard page model", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads the current user and applies tab permissions only when configured", () => {
    window.localStorage.setItem("streamstudio_user", JSON.stringify({
      id: "user-1",
      permissions: ["tab:tasks"],
    }));
    const user = getCurrentUser();

    expect(user?.id).toBe("user-1");
    expect(canAccessTab(user, "tasks")).toBe(true);
    expect(canAccessTab(user, "equipment")).toBe(false);
    expect(canAccessTab({ permissions: ["company:manage"] }, "equipment")).toBe(true);
  });

  it("scopes saved layouts by user and workspace", () => {
    expect(getDashboardLayoutStorageKey({
      userId: "user-1",
      workspaceType: "company",
      companyId: "company-2",
    })).toBe(`${DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY}:user-1:company:company-2`);
  });

  it("loads legacy widget order when no scoped or current layout exists", () => {
    window.localStorage.setItem(LEGACY_DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(["status", 7]));

    expect(readSavedWidgetLayout("missing-scoped-layout")).toEqual(["status", "7"]);
  });

  it("persists and reloads a versioned layout", () => {
    const layout: DashboardLayoutState = {
      version: 2,
      order: ["status"],
      hidden: [],
      items: { status: { x: 0, y: 0, w: 12, h: 8 } },
    };

    saveWidgetLayout(layout, "scoped-layout");

    expect(readSavedWidgetLayout("scoped-layout")).toEqual(layout);
  });

  it("recovers malformed saved data", () => {
    window.localStorage.setItem(DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY, "{");

    expect(readSavedWidgetLayout()).toEqual([]);
    expect(getCurrentUser({ getItem: () => "{" })).toBeNull();
  });
});
