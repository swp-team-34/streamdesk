import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanCustomFieldDefinition } from "@/lib/kanban-board-model";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";
import { KanbanCardCustomFieldsEditor } from "./kanban-card-custom-fields-editor";

const field = {
  id: "field-1",
  name: "Scene",
  type: "text",
  required: true,
} as KanbanCustomFieldDefinition;

const form = {
  name: "",
  type: "text" as const,
  options: "",
  required: false,
  showOnCard: true,
  showInList: true,
};

const baseProps = {
  expanded: true,
  fields: [field],
  values: { [field.id]: "Main" },
  users: [],
  canEdit: true,
  loading: false,
  form,
  savePending: false,
  onValuesChange: vi.fn(),
  onFormChange: vi.fn(),
  onSave: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("KanbanCardCustomFieldsEditor", () => {
  it("delegates field value updates without dropping other values", () => {
    const onValuesChange = vi.fn();
    render(
      <KanbanCardCustomFieldsEditor {...baseProps} onValuesChange={onValuesChange} />,
    );
    fireEvent.change(screen.getByLabelText("Scene *"), { target: { value: "Wide" } });
    expect(onValuesChange).toHaveBeenCalledWith({ [field.id]: "Wide" });
  });

  it("requires a name before creating a field", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <KanbanCardCustomFieldsEditor {...baseProps} fields={[]} onSave={onSave} />,
    );
    expect(screen.getByRole("button", { name: "Добавить" })).toBeDisabled();
    rerender(
      <KanbanCardCustomFieldsEditor
        {...baseProps}
        fields={[]}
        form={{ ...form, name: "Location" }}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("hides the editor when advanced details are collapsed", () => {
    const { container } = render(
      <KanbanCardCustomFieldsEditor {...baseProps} expanded={false} />,
    );
    expect(container.firstElementChild).toHaveClass("hidden");
  });

  it("shows options only for list fields and updates field visibility rules", () => {
    const onFormChange = vi.fn();
    const { rerender } = render(
      <KanbanCardCustomFieldsEditor {...baseProps} form={form} onFormChange={onFormChange} />,
    );

    expect(screen.queryByLabelText("Опции нового поля карточки")).not.toBeInTheDocument();
    chooseStreamSelectOption("Тип нового поля карточки", "Multi-select");
    expect(onFormChange).toHaveBeenCalledWith({ ...form, type: "multi-select" });

    const listForm = { ...form, type: "multi-select" as const };
    rerender(
      <KanbanCardCustomFieldsEditor {...baseProps} form={listForm} onFormChange={onFormChange} />,
    );
    fireEvent.change(screen.getByLabelText("Опции нового поля карточки"), {
      target: { value: "Alpha, Beta" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Обязательное" }));

    expect(onFormChange).toHaveBeenCalledWith({ ...listForm, options: "Alpha, Beta" });
    expect(onFormChange).toHaveBeenLastCalledWith({ ...listForm, required: true });
  });
});
