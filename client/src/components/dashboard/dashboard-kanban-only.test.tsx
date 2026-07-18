import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DeadlineTasksWidget from "./deadline-tasks-widget";
import { OverdueTasksWidget } from "./follow-up-widgets";
import WorkProgressWidget from "./work-progress-widget";

afterEach(cleanup);

function renderDashboardWidget(
  element: ReactElement,
  legacyTasks: Array<Record<string, unknown>>,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        queryFn: async () => [],
        retry: false,
        staleTime: Infinity,
      },
    },
  });
  queryClient.setQueryData(["/api/kanban/cards"], []);
  queryClient.setQueryData(["/api/tasks"], legacyTasks);
  queryClient.setQueryData(["/api/users"], [{ id: "legacy-user", name: "Legacy Assignee" }]);

  return render(
    <QueryClientProvider client={queryClient}>
      {element}
    </QueryClientProvider>,
  );
}

describe("Dashboard Kanban V2 task boundary", () => {
  it("does not render Legacy Task Manager rows in the deadline widget", () => {
    renderDashboardWidget(<DeadlineTasksWidget />, [{
      id: "legacy-deadline",
      title: "Legacy deadline only",
      status: "in-progress",
      dueDate: "2099-01-01T12:00:00.000Z",
    }]);

    expect(screen.queryByText("Legacy deadline only")).not.toBeInTheDocument();
  });

  it("does not render Legacy Task Manager rows in follow-up widgets", () => {
    renderDashboardWidget(<OverdueTasksWidget />, [{
      id: "legacy-overdue",
      title: "Legacy overdue only",
      status: "in-progress",
      dueDate: "2000-01-01T12:00:00.000Z",
    }]);

    expect(screen.queryByText("Legacy overdue only")).not.toBeInTheDocument();
  });

  it("does not include Legacy Task Manager data in work-progress groups", () => {
    renderDashboardWidget(<WorkProgressWidget />, [{
      id: "legacy-progress",
      title: "Legacy progress only",
      status: "in-progress",
      assigneeId: "legacy-user",
    }]);

    expect(screen.queryByText("Legacy Assignee")).not.toBeInTheDocument();
  });
});
