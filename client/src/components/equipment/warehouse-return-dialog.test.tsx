import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { WarehouseReturnDialog } from "./warehouse-return-dialog";

const item = {
  id: "equipment-1",
  name: "Camera",
  type: "camera",
  status: "in-use",
} as Equipment;

const baseProps = {
  equipment: item,
  storageLocations: [{
    id: "storage-1",
    companyId: "company-1",
    name: "Rack",
    path: "Room / Rack",
    type: "rack",
    position: 0,
  }],
  pending: false,
  onStorageChoiceChange: vi.fn(),
  onManualStorageChange: vi.fn(),
  onClose: vi.fn(),
  onSubmit: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WarehouseReturnDialog", () => {
  it("requires a configured or manual storage destination", () => {
    const { rerender } = render(
      <WarehouseReturnDialog {...baseProps} storageChoice="none" manualStorage="" />,
    );
    expect(screen.getByRole("button", { name: "Вернуть на склад" })).toBeDisabled();

    rerender(
      <WarehouseReturnDialog {...baseProps} storageChoice="manual" manualStorage="" />,
    );
    expect(screen.getByRole("button", { name: "Вернуть на склад" })).toBeDisabled();
    expect(screen.getByLabelText("Место хранения вручную")).toBeInTheDocument();
  });

  it("normalizes manual storage before submitting", () => {
    const onSubmit = vi.fn();
    render(
      <WarehouseReturnDialog
        {...baseProps}
        storageChoice="manual"
        manualStorage="  Rack B / Shelf 3  "
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Вернуть на склад" }));
    expect(onSubmit).toHaveBeenCalledWith({
      storageLocationId: null,
      storageLocation: "Rack B / Shelf 3",
    });
  });

  it("submits a configured storage id and delegates cancellation", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <WarehouseReturnDialog
        {...baseProps}
        storageChoice="storage-1"
        manualStorage="ignored"
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Вернуть на склад" }));
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onSubmit).toHaveBeenCalledWith({
      storageLocationId: "storage-1",
      storageLocation: null,
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
