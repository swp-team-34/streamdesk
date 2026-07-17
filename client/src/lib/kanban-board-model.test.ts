import { describe, expect, it } from "vitest";
import {
  getCardLocationIds,
  getCompletionSummary,
  getSubtaskProgress,
  moveKanbanCards,
  normalizeCustomFieldDefinitions,
  normalizeCustomFieldOptions,
  normalizeLabelGroups,
  normalizeLabelIds,
  normalizeLocationIds,
  normalizeSubtasks,
  reorderKanbanLists,
  type KanbanCardView,
  type KanbanListType,
  type KanbanListView,
} from "./kanban-board-model";

function createList(
  id: string,
  position: number,
  type: KanbanListType = "active",
): KanbanListView {
  return {
    id,
    boardId: "board-1",
    type,
    position,
    name: id,
  };
}

function createCard(
  id: string,
  listId: string,
  position: number,
  overrides: Partial<KanbanCardView> = {},
): KanbanCardView {
  return {
    id,
    boardId: "board-1",
    listId,
    title: id,
    position,
    priority: "medium",
    creatorUserId: "user-1",
    ...overrides,
  };
}

describe("Kanban board model", () => {
  it("normalizes linked ids and keeps the legacy location fallback", () => {
    expect(normalizeLabelIds(["label-1", "label-1", "", "label-2"]))
      .toEqual(["label-1", "label-2"]);
    expect(normalizeLocationIds(["location-1", "location-1", "location-2"]))
      .toEqual(["location-1", "location-2"]);
    expect(getCardLocationIds(createCard("card-1", "list-1", 0, {
      locationId: "legacy-location",
      locationIds: [],
    }))).toEqual(["legacy-location"]);
    expect(getCardLocationIds(createCard("card-1", "list-1", 0, {
      locationId: "legacy-location",
      locationIds: ["linked-location"],
    }))).toEqual(["linked-location"]);
  });

  it("calculates completion from closed and archived lists", () => {
    const lists = [
      createList("active", 0),
      createList("closed", 1, "closed"),
      createList("archive", 2, "archive"),
    ];
    const cards = [
      createCard("open", "active", 0),
      createCard("done", "closed", 0),
      createCard("archived", "archive", 0),
    ];

    expect(getCompletionSummary(cards, new Map(lists.map((list) => [list.id, list]))))
      .toEqual({ total: 3, completed: 2, percent: 67 });
    expect(getCompletionSummary([], new Map()))
      .toEqual({ total: 0, completed: 0, percent: 0 });
  });

  it("normalizes board metadata without archived or empty entries", () => {
    expect(normalizeCustomFieldDefinitions([
      { id: "second", name: "Second", type: "text", position: 2 },
      { id: "archived", name: "Archived", type: "text", position: 0, archivedAt: "2026-01-01" },
      { id: "first", name: "First", type: "text", position: 1 },
      { id: "empty", name: "", type: "text", position: 0 },
    ]).map((field) => field.id)).toEqual(["first", "second"]);
    expect(normalizeLabelGroups([
      { id: "active", name: "Active" },
      { id: "archived", name: "Archived", archivedAt: "2026-01-01" },
      { id: "empty", name: "" },
    ]).map((group) => group.id)).toEqual(["active"]);
    expect(normalizeCustomFieldOptions(" Alpha, Beta,Alpha, , Beta "))
      .toEqual(["Alpha", "Beta"]);
  });

  it("normalizes subtasks and reports their progress", () => {
    const subtasks = normalizeSubtasks([
      { id: " first ", title: " First task ", completed: true },
      { id: "second", title: "Second task" },
      { id: "", title: "Invalid" },
      { id: "invalid", title: " " },
    ]);

    expect(subtasks).toEqual([
      { id: "first", title: "First task", completed: true },
      { id: "second", title: "Second task", completed: false },
    ]);
    expect(getSubtaskProgress(subtasks)).toEqual({ total: 2, completed: 1 });
  });

  it("reorders cards inside one list and preserves unrelated cards", () => {
    const cards = [
      createCard("first", "source", 0),
      createCard("second", "source", 1),
      createCard("third", "source", 2),
      createCard("other", "other", 0, { title: "Preserved" }),
    ];

    const result = moveKanbanCards(cards, {
      cardId: "first",
      targetListId: "source",
      targetPosition: 2,
    });

    expect(result.filter((card) => card.listId === "source").map(({ id, position }) => ({ id, position })))
      .toEqual([
        { id: "second", position: 0 },
        { id: "third", position: 1 },
        { id: "first", position: 2 },
      ]);
    expect(result.find((card) => card.id === "other")?.title).toBe("Preserved");
  });

  it("moves cards between lists and normalizes both list positions", () => {
    const cards = [
      createCard("source-first", "source", 0),
      createCard("moving", "source", 1),
      createCard("source-last", "source", 2),
      createCard("target-first", "target", 0),
      createCard("target-last", "target", 1),
    ];

    const result = moveKanbanCards(cards, {
      cardId: "moving",
      targetListId: "target",
      targetPosition: 1,
    });

    expect(result.filter((card) => card.listId === "source").map(({ id, position }) => ({ id, position })))
      .toEqual([
        { id: "source-first", position: 0 },
        { id: "source-last", position: 1 },
      ]);
    expect(result.filter((card) => card.listId === "target").map(({ id, position }) => ({ id, position })))
      .toEqual([
        { id: "target-first", position: 0 },
        { id: "moving", position: 1 },
        { id: "target-last", position: 2 },
      ]);
  });

  it("keeps the current array for an unknown card and follows the requested list order", () => {
    const cards = [createCard("card-1", "list-1", 0)];
    expect(moveKanbanCards(cards, {
      cardId: "missing",
      targetListId: "list-2",
      targetPosition: 0,
    })).toBe(cards);

    const lists = [createList("first", 0), createList("second", 1), createList("third", 2)];
    expect(reorderKanbanLists(lists, ["third", "missing", "first"]).map(({ id, position }) => ({ id, position })))
      .toEqual([
        { id: "third", position: 0 },
        { id: "first", position: 2 },
      ]);
  });
});
