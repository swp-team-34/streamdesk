import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoardNavigation } from "./kanban-board-navigation";

function createProps() {
  return {
    boards: [
      { id: "personal", name: "Personal", description: "Private board", canManage: true },
      { id: "team", name: "Production", companyId: "company-1", canManage: true },
    ],
    boardsLoading: false,
    selectedBoardId: "personal",
    selectedBoard: { id: "personal", name: "Personal", description: "Private board", canManage: true },
    canEditSelectedBoard: true,
    listCount: 2,
    overdueCardsCount: 1,
    createMenuOpen: false,
    boardMutationPending: false,
    onSelectBoard: vi.fn(),
    onCreateMenuOpenChange: vi.fn(),
    onOpenSettings: vi.fn(),
    onCreateBoard: vi.fn(),
    onCreateList: vi.fn(),
    onCreateCard: vi.fn(),
    onOpenStats: vi.fn(),
    onOpenSmartInputHelp: vi.fn(),
    onEditBoard: vi.fn(),
    onDeleteBoard: vi.fn(),
  };
}

afterEach(cleanup);

describe("KanbanBoardNavigation", () => {
  it("renders the selected board and delegates settings and create actions", () => {
    const props = createProps();
    const { rerender } = render(<KanbanBoardNavigation {...props} />);

    expect(screen.getByText("Private board")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Настройки доски" }));
    rerender(<KanbanBoardNavigation {...props} createMenuOpen />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Создать доску" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Создать столбец" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Создать карточку" }));

    expect(props.onOpenSettings).toHaveBeenCalledOnce();
    expect(props.onCreateBoard).toHaveBeenCalledOnce();
    expect(props.onCreateList).toHaveBeenCalledOnce();
    expect(props.onCreateCard).toHaveBeenCalledOnce();
  });

  it("keeps list and card creation unavailable without board edit access", () => {
    render(
      <KanbanBoardNavigation
        {...createProps()}
        createMenuOpen
        canEditSelectedBoard={false}
        listCount={0}
      />,
    );

    expect(screen.getByRole("menuitem", { name: "Создать столбец" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: "Создать карточку" })).toHaveAttribute("data-disabled");
  });
});
