import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanLabelsSection } from "./kanban-labels-section";

const label = { id: "label-1", boardId: "board-1", name: "Live", color: "#0ea5e9" };
const group = { id: "group-1", name: "Production" };

afterEach(cleanup);

describe("KanbanLabelsSection", () => {
  it("delegates label creation from button and Enter", () => {
    const onCreate = vi.fn();
    render(
      <KanbanLabelsSection
        labels={[]}
        groups={[]}
        loading={false}
        canEdit
        draft="New label"
        editingLabelName=""
        savePending={false}
        deletePending={false}
        onDraftChange={vi.fn()}
        onCreate={onCreate}
        onEditingLabelNameChange={vi.fn()}
        onBeginEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onCommitEdit={vi.fn()}
        onGroupChange={vi.fn()}
        onColorChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Название новой метки"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Добавить метку" }));
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it("delegates group, color, rename and delete actions", () => {
    const onBeginEdit = vi.fn();
    const onGroupChange = vi.fn();
    const onColorChange = vi.fn();
    const onDelete = vi.fn();
    render(
      <KanbanLabelsSection
        labels={[label]}
        groups={[group]}
        loading={false}
        canEdit
        draft=""
        editingLabelName=""
        savePending={false}
        deletePending={false}
        onDraftChange={vi.fn()}
        onCreate={vi.fn()}
        onEditingLabelNameChange={vi.fn()}
        onBeginEdit={onBeginEdit}
        onCancelEdit={vi.fn()}
        onCommitEdit={vi.fn()}
        onGroupChange={onGroupChange}
        onColorChange={onColorChange}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Переименовать Live" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Группа метки Live" }), {
      target: { value: "group-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Цвет метки Rose" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onBeginEdit).toHaveBeenCalledWith(label);
    expect(onGroupChange).toHaveBeenCalledWith(label, "group-1");
    expect(onColorChange).toHaveBeenCalledWith(label, "#f43f5e");
    expect(onDelete).toHaveBeenCalledWith(label);
  });

  it("keeps inline rename keyboard behavior", () => {
    const onCommitEdit = vi.fn();
    const onCancelEdit = vi.fn();
    render(
      <KanbanLabelsSection
        labels={[label]}
        groups={[]}
        loading={false}
        canEdit
        draft=""
        editingLabelId="label-1"
        editingLabelName="Updated"
        savePending={false}
        deletePending={false}
        onDraftChange={vi.fn()}
        onCreate={vi.fn()}
        onEditingLabelNameChange={vi.fn()}
        onBeginEdit={vi.fn()}
        onCancelEdit={onCancelEdit}
        onCommitEdit={onCommitEdit}
        onGroupChange={vi.fn()}
        onColorChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Название метки Live");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommitEdit).toHaveBeenCalledWith(label);
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });
});
