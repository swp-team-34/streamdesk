import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { EquipmentBundleCreateDialog } from "./equipment-bundle-create-dialog";

function equipment(id: string): Equipment {
  return {
    id,
    name: `Equipment ${id}`,
    type: "other",
    status: "available",
  } as Equipment;
}

const items = [equipment("one"), equipment("two")];

const baseProps = {
  open: true,
  name: "Camera kit",
  categoryId: "none",
  categoryOptions: [
    { value: "category:cameras", label: "Cameras" },
    { value: "legacy:other", label: "Other" },
  ],
  items,
  pending: false,
  onOpenChange: vi.fn(),
  onNameChange: vi.fn(),
  onCategoryIdChange: vi.fn(),
  onSubmit: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EquipmentBundleCreateDialog", () => {
  it("requires a name and at least two components", () => {
    const { rerender } = render(
      <EquipmentBundleCreateDialog {...baseProps} name=" " />,
    );
    expect(screen.getByRole("button", { name: "Создать сборку" })).toBeDisabled();

    rerender(
      <EquipmentBundleCreateDialog {...baseProps} items={[items[0]]} />,
    );
    expect(screen.getByRole("button", { name: "Создать сборку" })).toBeDisabled();
  });

  it("submits the controlled values and normalizes the empty category", () => {
    const onSubmit = vi.fn();
    render(
      <EquipmentBundleCreateDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Создать сборку" }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Camera kit",
      categoryId: null,
      items,
    });
  });

  it("delegates name changes and cancellation", () => {
    const onNameChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <EquipmentBundleCreateDialog
        {...baseProps}
        onNameChange={onNameChange}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Название сборки"), {
      target: { value: "Updated kit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onNameChange).toHaveBeenCalledWith("Updated kit");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
