import { describe, expect, it } from "vitest";
import {
  KANBAN_EMPTY_FIELD_FILTER,
  getKanbanCustomFieldFilterHelp,
  matchesKanbanCustomFieldFilter,
} from "./kanban-custom-field-filters";

describe("Kanban custom field filter help", () => {
  it("describes option-based controls", () => {
    expect(getKanbanCustomFieldFilterHelp({ type: "select" })).toContain("один вариант");
    expect(getKanbanCustomFieldFilterHelp({ type: "multi-select" })).toContain("содержащие");
  });

  it("matches exact options and an explicit empty value", () => {
    expect(matchesKanbanCustomFieldFilter(
      { type: "select" },
      "Broadcast",
      "Broadcast",
      "Broadcast",
    )).toBe(true);
    expect(matchesKanbanCustomFieldFilter(
      { type: "multi-select" },
      ["Camera", "Sound"],
      "Sound",
      "Camera, Sound",
    )).toBe(true);
    expect(matchesKanbanCustomFieldFilter(
      { type: "text" },
      null,
      KANBAN_EMPTY_FIELD_FILTER,
      "",
    )).toBe(true);
  });
});
