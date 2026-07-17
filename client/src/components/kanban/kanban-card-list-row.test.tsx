import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanCardListRow } from "./kanban-card-list-row";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";

const lists: KanbanListView[] = [
  { id: "active", boardId: "board-1", type: "active", position: 0, name: "Active" },
  { id: "closed", boardId: "board-1", type: "closed", position: 1, name: "Done" },
];

const card: KanbanCardView = {
  id: "card-1",
  boardId: "board-1",
  listId: "active",
  title: "Prepare stream",
  description: "Check equipment",
  position: 0,
  priority: "high",
  creatorUserId: "user-1",
  commentCount: 2,
  locationWarnings: [{
    id: "warning-1",
    locationId: "location-1",
    locationName: "Studio",
    title: "Power issue",
    severity: "high",
  }],
};

function renderRow(overrides: Partial<React.ComponentProps<typeof KanbanCardListRow>> = {}) {
  const callbacks = {
    onInlineTitleChange: vi.fn(),
    onBeginInlineEdit: vi.fn(),
    onCancelInlineEdit: vi.fn(),
    onCommitInlineEdit: vi.fn(),
    onMove: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
  };
  render(
    <KanbanCardListRow
      card={card}
      list={lists[0]}
      lists={lists}
      labels={[{ id: "label-1", name: "Live", color: "#ff0000" }]}
      customFields={[{ id: "field-1", name: "Storage", value: "NAS" }]}
      assigneeName="Tim"
      equipmentLinkCount={2}
      canEdit
      inlineEditing={false}
      inlineTitle="Prepare stream"
      savePending={false}
      movePending={false}
      deletePending={false}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

afterEach(cleanup);

describe("KanbanCardListRow", () => {
  it("renders the card summary and delegates list/detail/delete actions", () => {
    const callbacks = renderRow();

    expect(screen.getByText("Prepare stream")).toBeInTheDocument();
    expect(screen.getByText("Оборудование: 2 позиции")).toBeInTheDocument();
    expect(screen.getByText("Storage: NAS")).toBeInTheDocument();
    expect(screen.getByText("Проблемы площадки: 1")).toBeInTheDocument();
    expect(screen.getByText("Tim")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Список для Prepare stream" }), {
      target: { value: "closed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Изменить карточку" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить карточку" }));

    expect(callbacks.onMove).toHaveBeenCalledWith("closed");
    expect(callbacks.onOpen).toHaveBeenCalledOnce();
    expect(callbacks.onDelete).toHaveBeenCalledOnce();
  });

  it("keeps the inline title workflow keyboard-accessible", () => {
    const callbacks = renderRow({ inlineEditing: true, inlineTitle: "Draft title" });
    const input = screen.getByDisplayValue("Draft title");

    fireEvent.change(input, { target: { value: "Final title" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(callbacks.onInlineTitleChange).toHaveBeenCalledWith("Final title");
    expect(callbacks.onCommitInlineEdit).toHaveBeenCalledOnce();
    expect(callbacks.onCancelInlineEdit).toHaveBeenCalledOnce();
  });

  it("starts inline editing on title double click and hides editing actions for viewers", () => {
    const callbacks = renderRow({ canEdit: false });
    fireEvent.doubleClick(screen.getByRole("button", { name: "Prepare stream" }));

    expect(callbacks.onBeginInlineEdit).toHaveBeenCalledOnce();
    expect(screen.getByRole("combobox", { name: "Список для Prepare stream" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Удалить карточку" })).not.toBeInTheDocument();
  });
});
