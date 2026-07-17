import { describe, expect, it } from "vitest";
import {
  CARD_PRIORITY_BADGE_VARIANTS,
  CARD_PRIORITY_LABELS,
  CUSTOM_FIELD_TYPE_LABELS,
  LIST_TYPE_LABELS,
  formatCustomFieldValue,
  formatFileSize,
  getEquipmentWorkflowStatusLabel,
  getEquipmentWorkflowStatusVariant,
  getKanbanHistoryActionLabel,
  toSoftColor,
} from "./kanban-presentation";

describe("Kanban presentation metadata", () => {
  it("keeps localized list, priority and field metadata stable", () => {
    expect(LIST_TYPE_LABELS).toEqual({
      active: "Активный",
      closed: "Закрытый",
      archive: "Архив",
      trash: "Корзина",
    });
    expect(CARD_PRIORITY_LABELS.urgent).toBe("Срочный");
    expect(CARD_PRIORITY_BADGE_VARIANTS.high).toBe("default");
    expect(CUSTOM_FIELD_TYPE_LABELS.person).toBe("Исполнитель");
  });

  it("creates soft colors only from supported hex values", () => {
    expect(toSoftColor("#abc", 0.2)).toBe("color-mix(in srgb, #aabbcc 20%, var(--card))");
    expect(toSoftColor("#123456", 2)).toBe("color-mix(in srgb, #123456 100%, var(--card))");
    expect(toSoftColor("#123456", -1)).toBe("color-mix(in srgb, #123456 0%, var(--card))");
    expect(toSoftColor("rgb(1, 2, 3)")).toBeUndefined();
  });

  it("formats card history actions with a safe fallback", () => {
    expect(getKanbanHistoryActionLabel("created")).toBe("Создал карточку");
    expect(getKanbanHistoryActionLabel("roles_updated")).toBe("Обновил роли карточки");
    expect(getKanbanHistoryActionLabel("custom_action")).toBe("custom_action");
    expect(getKanbanHistoryActionLabel("")).toBe("Изменил карточку");
  });

  it("formats custom field values by type", () => {
    expect(formatCustomFieldValue({ id: "check", name: "Check", type: "checkbox" }, false)).toBe("Нет");
    expect(formatCustomFieldValue({ id: "tags", name: "Tags", type: "multi-select" }, ["A", "B"]))
      .toBe("A, B");
    expect(formatCustomFieldValue(
      { id: "person", name: "Person", type: "person" },
      "user-1",
      new Map([["user-1", { name: "Tim" }]]),
    )).toBe("Tim");
    expect(formatCustomFieldValue({ id: "empty", name: "Empty", type: "text" }, null)).toBe("");
  });

  it("formats attachment sizes using the existing thresholds", () => {
    expect(formatFileSize(0)).toBe("Неизвестный размер");
    expect(formatFileSize(512)).toBe("512 Б");
    expect(formatFileSize(1536)).toBe("1.5 КБ");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 МБ");
  });

  it("maps equipment workflow statuses to labels and badge variants", () => {
    expect(getEquipmentWorkflowStatusLabel("issued")).toBe("Выдано");
    expect(getEquipmentWorkflowStatusLabel("unknown")).toBe("unknown");
    expect(getEquipmentWorkflowStatusVariant("approved")).toBe("default");
    expect(getEquipmentWorkflowStatusVariant("overdue")).toBe("destructive");
    expect(getEquipmentWorkflowStatusVariant("returned")).toBe("secondary");
    expect(getEquipmentWorkflowStatusVariant("linked")).toBe("outline");
  });
});
