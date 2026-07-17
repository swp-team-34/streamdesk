import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanCardActivitySection } from "./kanban-card-activity-section";
import type { KanbanCardHistoryView } from "@/lib/kanban-board-model";

const entries: KanbanCardHistoryView[] = Array.from({ length: 4 }, (_, index) => ({
  id: `history-${index + 1}`,
  cardId: "card-1",
  userId: "user-1",
  action: index === 0 ? "created" : "updated",
  newValue: { title: `Version ${index + 1}` },
}));

afterEach(cleanup);

describe("KanbanCardActivitySection", () => {
  it("shows three entries when collapsed and delegates expansion", () => {
    const onToggleExpanded = vi.fn();
    render(
      <KanbanCardActivitySection
        entries={entries}
        loading={false}
        expanded={false}
        getUserName={() => "Tim"}
        getChangeLines={(entry) => [`Changed ${entry.id}`]}
        onToggleExpanded={onToggleExpanded}
      />,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getAllByText("Tim")).toHaveLength(3);
    expect(screen.getByText("Changed history-1")).toBeInTheDocument();
    expect(screen.queryByText("Changed history-4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Показать все \(1\)/ }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
  });

  it("shows all entries when expanded", () => {
    render(
      <KanbanCardActivitySection
        entries={entries}
        loading={false}
        expanded
        getUserName={(id) => id}
        getChangeLines={() => []}
        onToggleExpanded={vi.fn()}
      />,
    );

    expect(screen.getAllByText("user-1")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Свернуть/ })).toBeInTheDocument();
  });

  it("renders loading and empty history states", () => {
    render(
      <KanbanCardActivitySection
        entries={[]}
        loading
        expanded={false}
        getUserName={(id) => id}
        getChangeLines={() => []}
        onToggleExpanded={vi.fn()}
      />,
    );

    expect(screen.getByText("Обновляем историю...")).toBeInTheDocument();
    expect(screen.getByText("Для этой карточки пока нет записанной истории.")).toBeInTheDocument();
  });
});
