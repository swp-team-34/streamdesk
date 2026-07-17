import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";
import { KanbanCardDetailDialog } from "./kanban-card-detail-dialog";

const card = {
  id: "card-1",
  listId: "list-1",
  title: "Prepare camera",
  priority: "medium",
} as KanbanCardView;
const list = { id: "list-1", name: "Todo", type: "active" } as KanbanListView;

afterEach(cleanup);

describe("KanbanCardDetailDialog", () => {
  it("shows the loading state before the card resolves", () => {
    render(
      <KanbanCardDetailDialog
        open
        card={null}
        list={null}
        formTitle=""
        saveStatus="idle"
        saveError=""
        onClose={vi.fn()}
      >
        Content
      </KanbanCardDetailDialog>,
    );
    expect(screen.getByText("Подождите, данные карточки загружаются.")).toBeInTheDocument();
  });

  it("renders content, autosave status and delegates closing", () => {
    const onClose = vi.fn();
    render(
      <KanbanCardDetailDialog
        open
        card={card}
        list={list}
        formTitle={card.title}
        saveStatus="dirty"
        saveError=""
        onClose={onClose}
      >
        <div>Detail content</div>
      </KanbanCardDetailDialog>,
    );
    expect(screen.getByText("Detail content")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Есть несохраненные изменения");
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
