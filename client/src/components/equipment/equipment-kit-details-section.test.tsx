import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { EquipmentKitDetailsSection } from "./equipment-kit-details-section";

function equipment(id: string, overrides: Partial<Equipment> = {}): Equipment {
  return {
    id,
    name: id,
    type: "other",
    status: "available",
    ...overrides,
  } as Equipment;
}

afterEach(cleanup);

describe("EquipmentKitDetailsSection", () => {
  it("delegates add, open and remove actions for live components", () => {
    const component = equipment("camera", { name: "Cinema camera" });
    const bundle = equipment("kit", {
      name: "Camera kit",
      specifications: { isSuperPosition: true, bundleComponentIds: [component.id] },
    });
    const onAdd = vi.fn();
    const onOpenComponent = vi.fn();
    const onRemove = vi.fn();
    render(
      <EquipmentKitDetailsSection
        equipment={bundle}
        allEquipment={[bundle, component]}
        canEdit
        removePending={false}
        onAdd={onAdd}
        onOpenComponent={onOpenComponent}
        onRemove={onRemove}
        onOpenParent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    fireEvent.click(screen.getByRole("button", { name: "Открыть «Cinema camera»" }));
    fireEvent.click(screen.getByRole("button", { name: "Убрать «Cinema camera» из комплекта" }));
    expect(onAdd).toHaveBeenCalledWith(bundle);
    expect(onOpenComponent).toHaveBeenCalledWith(bundle.id, component);
    expect(onRemove).toHaveBeenCalledWith(bundle, component);
  });

  it("shows a recoverable warning when the parent bundle no longer exists", () => {
    const component = equipment("camera", {
      specifications: { parentBundleId: "missing-kit", parentBundleName: "Deleted kit" },
    });
    render(
      <EquipmentKitDetailsSection
        equipment={component}
        allEquipment={[component]}
        canEdit
        removePending={false}
        onAdd={vi.fn()}
        onOpenComponent={vi.fn()}
        onRemove={vi.fn()}
        onOpenParent={vi.fn()}
      />,
    );
    expect(screen.getByText(/Сборка/)).toHaveTextContent("Deleted kit");
    expect(screen.queryByRole("button", { name: "Открыть комплект" })).not.toBeInTheDocument();
  });

  it("opens an existing parent bundle", () => {
    const parent = equipment("kit", { name: "Camera kit" });
    const component = equipment("camera", {
      specifications: { parentBundleId: parent.id, parentBundleName: parent.name },
    });
    const onOpenParent = vi.fn();
    render(
      <EquipmentKitDetailsSection
        equipment={component}
        allEquipment={[parent, component]}
        canEdit={false}
        removePending={false}
        onAdd={vi.fn()}
        onOpenComponent={vi.fn()}
        onRemove={vi.fn()}
        onOpenParent={onOpenParent}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Открыть комплект" }));
    expect(onOpenParent).toHaveBeenCalledWith(component);
  });
});
