import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";
import { KanbanCustomFieldEditor } from "./kanban-custom-field-editor";
import type { KanbanCustomFieldDefinition } from "@/lib/kanban-board-model";

const createField = (
  type: KanbanCustomFieldDefinition["type"],
  options?: string[],
): KanbanCustomFieldDefinition => ({
  id: "field-1",
  name: "Field name",
  type,
  options,
});

afterEach(cleanup);

describe("KanbanCustomFieldEditor", () => {
  it("renders a typed input and sends its next value", () => {
    const onChange = vi.fn();
    render(
      <KanbanCustomFieldEditor
        field={createField("email")}
        value="old@example.test"
        users={[]}
        placeholder="Email"
        onChange={onChange}
      />,
    );

    const input = screen.getByDisplayValue("old@example.test");
    expect(input).toHaveAttribute("type", "email");
    fireEvent.change(input, { target: { value: "new@example.test" } });
    expect(onChange).toHaveBeenCalledWith("new@example.test");
  });

  it("handles checkbox values and respects the disabled state", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <KanbanCustomFieldEditor
        field={createField("checkbox")}
        value={false}
        users={[]}
        placeholder="Checkbox"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(
      <KanbanCustomFieldEditor
        field={createField("checkbox")}
        value
        users={[]}
        placeholder="Checkbox"
        onChange={onChange}
        disabled
      />,
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("toggles multi-select options without changing the incoming array", () => {
    const onChange = vi.fn();
    const value = ["Alpha"];
    render(
      <KanbanCustomFieldEditor
        field={createField("multi-select", ["Alpha", "Beta"])}
        value={value}
        users={[]}
        placeholder="Multi-select"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith(["Alpha", "Beta"]);
    expect(value).toEqual(["Alpha"]);

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("renders person options and reports the selected user", () => {
    const onChange = vi.fn();
    render(
      <KanbanCustomFieldEditor
        field={createField("person")}
        value=""
        users={[{ id: "user-1", name: "Tim" }]}
        placeholder="Person"
        onChange={onChange}
      />,
    );

    chooseStreamSelectOption("Field name", "Tim");
    expect(onChange).toHaveBeenCalledWith("user-1");
  });
});
