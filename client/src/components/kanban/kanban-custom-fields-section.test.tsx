import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";
import { KanbanCustomFieldsSection } from "./kanban-custom-fields-section";

const form = {
  name: "Storage",
  type: "text" as const,
  options: "",
  required: false,
  showOnCard: true,
  showInList: true,
};
const field = { id: "field-1", name: "Storage", type: "text" as const };

afterEach(cleanup);

describe("KanbanCustomFieldsSection", () => {
  it("delegates form changes and enables options only for select fields", () => {
    const onFormChange = vi.fn();
    const { rerender } = render(
      <KanbanCustomFieldsSection
        fields={[]}
        form={form}
        canEdit
        loading={false}
        savePending={false}
        deletePending={false}
        onFormChange={onFormChange}
        onCancelEdit={vi.fn()}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Опции поля")).not.toBeInTheDocument();
    chooseStreamSelectOption("Тип поля", "Select");
    expect(onFormChange).toHaveBeenCalledWith({ ...form, type: "select" });

    rerender(
      <KanbanCustomFieldsSection
        fields={[]}
        form={{ ...form, type: "select" }}
        canEdit
        loading={false}
        savePending={false}
        deletePending={false}
        onFormChange={onFormChange}
        onCancelEdit={vi.fn()}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Опции поля")).toBeEnabled();
  });

  it("delegates save, edit and archive actions", () => {
    const onSave = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <KanbanCustomFieldsSection
        fields={[field]}
        form={form}
        canEdit
        loading={false}
        savePending={false}
        deletePending={false}
        onFormChange={vi.fn()}
        onCancelEdit={vi.fn()}
        onSave={onSave}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Добавить поле" }));
    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    fireEvent.click(screen.getByRole("button", { name: "Архивировать" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(field);
    expect(onDelete).toHaveBeenCalledWith(field);
  });

  it("uses accessible custom checkboxes for visibility settings", () => {
    const onFormChange = vi.fn();
    render(
      <KanbanCustomFieldsSection
        fields={[]}
        form={form}
        canEdit
        loading={false}
        savePending={false}
        deletePending={false}
        onFormChange={onFormChange}
        onCancelEdit={vi.fn()}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Обязательное" }));
    expect(onFormChange).toHaveBeenCalledWith({ ...form, required: true });
  });
});
