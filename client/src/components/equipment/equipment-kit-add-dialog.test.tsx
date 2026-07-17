import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { EquipmentKitAddDialog } from "./equipment-kit-add-dialog";

function equipment(id: string, overrides: Partial<Equipment> = {}): Equipment {
  return {
    id,
    name: id,
    type: "other",
    status: "available",
    ...overrides,
  } as Equipment;
}

const bundle = equipment("kit", { name: "Camera kit" });
const candidate = equipment("camera", { name: "Cinema camera" });

const baseProps = {
  bundle,
  candidates: [candidate],
  selectedIds: new Set<string>(),
  search: "",
  reason: "",
  approvalPhrase: "",
  operationalContext: { active: false },
  canOverrideActiveKit: false,
  pending: false,
  onClose: vi.fn(),
  onSearchChange: vi.fn(),
  onSelectedIdsChange: vi.fn(),
  onReasonChange: vi.fn(),
  onApprovalPhraseChange: vi.fn(),
  onSubmit: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EquipmentKitAddDialog", () => {
  it("returns the next controlled selection and search value", () => {
    const onSelectedIdsChange = vi.fn();
    const onSearchChange = vi.fn();
    render(
      <EquipmentKitAddDialog
        {...baseProps}
        onSelectedIdsChange={onSelectedIdsChange}
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Выбрать «Cinema camera»" }));
    expect([...onSelectedIdsChange.mock.calls[0][0]]).toEqual([candidate.id]);

    fireEvent.change(screen.getByLabelText("Поиск оборудования для комплекта"), {
      target: { value: "camera" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("camera");
  });

  it("requires manager confirmation before changing an active kit", () => {
    const onSubmit = vi.fn();
    const selectedIds = new Set([candidate.id]);
    const { rerender } = render(
      <EquipmentKitAddDialog
        {...baseProps}
        selectedIds={selectedIds}
        operationalContext={{ active: true, projectName: "Broadcast" }}
        canOverrideActiveKit
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("button", { name: "Добавить (1)" })).toBeDisabled();

    rerender(
      <EquipmentKitAddDialog
        {...baseProps}
        selectedIds={selectedIds}
        reason="  Replacement  "
        approvalPhrase="добавить"
        operationalContext={{ active: true, projectName: "Broadcast" }}
        canOverrideActiveKit
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Добавить (1)" }));
    expect(onSubmit).toHaveBeenCalledWith({
      bundleId: bundle.id,
      equipmentIds: [candidate.id],
      reason: "Replacement",
      activeKitApproval: true,
    });
  });

  it("blocks active-kit changes for employees without override permission", () => {
    render(
      <EquipmentKitAddDialog
        {...baseProps}
        selectedIds={new Set([candidate.id])}
        operationalContext={{ active: true, projectId: "project-1" }}
      />,
    );
    expect(screen.getByText(/может только менеджер или администратор/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить (1)" })).toBeDisabled();
  });
});
