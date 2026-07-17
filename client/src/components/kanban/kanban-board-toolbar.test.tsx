import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoardToolbar } from "./kanban-board-toolbar";

function createProps() {
  return {
    selectedBoard: { name: "Production", description: "Live events" },
    search: "camera",
    sortBy: "position" as const,
    sortDirection: "asc" as const,
    hasActiveFilters: true,
    viewMode: "list" as const,
    listGrouping: "list" as const,
    customFields: [{ id: "location", name: "Location" }],
    onSearchChange: vi.fn(),
    onSortByChange: vi.fn(),
    onSortDirectionChange: vi.fn(),
    onOpenFilters: vi.fn(),
    onViewModeChange: vi.fn(),
    onListGroupingChange: vi.fn(),
  };
}

afterEach(cleanup);

describe("KanbanBoardToolbar", () => {
  it("delegates search, filters, view and grouping changes", () => {
    const props = createProps();
    render(<KanbanBoardToolbar {...props} />);

    expect(screen.getByText("Доска: Production")).toBeInTheDocument();
    expect(screen.getByText("Live events")).toBeInTheDocument();
    expect(screen.getByText("Активны")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Поиск карточек"), { target: { value: "audio" } });
    fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
    fireEvent.click(screen.getByRole("button", { name: "Фильтры Активны" }));
    fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Группировка списка" }), {
      target: { value: "field:location" },
    });

    expect(props.onSearchChange).toHaveBeenNthCalledWith(1, "audio");
    expect(props.onSearchChange).toHaveBeenNthCalledWith(2, "");
    expect(props.onOpenFilters).toHaveBeenCalledOnce();
    expect(props.onViewModeChange).toHaveBeenCalledWith("kanban");
    expect(props.onListGroupingChange).toHaveBeenCalledWith("field:location");
  });

  it("hides controls until a board is selected", () => {
    render(<KanbanBoardToolbar {...createProps()} selectedBoard={null} />);

    expect(screen.getByText("Выберите доску")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Поиск карточек")).not.toBeInTheDocument();
  });
});
