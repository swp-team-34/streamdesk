import { describe, expect, it } from "vitest";
import {
  serializeCardForm,
  type KanbanCardDetailForm,
} from "./kanban-card-detail-state";

function createForm(overrides: Partial<KanbanCardDetailForm> = {}): KanbanCardDetailForm {
  return {
    listId: "list-1",
    title: " Card title ",
    description: " Description ",
    priority: "medium",
    startDate: "",
    startDateHasTime: true,
    dueDate: "",
    dueDateHasTime: true,
    locationId: "",
    locationIds: [],
    initiatorUserId: "",
    responsibleUserId: "",
    assigneeUserIds: [],
    assigneeUserId: "",
    labelIds: [],
    customFieldValues: {},
    ...overrides,
  };
}

describe("Kanban card detail autosave signature", () => {
  it("normalizes text and set-like ids before serialization", () => {
    const signature = serializeCardForm(createForm({
      locationIds: ["location-2", "location-1", "location-2"],
      assigneeUserIds: ["user-2", "user-1", "user-2"],
      labelIds: ["label-2", "label-1", "label-2"],
    }));

    expect(JSON.parse(signature)).toEqual(expect.objectContaining({
      title: "Card title",
      description: "Description",
      locationIds: ["location-1", "location-2"],
      assigneeUserIds: ["user-1", "user-2"],
      labelIds: ["label-1", "label-2"],
    }));
  });

  it("produces the same signature for equivalent selection order", () => {
    const first = createForm({
      locationIds: ["location-1", "location-2"],
      assigneeUserIds: ["user-1", "user-2"],
      labelIds: ["label-1", "label-2"],
    });
    const second = createForm({
      locationIds: ["location-2", "location-1"],
      assigneeUserIds: ["user-2", "user-1"],
      labelIds: ["label-2", "label-1"],
    });

    expect(serializeCardForm(first)).toBe(serializeCardForm(second));
  });

  it("keeps legacy assignee and date-mode fields in the signature", () => {
    const signature = JSON.parse(serializeCardForm(createForm({
      assigneeUserId: "legacy-user",
      dueDate: "2026-07-20",
      dueDateHasTime: false,
      customFieldValues: { storage: "NAS" },
    })));

    expect(signature.assigneeUserIds).toEqual(["legacy-user"]);
    expect(signature.assigneeUserId).toBe("legacy-user");
    expect(signature.dueDateHasTime).toBe(false);
    expect(signature.customFieldValues).toEqual({ storage: "NAS" });
  });
});
