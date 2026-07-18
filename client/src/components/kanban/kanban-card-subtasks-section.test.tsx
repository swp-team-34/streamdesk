import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanCardSubtasksSection } from "./kanban-card-subtasks-section";

afterEach(cleanup);

describe("KanbanCardSubtasksSection", () => {
  it("normalizes subtasks and delegates completion changes", () => {
    const onSave = vi.fn();
    render(
      <KanbanCardSubtasksSection
        subtasks={[
          { id: "first", title: "First", completed: true },
          { id: " second ", title: " Second ", completed: false },
        ]}
        draft=""
        canEdit
        pending={false}
        onDraftChange={vi.fn()}
        onSave={onSave}
        confirmDelete={async () => true}
      />,
    );

    expect(screen.getByText("Подзадачи (1/2)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Выполнено: Second" }));
    expect(onSave).toHaveBeenCalledWith([
      { id: "first", title: "First", completed: true },
      { id: "second", title: "Second", completed: true },
    ]);
  });

  it("adds a trimmed subtask and requests draft reset after success", () => {
    const onSave = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(123);
    render(
      <KanbanCardSubtasksSection
        subtasks={[]}
        draft=" New subtask "
        canEdit
        pending={false}
        onDraftChange={vi.fn()}
        onSave={onSave}
        confirmDelete={async () => true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onSave).toHaveBeenCalledWith([
      { id: "kst-123", title: "New subtask", completed: false },
    ], true);
    vi.restoreAllMocks();
  });

  it("requires delete confirmation and hides editing controls from viewers", async () => {
    const onSave = vi.fn();
    const confirmDelete = vi.fn(async () => false);
    const { rerender } = render(
      <KanbanCardSubtasksSection
        subtasks={[{ id: "first", title: "First" }]}
        draft=""
        canEdit
        pending={false}
        onDraftChange={vi.fn()}
        onSave={onSave}
        confirmDelete={confirmDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(confirmDelete).toHaveBeenCalledOnce());
    expect(onSave).not.toHaveBeenCalled();

    rerender(
      <KanbanCardSubtasksSection
        subtasks={[{ id: "first", title: "First" }]}
        draft=""
        canEdit={false}
        pending={false}
        onDraftChange={vi.fn()}
        onSave={onSave}
        confirmDelete={confirmDelete}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Выполнено: First" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Добавить подзадачу")).not.toBeInTheDocument();
  });
});
