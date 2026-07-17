import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { EquipmentKitCardSection } from "./equipment-kit-card-section";

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

describe("EquipmentKitCardSection", () => {
  it("keeps composition collapsed until requested", () => {
    const bundle = equipment("kit", {
      specifications: { isSuperPosition: true, bundleComponentIds: [] },
    });
    const onToggle = vi.fn();
    render(
      <EquipmentKitCardSection
        bundle={bundle}
        allEquipment={[bundle]}
        expanded={false}
        canEdit={false}
        removePending={false}
        getProjectInfo={() => undefined}
        getAssignedUserName={() => ""}
        isReturnOverdue={() => false}
        onToggle={onToggle}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Состав: 0" }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByText("В комплекте нет компонентов.")).not.toBeInTheDocument();
  });

  it("delegates component actions and preserves project and overdue indicators", () => {
    const component = equipment("camera", {
      name: "Cinema camera",
      assignedTo: "user-1",
    });
    const bundle = equipment("kit", {
      name: "Camera kit",
      specifications: { isSuperPosition: true, bundleComponentIds: [component.id] },
    });
    const onAdd = vi.fn();
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    render(
      <EquipmentKitCardSection
        bundle={bundle}
        allEquipment={[bundle, component]}
        expanded
        canEdit
        removePending={false}
        getProjectInfo={() => ({ returnDate: "2026-07-01" })}
        getAssignedUserName={() => "Tim"}
        isReturnOverdue={() => true}
        onToggle={vi.fn()}
        onAdd={onAdd}
        onOpen={onOpen}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("На проекте")).toBeInTheDocument();
    expect(screen.getByText("Просрочено")).toBeInTheDocument();
    expect(screen.getByText("У сотрудника: Tim")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Добавить позицию в «Camera kit»" }));
    fireEvent.click(screen.getByRole("button", { name: "Открыть «Cinema camera»" }));
    fireEvent.click(screen.getByRole("button", { name: "Убрать «Cinema camera» из комплекта" }));
    expect(onAdd).toHaveBeenCalledWith(bundle);
    expect(onOpen).toHaveBeenCalledWith(bundle.id, component);
    expect(onRemove).toHaveBeenCalledWith(bundle, component);
  });
});
