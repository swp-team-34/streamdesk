import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectTaskStats } from "./project-task-stats";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: mocks.apiRequest };
});

vi.mock("@/hooks/use-websocket", () => ({ useRealtimeSubscriptions: vi.fn() }));

describe("ProjectTaskStats", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({
      json: async () => ({
        source: { type: "kanban-v2", boardIds: ["board-1"] },
        total: 4,
        done: 3,
        byStatus: { active: 1, done: 3 },
        statusNames: { active: "В работе", done: "Готово" },
        tasks: {
          total: 4,
          active: 1,
          inProgress: 1,
          completed: 3,
          overdue: 1,
          unassigned: 0,
          deadlines: { overdue: 1, dueSoon: 1, future: 1, noDeadline: 0 },
        },
        assignees: [{ userId: "user-1", name: "Tim", total: 4, active: 1, completed: 3, overdue: 1 }],
        locations: {
          total: 1,
          active: 1,
          archived: 0,
          unresolvedIssues: 1,
          bySeverity: { high: 1 },
          items: [{ id: "location-1", name: "Studio A", archived: false, unresolvedIssues: 1 }],
        },
        equipment: {
          total: 1,
          linked: 1,
          requested: 0,
          approved: 0,
          issued: 1,
          returned: 0,
          overdue: 0,
          brokenOrRepair: 0,
          items: [{ id: "equipment-1", name: "Camera", linked: true, workflowStatus: "issued", brokenOrRepair: false }],
        },
      }),
    });
  });

  it("renders Kanban, location and equipment project statistics", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectTaskStats projectId="project-1" companyId="company-1" onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("75% готово")).toBeInTheDocument();
    expect(screen.getByText("Tim")).toBeInTheDocument();
    expect(screen.getByText("Studio A")).toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();
    expect(mocks.apiRequest).toHaveBeenCalledWith("GET", "/api/projects/project-1/task-stats");
  });
});
