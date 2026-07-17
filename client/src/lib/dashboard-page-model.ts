import type { ReactNode } from "react";
import { tabPermission } from "@shared/schema";
import type {
  DashboardLayoutState,
  DashboardSavedLayout,
  DashboardWidgetConstraints,
} from "@/lib/dashboard-layout";

export const DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY = "streamdesk.dashboard.widgetLayout.v2";
export const LEGACY_DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY = "streamdesk.dashboard.widgetOrder.v1";
export const DASHBOARD_GRID_ROW_HEIGHT = 12;
export const DASHBOARD_GRID_GAP = 8;

export type DashboardWidgetId =
  | "status"
  | "location-issues"
  | "attention-summary"
  | "work-progress"
  | "deadline-tasks"
  | "overdue-tasks"
  | "my-workload"
  | "unassigned-tasks"
  | "team-workload"
  | "equipment-current-tasks"
  | "equipment-attention"
  | "upcoming-events"
  | "active-projects"
  | "current-activity"
  | "vmix-scheduler"
  | "quick-calendar"
  | "streaming-stats"
  | "system-status"
  | "equipment-status";

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  layout: DashboardWidgetConstraints;
  render: () => ReactNode;
}

export type DashboardUser = {
  id?: string | number | null;
  permissions?: unknown;
  [key: string]: unknown;
};

function getBrowserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getCurrentUser(storage: Pick<Storage, "getItem"> | null = getBrowserStorage()): DashboardUser | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem("streamstudio_user");
    return raw ? JSON.parse(raw) as DashboardUser : null;
  } catch {
    return null;
  }
}

export function canAccessTab(user: DashboardUser | null, tabKey: string): boolean {
  if (!user) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions.map(String) : [];
  const hasTabPermissions = permissions.some((permission) => permission.startsWith("tab:"));
  if (hasTabPermissions) return permissions.includes(tabPermission(tabKey));
  return true;
}

export function getDashboardLayoutStorageKey({
  userId,
  workspaceType,
  companyId,
}: {
  userId?: string | number | null;
  workspaceType?: string | null;
  companyId?: string | number | null;
}) {
  return [
    DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY,
    String(userId || "anonymous"),
    String(workspaceType || "none"),
    String(companyId || "personal"),
  ].join(":");
}

export function readSavedWidgetLayout(
  storageKey = DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY,
  storage: Pick<Storage, "getItem"> | null = getBrowserStorage(),
): DashboardSavedLayout {
  if (!storage) return [];
  try {
    const raw =
      storage.getItem(storageKey) ??
      storage.getItem(DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY) ??
      storage.getItem(LEGACY_DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed && typeof parsed === "object") return parsed as DashboardSavedLayout;
    return [];
  } catch {
    return [];
  }
}

export function saveWidgetLayout(
  layout: DashboardLayoutState,
  storageKey = DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY,
  storage: Pick<Storage, "setItem"> | null = getBrowserStorage(),
) {
  if (!storage) return;
  storage.setItem(storageKey, JSON.stringify(layout));
}
