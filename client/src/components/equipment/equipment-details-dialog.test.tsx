import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { EquipmentDetailsDialog } from "./equipment-details-dialog";

vi.mock("@/components/equipment/equipment-activity", () => ({
  EquipmentActivity: ({ equipmentId, onActivity }: { equipmentId: string; onActivity: () => void }) => (
    <button type="button" onClick={onActivity}>Activity {equipmentId}</button>
  ),
}));

vi.mock("@/components/equipment/equipment-kit-details-section", () => ({
  EquipmentKitDetailsSection: ({ onAdd, equipment }: {
    onAdd: (equipment: Equipment) => void;
    equipment: Equipment;
  }) => <button type="button" onClick={() => onAdd(equipment)}>Kit details</button>,
}));

function item(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "camera",
    name: "Cinema camera",
    model: "C100",
    type: "camera",
    status: "available",
    operabilityStatus: "working",
    ...overrides,
  } as Equipment;
}

const baseProps = {
  equipment: item(),
  allEquipment: [] as Equipment[],
  canEdit: true,
  canComment: true,
  assignedUserName: "",
  canReturnToBundle: false,
  note: "Initial note",
  noteAutosaveStatus: "saved" as const,
  noteAutosaveError: "",
  removePending: false,
  onClose: vi.fn(),
  onBackToBundle: vi.fn(),
  onAddToKit: vi.fn(),
  onOpenComponent: vi.fn(),
  onRemoveComponent: vi.fn(),
  onOpenParent: vi.fn(),
  onNoteChange: vi.fn(),
  onActivity: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EquipmentDetailsDialog", () => {
  it("delegates note, kit, activity and parent-navigation actions", () => {
    const onNoteChange = vi.fn();
    const onAddToKit = vi.fn();
    const onActivity = vi.fn();
    const onBackToBundle = vi.fn();
    const equipment = item();
    render(
      <EquipmentDetailsDialog
        {...baseProps}
        equipment={equipment}
        canReturnToBundle
        onNoteChange={onNoteChange}
        onAddToKit={onAddToKit}
        onActivity={onActivity}
        onBackToBundle={onBackToBundle}
      />,
    );

    fireEvent.change(screen.getByLabelText("Примечание по оборудованию"), {
      target: { value: "Updated note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kit details" }));
    fireEvent.click(screen.getByRole("button", { name: "Activity camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад к комплекту" }));

    expect(onNoteChange).toHaveBeenCalledWith("Updated note");
    expect(onAddToKit).toHaveBeenCalledWith(equipment);
    expect(onActivity).toHaveBeenCalledOnce();
    expect(onBackToBundle).toHaveBeenCalledOnce();
  });

  it("shows autosave state and immutable notes according to permissions", () => {
    const equipment = item({
      notes: "Read-only description",
      specifications: {
        noteAudit: { authorName: "Tim", at: "2026-07-16T18:38:00.000Z" },
      },
    });
    const { rerender } = render(
      <EquipmentDetailsDialog
        {...baseProps}
        equipment={equipment}
        noteAutosaveStatus="saving"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Сохранение...");

    rerender(
      <EquipmentDetailsDialog
        {...baseProps}
        equipment={equipment}
        canEdit={false}
      />,
    );
    expect(screen.getByText("Read-only description")).toBeInTheDocument();
    expect(screen.queryByLabelText("Примечание по оборудованию")).not.toBeInTheDocument();
  });

  it("renders kit history and the current assignee", () => {
    render(
      <EquipmentDetailsDialog
        {...baseProps}
        equipment={item({
          status: "in-use",
          assignedTo: "user-1",
          specifications: {
            bundleExtractionHistory: [{
              id: "history-1",
              componentName: "Lens",
              action: "added",
              actorName: "Manager",
              reason: "Production kit",
              managerOverride: true,
            }],
          },
        })}
        assignedUserName="Alex"
      />,
    );
    expect(screen.getByText("История состава")).toBeInTheDocument();
    expect(screen.getByText("Lens")).toBeInTheDocument();
    expect(screen.getByText("Override менеджера")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });
});
