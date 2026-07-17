import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoardStatsDialog } from "./kanban-board-stats-dialog";

const emptyStats = {
  overview: { total: 0, completed: 0, percent: 0 },
  sections: [],
};

afterEach(cleanup);

describe("KanbanBoardStatsDialog", () => {
  it("renders loading and no-board states", () => {
    const { rerender } = render(
      <KanbanBoardStatsDialog
        open
        loading
        stats={emptyStats}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Загрузка статистики")).toBeInTheDocument();

    rerender(
      <KanbanBoardStatsDialog
        open
        loading={false}
        stats={emptyStats}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Доска не выбрана.")).toBeInTheDocument();
  });

  it("renders completion overview and grouped statistics", () => {
    render(
      <KanbanBoardStatsDialog
        open
        boardName="Sprint"
        loading={false}
        stats={{
          overview: { total: 4, completed: 3, percent: 75 },
          sections: [{
            id: "assignees",
            title: "По исполнителям",
            description: "Completion по участникам",
            emptyLabel: "Нет исполнителей",
            groups: [{
              id: "user-1",
              title: "Tim",
              summary: { total: 2, completed: 1, percent: 50 },
            }],
          }],
        }}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3/4 завершено")).toBeInTheDocument();
    expect(screen.getByText("По исполнителям")).toBeInTheDocument();
    expect(screen.getByText("Tim")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("closes through the dialog action", () => {
    const onOpenChange = vi.fn();
    render(
      <KanbanBoardStatsDialog
        open
        boardName="Sprint"
        loading={false}
        stats={emptyStats}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
