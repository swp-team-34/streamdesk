import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KanbanBoardFormDialog,
  type KanbanBoardFormState,
} from "./kanban-board-form-dialog";

const personalForm: KanbanBoardFormState = {
  companyId: "",
  name: "Personal",
  description: "Description",
  visibility: "personal",
};

afterEach(cleanup);

describe("KanbanBoardFormDialog", () => {
  it("keeps company visibility unavailable in a personal workspace", () => {
    render(
      <KanbanBoardFormDialog
        open
        form={personalForm}
        companies={[{ id: "company-1", name: "Team" }]}
        companiesLoading={false}
        workspaceType="personal"
        pending={false}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Личная/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Командная/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /По приглашению/ })).toBeDisabled();
  });

  it("selects a company visibility and initializes its company", () => {
    const onChange = vi.fn();
    render(
      <KanbanBoardFormDialog
        open
        form={{ ...personalForm, name: "" }}
        companies={[{ id: "company-1", name: "Team" }]}
        companiesLoading={false}
        workspaceType="company"
        pending={false}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Командная/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      visibility: "company",
      companyId: "company-1",
    }));
    expect(screen.getByRole("button", { name: "Создать доску" })).toBeDisabled();
  });

  it("delegates editing, save and cancel actions", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <KanbanBoardFormDialog
        open
        editingBoardId="board-1"
        form={{ ...personalForm, visibility: "company", companyId: "company-1" }}
        companies={[{ id: "company-1", name: "Team" }]}
        companiesLoading={false}
        workspaceType="company"
        pending={false}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Название доски"), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить доску" }));
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
