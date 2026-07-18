import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY,
  getDashboardLayoutStorageKey,
} from "@/lib/dashboard-page-model";
import type { DashboardLayoutState } from "@/lib/dashboard-layout";
import Dashboard from "./dashboard";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: string[] }) => ({
      data: queryKey[0] === "/api/dashboard/stats" ? {} : [],
      isLoading: false,
      isError: false,
    }),
  };
});

vi.mock("@/hooks/use-websocket", () => ({
  useWebSocket: () => undefined,
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    workspace: {
      type: "company",
      companyId: "company-42",
      requiresSelection: false,
      source: "session",
    },
  }),
}));

vi.mock("@/components/dashboard/dashboard-profile-card", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/dashboard-countdown-widget", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/dashboard-services-section", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/dashboard-widget-definitions", () => ({
  buildDashboardWidgetDefinitions: () => [
    {
      id: "status",
      title: "Статус",
      layout: { defaultW: 12, defaultH: 5, minW: 6, maxW: 12, minH: 5, maxH: 12 },
      render: () => null,
    },
    {
      id: "work-progress",
      title: "Ход работ",
      layout: { defaultW: 12, defaultH: 5, minW: 6, maxW: 12, minH: 5, maxH: 12 },
      render: () => null,
    },
  ],
}));

vi.mock("@/components/dashboard/dashboard-grid-widget", () => ({
  DashboardGridWidget: ({ widget }: { widget: { id: string; title: string } }) => (
    <div data-testid={`dashboard-widget-${widget.id}`}>{widget.title}</div>
  ),
}));

const unscopedLayout: DashboardLayoutState = {
  version: 2,
  order: ["status", "work-progress"],
  hidden: [],
  items: {
    status: { x: 0, y: 0, w: 12, h: 5 },
    "work-progress": { x: 0, y: 6, w: 12, h: 5 },
  },
};

const scopedLayout: DashboardLayoutState = {
  version: 2,
  order: ["work-progress", "status"],
  hidden: [],
  items: {
    "work-progress": { x: 0, y: 0, w: 12, h: 5 },
    status: { x: 0, y: 6, w: 12, h: 5 },
  },
};

describe("dashboard scoped layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("streamstudio_user", JSON.stringify({ id: "user-7" }));
    window.localStorage.setItem(DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(unscopedLayout));
    window.localStorage.setItem(getDashboardLayoutStorageKey({
      userId: "user-7",
      workspaceType: "company",
      companyId: "company-42",
    }), JSON.stringify(scopedLayout));
  });

  afterEach(cleanup);

  it("uses the active workspace layout on the first render", () => {
    render(<Dashboard />);

    expect(screen.getAllByTestId(/^dashboard-widget-/).map((node) => node.dataset.testid)).toEqual([
      "dashboard-widget-work-progress",
      "dashboard-widget-status",
    ]);
  });
});
