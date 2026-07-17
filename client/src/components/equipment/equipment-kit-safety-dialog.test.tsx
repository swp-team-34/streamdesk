import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import {
  EquipmentKitSafetyDialog,
  type EquipmentKitSafetyEntry,
} from "./equipment-kit-safety-dialog";

function equipment(id: string, name: string): Equipment {
  return { id, name, type: "other", status: "available" } as Equipment;
}

const inactiveEntry: EquipmentKitSafetyEntry = {
  item: equipment("camera", "Cinema camera"),
  bundle: equipment("kit", "Camera kit"),
  active: false,
};

const activeEntry: EquipmentKitSafetyEntry = {
  ...inactiveEntry,
  active: true,
  projectId: "project-1",
  projectName: "Broadcast",
};

const baseProps = {
  entries: [inactiveEntry],
  actionLabel: "Вернуть на склад",
  reason: "",
  overridePhrase: "",
  canOverrideActiveKit: false,
  requestPending: false,
  onReasonChange: vi.fn(),
  onOverridePhraseChange: vi.fn(),
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  onRequestManager: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EquipmentKitSafetyDialog", () => {
  it("allows extraction from an inactive kit", () => {
    const onConfirm = vi.fn();
    render(<EquipmentKitSafetyDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Извлечь и продолжить" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("requires the explicit override phrase for an active kit", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <EquipmentKitSafetyDialog
        {...baseProps}
        entries={[activeEntry]}
        canOverrideActiveKit
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole("button", { name: "Извлечь и продолжить" })).toBeDisabled();

    rerender(
      <EquipmentKitSafetyDialog
        {...baseProps}
        entries={[activeEntry]}
        overridePhrase="извлечь"
        canOverrideActiveKit
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Извлечь и продолжить" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("routes an active-kit extraction request to a manager", () => {
    const onRequestManager = vi.fn();
    render(
      <EquipmentKitSafetyDialog
        {...baseProps}
        entries={[inactiveEntry, activeEntry]}
        reason="Need replacement"
        onRequestManager={onRequestManager}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отправить запрос менеджеру" }));
    expect(onRequestManager).toHaveBeenCalledWith([activeEntry], "Need replacement");
  });
});
