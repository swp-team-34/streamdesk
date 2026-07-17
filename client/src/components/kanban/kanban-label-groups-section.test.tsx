import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanLabelGroupsSection } from "./kanban-label-groups-section";

const group = { id: "group-1", name: "Production", color: "#ff0000" };
const label = { id: "label-1", boardId: "board-1", name: "Live", groupId: "group-1" };

afterEach(cleanup);

describe("KanbanLabelGroupsSection", () => {
  it("renders group counts and delegates edit/archive", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <KanbanLabelGroupsSection
        groups={[group]}
        labels={[label]}
        form={{ name: "", color: "" }}
        canEdit
        loading={false}
        savePending={false}
        deletePending={false}
        onFormChange={vi.fn()}
        onCancelEdit={vi.fn()}
        onSave={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText("1 метка")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    fireEvent.click(screen.getByRole("button", { name: "Архивировать" }));
    expect(onEdit).toHaveBeenCalledWith(group);
    expect(onDelete).toHaveBeenCalledWith(group);
  });

  it("delegates form edits, save and cancel", () => {
    const onFormChange = vi.fn();
    const onSave = vi.fn();
    const onCancelEdit = vi.fn();
    render(
      <KanbanLabelGroupsSection
        groups={[]}
        labels={[]}
        form={{ name: "Production", color: "#ff0000" }}
        editingGroupId="group-1"
        canEdit
        loading={false}
        savePending={false}
        deletePending={false}
        onFormChange={onFormChange}
        onCancelEdit={onCancelEdit}
        onSave={onSave}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Название группы меток"), { target: { value: "Updated" } });
    expect(onFormChange).toHaveBeenCalledWith({ name: "Updated", color: "#ff0000" });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });
});
