import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";
import { KanbanBoardCard } from "./kanban-board-card";

const lists: KanbanListView[] = [
  { id: "active", boardId: "board-1", type: "active", position: 0, name: "Active", color: "#2563eb" },
  { id: "archive", boardId: "board-1", type: "archive", position: 1, name: "Archive" },
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
  assigneeUserIds: ["user-1"],
  responsibleUserId: "user-2",
  dueDate: "2020-01-01T10:00:00.000Z",
  subtasks: [{ id: "subtask-1", title: "Audio", completed: true }],
  labelIds: ["label-1"],
  customFieldValues: { "field-1": "Studio" },
  commentCount: 2,
  locations: [{ id: "location-1", name: "Main Hall" }],
  locationWarnings: [{
    id: "warning-1",
    locationId: "location-1",
    locationName: "Main Hall",
    title: "Power",
    severity: "high",
  }],
};

function createProps() {
  return {
    card,
    list: lists[0],
    lists,
    customFields: [{ id: "field-1", name: "Location", type: "text" as const, showOnCard: true }],
    userById: new Map([
      ["user-1", { name: "Tim" }],
      ["user-2", { name: "Alex" }],
    ]),
    labelById: new Map([["label-1", { id: "label-1", boardId: "board-1", name: "Live", color: "#ef4444" }]]),
    equipmentLinkCount: 2,
    canEdit: true,
    inlineEditing: false,
    inlineTitle: "Prepare stream",
    cardPending: false,
    movePending: false,
    detailLoading: false,
    isDragging: false,
    isDropAnimating: false,
    listTint: "#eff6ff",
    listCardTint: "#f8fafc",
    onInlineTitleChange: vi.fn(),
    onBeginInlineTitleEdit: vi.fn(),
    onCancelInlineTitleEdit: vi.fn(),
    onCommitInlineTitleEdit: vi.fn(),
    onOpenDetail: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
  };
}

afterEach(cleanup);

describe("KanbanBoardCard", () => {
  it("renders the existing card summary and delegates quick editing", () => {
    const props = createProps();
    render(<KanbanBoardCard {...props} />);

    expect(screen.getByText("Prepare stream")).toBeInTheDocument();
    expect(screen.getByText("Высокий")).toBeInTheDocument();
    expect(screen.getByText("Просрочено")).toBeInTheDocument();
    expect(screen.getByText("Исполнители: Tim")).toBeInTheDocument();
    expect(screen.getByText("Ответственный: Alex")).toBeInTheDocument();
    expect(screen.getByText("Подзадачи: 1/1")).toBeInTheDocument();
    expect(screen.getByText("Оборудование: 2")).toBeInTheDocument();
    expect(screen.getByText("Площадка: Main Hall")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Location: Studio")).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("Prepare stream"));
    fireEvent.click(screen.getByRole("button", { name: "Быстрое редактирование" }));

    expect(props.onBeginInlineTitleEdit).toHaveBeenCalledOnce();
    expect(props.onOpenDetail).toHaveBeenCalledWith();
  });

  it("keeps inline title editing keyboard-accessible", () => {
    const props = createProps();
    render(<KanbanBoardCard {...props} inlineEditing inlineTitle="Draft" />);
    const input = screen.getByDisplayValue("Draft");

    fireEvent.change(input, { target: { value: "Updated" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(props.onInlineTitleChange).toHaveBeenCalledWith("Updated");
    expect(props.onCommitInlineTitleEdit).toHaveBeenCalledOnce();
    expect(props.onCancelInlineTitleEdit).toHaveBeenCalledOnce();
  });

  it("keeps inline editing affordances hidden from viewers", () => {
    const props = createProps();
    const { container } = render(<KanbanBoardCard {...props} canEdit={false} />);

    expect(screen.getByText("Prepare stream")).not.toHaveAttribute("title");
    expect(container.querySelector(".task-drag-handle")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Быстрое редактирование" })).toBeEnabled();
  });
});
