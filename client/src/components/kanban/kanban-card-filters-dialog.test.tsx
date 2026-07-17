import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";
import {
  EMPTY_KANBAN_CARD_FILTERS,
  KanbanCardFiltersDialog,
} from "./kanban-card-filters-dialog";
import { KANBAN_EMPTY_FIELD_FILTER } from "@/lib/kanban-custom-field-filters";

const list = { id: "list-1", boardId: "board-1", type: "active" as const, position: 0, name: "Active" };

afterEach(cleanup);

describe("KanbanCardFiltersDialog", () => {
  it("delegates standard filter changes", () => {
    const onChange = vi.fn();
    render(
      <KanbanCardFiltersDialog
        open
        filters={EMPTY_KANBAN_CARD_FILTERS}
        lists={[list]}
        users={[{ id: "user-1", name: "Tim" }]}
        locations={["Studio"]}
        labels={[{ id: "label-1", boardId: "board-1", name: "Live" }]}
        labelGroups={[]}
        customFields={[]}
        hasActiveFilters={false}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    chooseStreamSelectOption("Статус / список", "Active");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ statuses: ["list:list-1"] }));
    chooseStreamSelectOption("Исполнитель", "Tim");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeUserIds: ["user-1"] }));
    chooseStreamSelectOption("Локация", "Studio");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ locations: ["Studio"] }));
  });

  it("supports typed and empty custom-field filters", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <KanbanCardFiltersDialog
        open
        filters={EMPTY_KANBAN_CARD_FILTERS}
        lists={[]}
        users={[]}
        locations={[]}
        labels={[]}
        labelGroups={[]}
        customFields={[{ id: "field-1", name: "Storage", type: "text" }]}
        hasActiveFilters={false}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Storage"), { target: { value: "NAS" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      customFieldValues: { "field-1": "NAS" },
    }));
    fireEvent.click(screen.getByRole("button", { name: "Пусто" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      customFieldValues: { "field-1": KANBAN_EMPTY_FIELD_FILTER },
    }));

    rerender(
      <KanbanCardFiltersDialog
        open
        filters={{
          ...EMPTY_KANBAN_CARD_FILTERS,
          customFieldValues: { "field-1": KANBAN_EMPTY_FIELD_FILTER },
        }}
        lists={[]}
        users={[]}
        locations={[]}
        labels={[]}
        labelGroups={[]}
        customFields={[{ id: "field-1", name: "Storage", type: "text" }]}
        hasActiveFilters
        onOpenChange={vi.fn()}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Сбросить" })).toBeInTheDocument();
  });

  it("delegates reset and apply actions", () => {
    const onOpenChange = vi.fn();
    const onReset = vi.fn();
    render(
      <KanbanCardFiltersDialog
        open
        filters={{ ...EMPTY_KANBAN_CARD_FILTERS, priorities: ["high"] }}
        lists={[]}
        users={[]}
        locations={[]}
        labels={[]}
        labelGroups={[]}
        customFields={[]}
        hasActiveFilters
        onOpenChange={onOpenChange}
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
    fireEvent.click(screen.getByRole("button", { name: "Применить" }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render removable chips below filter dropdowns", () => {
    render(
      <KanbanCardFiltersDialog
        open
        filters={{
          ...EMPTY_KANBAN_CARD_FILTERS,
          priorities: ["high", "medium"],
        }}
        lists={[]}
        users={[]}
        locations={[]}
        labels={[]}
        labelGroups={[]}
        customFields={[]}
        hasActiveFilters
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Приоритет" })).toHaveTextContent("Выбрано: 2");
    expect(screen.queryByRole("button", { name: "Убрать Высокий" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Убрать Средний" })).not.toBeInTheDocument();
  });
});
