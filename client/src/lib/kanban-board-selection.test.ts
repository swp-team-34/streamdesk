import { describe, expect, it } from "vitest";
import {
  getKanbanBoardSelectionStorageKey,
  resolveKanbanBoardSelection,
} from "./kanban-board-selection";

describe("Kanban board selection", () => {
  it("keeps selections isolated by user and workspace", () => {
    expect(getKanbanBoardSelectionStorageKey({
      userId: "user-1",
      workspaceType: "company",
      companyId: "company-1",
    })).toBe("streamdesk.tasks.v2.selectedBoard:user-1:company:company-1");
    expect(getKanbanBoardSelectionStorageKey({
      userId: "user-1",
      workspaceType: "personal",
    })).toBe("streamdesk.tasks.v2.selectedBoard:user-1:personal:personal");
  });

  it("prefers a deep link, then current or stored selection, before the first board", () => {
    const boardIds = ["first", "stored", "requested"];
    expect(resolveKanbanBoardSelection({
      boardIds,
      requestedBoardId: "requested",
      currentBoardId: "first",
      storedBoardId: "stored",
    })).toBe("requested");
    expect(resolveKanbanBoardSelection({
      boardIds,
      requestedBoardId: "missing",
      storedBoardId: "stored",
    })).toBe("stored");
    expect(resolveKanbanBoardSelection({
      boardIds,
      storedBoardId: "missing",
    })).toBe("first");
  });
});
