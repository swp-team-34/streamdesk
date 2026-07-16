import { describe, expect, it } from "vitest";
import {
  updateOpenedProject,
  upsertProjectKanbanBoard,
} from "./project-kanban";

describe("project Kanban cache updates", () => {
  it("adds a newly created project board to the canonical board cache", () => {
    const board = { id: "board-2", name: "Project board", projectId: "project-1" };

    expect(upsertProjectKanbanBoard([
      { id: "board-1", name: "Existing board", projectId: null },
    ], board)).toEqual([
      board,
      { id: "board-1", name: "Existing board", projectId: null },
    ]);
  });

  it("updates the project card without removing other cached projects", () => {
    expect(updateOpenedProject([
      { id: "project-1", name: "Project", showInTaskManager: false },
      { id: "project-2", name: "Other", showInTaskManager: false },
    ], {
      id: "project-1",
      name: "Project",
      showInTaskManager: true,
    })).toEqual([
      { id: "project-1", name: "Project", showInTaskManager: true },
      { id: "project-2", name: "Other", showInTaskManager: false },
    ]);
  });
});
