import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";
import { KanbanListViewGroup } from "./kanban-list-view-group";

const lists: KanbanListView[] = [
  { id: "active", boardId: "board-1", type: "active", position: 0, name: "Active" },
  { id: "done", boardId: "board-1", type: "closed", position: 1, name: "Done" },
];

const card: KanbanCardView = {
  id: "card-1",
  boardId: "board-1",
  listId: "active",
  title: "Prepare stream",
  position: 0,
  priority: "medium",
  creatorUserId: "user-1",
};

afterEach(cleanup);

describe("KanbanListViewGroup", () => {
  it("delegates compact card creation without owning page state", () => {
    const onDraftChange = vi.fn();
    const onDraftListChange = vi.fn();
    const onResetDraft = vi.fn();
    const onSubmitDraft = vi.fn();
    render(
      <KanbanListViewGroup
        group={{ id: "all", title: "All", cards: [card] }}
        lists={lists}
        droppableId={null}
        draftValue="New task"
        draftListId="active"
        canEdit
        savePending={false}
        cardEditPending={false}
        onDraftChange={onDraftChange}
        onDraftListChange={onDraftListChange}
        onResetDraft={onResetDraft}
        onSubmitDraft={onSubmitDraft}
        renderCard={(item) => <div>{item.title}</div>}
      />,
    );

    const input = screen.getByPlaceholderText("Новая задача");
    fireEvent.change(input, { target: { value: "Updated" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(screen.getByText("Prepare stream")).toBeInTheDocument();
    expect(onDraftChange).toHaveBeenCalledWith("Updated");
    expect(onResetDraft).toHaveBeenCalledOnce();
    expect(onSubmitDraft).toHaveBeenCalledTimes(2);
    expect(onDraftListChange).toHaveBeenCalledWith("done");
  });

  it("renders a read-only empty group without creation controls", () => {
    render(
      <KanbanListViewGroup
        group={{ id: "empty", title: "Empty", cards: [] }}
        lists={lists}
        droppableId={null}
        draftValue=""
        draftListId="active"
        canEdit={false}
        savePending={false}
        cardEditPending={false}
        onDraftChange={vi.fn()}
        onDraftListChange={vi.fn()}
        onResetDraft={vi.fn()}
        onSubmitDraft={vi.fn()}
        renderCard={() => null}
      />,
    );

    expect(screen.getByText("В этой группе пока нет задач.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Новая задача")).not.toBeInTheDocument();
  });
});
