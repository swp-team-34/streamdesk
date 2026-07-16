import { describe, expect, it } from "vitest";
import { parseKanbanSmartInput } from "./kanban-smart-input";

const NOW = new Date(2026, 6, 17, 10, 0);

describe("Kanban smart input parser", () => {
  it("extracts localized dates and priorities while keeping a clean title", () => {
    const result = parseKanbanSmartInput(
      "Подготовить эфир завтра 14.30 высокий приоритет",
      { now: NOW },
    );

    expect(result.title).toBe("Подготовить эфир");
    expect(result.dueDate).toBe("2026-07-18T14:30");
    expect(result.dueDateHasTime).toBe(true);
    expect(result.priority).toBe("high");
  });

  it("uses the following week for the current weekday", () => {
    const result = parseKanbanSmartInput("Отчёт friday", { now: NOW });
    expect(result.dueDate).toBe("2026-07-24");
    expect(result.dueDateHasTime).toBe(false);
  });

  it("parses a date-time range and validates paired time", () => {
    const valid = parseKanbanSmartInput(
      "Монтаж с сегодня 14:00 до завтра 16:00",
      { now: NOW },
    );
    expect(valid.startDate).toBe("2026-07-17T14:00");
    expect(valid.dueDate).toBe("2026-07-18T16:00");
    expect(valid.errors).toEqual([]);

    const invalid = parseKanbanSmartInput(
      "Монтаж с сегодня 14:00 до завтра",
      { now: NOW },
    );
    expect(invalid.errors).toContain("Если у начала указано время, у окончания оно тоже обязательно.");
  });

  it("resolves company-scoped mentions to stable user ids", () => {
    const result = parseKanbanSmartInput("Проверить звук @tim", {
      now: NOW,
      users: [{ id: "user-1", name: "Tim", username: "tim" }],
    });
    expect(result.title).toBe("Проверить звук");
    expect(result.assigneeUserIds).toEqual(["user-1"]);
  });

  it("supports explicit start-only and deadline-only phrases", () => {
    const startOnly = parseKanbanSmartInput("Монтаж начало завтра 10:00", { now: NOW });
    expect(startOnly.title).toBe("Монтаж");
    expect(startOnly.startDate).toBe("2026-07-18T10:00");
    expect(startOnly.dueDate).toBeNull();

    const dueOnly = parseKanbanSmartInput("Сдать отчёт срок 21.07", { now: NOW });
    expect(dueOnly.title).toBe("Сдать отчёт");
    expect(dueOnly.startDate).toBeNull();
    expect(dueOnly.dueDate).toBe("2026-07-21");
  });

  it("keeps a cancelled control phrase in the stored title", () => {
    const first = parseKanbanSmartInput("Проверить завтра", { now: NOW });
    const result = parseKanbanSmartInput("Проверить завтра", {
      now: NOW,
      cancelledTokenIds: [first.tokens[0].id],
    });
    expect(result.title).toBe("Проверить завтра");
    expect(result.dueDate).toBeNull();
  });
});
