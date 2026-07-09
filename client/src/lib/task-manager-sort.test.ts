import { describe, expect, it } from "vitest";
import { compareTaskManagerCards, type TaskManagerSortableCard, type TaskManagerSortableList } from "./task-manager-sort";

const lists = new Map<string, TaskManagerSortableList>([
  ["active", { id: "active", type: "active" }],
  ["done", { id: "done", type: "closed" }],
]);

const card = (overrides: Partial<TaskManagerSortableCard>): TaskManagerSortableCard => ({
  id: "card",
  listId: "active",
  title: "Card",
  priority: "medium",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
  ...overrides,
});

describe("compareTaskManagerCards", () => {
  it("sorts deadlines as overdue first, nearest future next, and no deadline last", () => {
    const sorted = [
      card({ id: "no-deadline", dueDate: null }),
      card({ id: "future-late", dueDate: "2026-07-12T12:00:00.000Z" }),
      card({ id: "overdue", dueDate: "2026-07-05T12:00:00.000Z" }),
      card({ id: "future-near", dueDate: "2026-07-10T12:00:00.000Z" }),
    ].sort((left, right) =>
      compareTaskManagerCards(left, right, {
        sortBy: "deadline",
        sortDirection: "asc",
        listsById: lists,
        now: new Date("2026-07-09T12:00:00.000Z"),
      }),
    );

    expect(sorted.map((item) => item.id)).toEqual(["overdue", "future-near", "future-late", "no-deadline"]);
  });
});
