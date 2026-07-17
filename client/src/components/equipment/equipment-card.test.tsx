import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { EquipmentCard } from "./equipment-card";

function equipment(id: string, overrides: Partial<Equipment> = {}): Equipment {
  return {
    id,
    name: "Cinema camera",
    type: "camera",
    status: "available",
    operabilityStatus: "working",
    ...overrides,
  } as Equipment;
}

function createProps(item: Equipment) {
  return {
    item,
    allEquipment: [item],
    selected: false,
    inCart: false,
    requestType: "checkout",
    requestedByCurrentUser: false,
    canReturnOwnItem: false,
    canRequestItem: false,
    canReserve: true,
    canEdit: true,
    canDelete: true,
    currentUserId: "user-1",
    expanded: false,
    printPending: false,
    calibratePending: false,
    returnPending: false,
    deletePending: false,
    removeKitPending: false,
    getAssignedUserName: vi.fn(() => "Tim"),
    getProjectInfo: vi.fn(() => undefined),
    isReturnOverdue: vi.fn(() => false),
    onToggleSelected: vi.fn(),
    onOpenDetails: vi.fn(),
    onOpenBarcode: vi.fn(),
    onPrint: vi.fn(),
    onCalibrate: vi.fn(),
    onAddToCart: vi.fn(),
    onTakeReturn: vi.fn(),
    onReturnOwn: vi.fn(),
    onRequest: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onProjectReturn: vi.fn(),
    onToggleBundle: vi.fn(),
    onAddBundleComponent: vi.fn(),
    onOpenBundleComponent: vi.fn(),
    onRemoveBundleComponent: vi.fn(),
  };
}

afterEach(cleanup);

describe("EquipmentCard", () => {
  it("delegates primary card actions without opening details", () => {
    const item = equipment("equipment-1");
    const props = createProps(item);
    render(<EquipmentCard {...props} />);

    fireEvent.click(screen.getByLabelText("Выбрать «Cinema camera»"));
    fireEvent.click(screen.getByTestId("button-details-equipment-1"));
    fireEvent.click(screen.getByTestId("button-barcode-equipment-1"));
    fireEvent.click(screen.getByTestId("button-print-label-equipment-1"));
    fireEvent.click(screen.getByTestId("button-calibrate-label-equipment-1"));
    fireEvent.click(screen.getByTitle("В корзину"));
    fireEvent.click(screen.getByTestId("button-take-return-equipment-1"));
    fireEvent.click(screen.getByTestId("button-edit-equipment-1"));
    fireEvent.click(screen.getByTitle("Удалить"));

    expect(props.onToggleSelected).toHaveBeenCalledWith(item);
    expect(props.onOpenDetails).toHaveBeenCalledWith(item);
    expect(props.onOpenBarcode).toHaveBeenCalledWith(item);
    expect(props.onPrint).toHaveBeenCalledWith(item);
    expect(props.onCalibrate).toHaveBeenCalledOnce();
    expect(props.onAddToCart).toHaveBeenCalledWith(item);
    expect(props.onTakeReturn).toHaveBeenCalledWith(item, false);
    expect(props.onEdit).toHaveBeenCalledWith(item);
    expect(props.onDelete).toHaveBeenCalledWith(item);
  });

  it("shows normalized location, storage and activity metadata", () => {
    const item = equipment("equipment-1", {
      storageLocation: "Rack B / Shelf 3",
    }) as Equipment & { physicalDestination: unknown; activitySummary: unknown };
    item.physicalDestination = { displayName: "Main stage" };
    item.activitySummary = { commentCount: 2, attachmentCount: 1, latestAuthorName: "Tim" };
    render(<EquipmentCard {...createProps(item)} />);
    expect(screen.getByText("Main stage")).toBeInTheDocument();
    expect(screen.getByText("Rack B / Shelf 3")).toBeInTheDocument();
    expect(screen.getByText(/2 зап./)).toHaveTextContent("файлов: 1");
    expect(screen.getByText(/2 зап./)).toHaveTextContent("последний: Tim");
  });

  it("routes project return through an existing parent kit", () => {
    const parent = equipment("kit", { name: "Camera kit" });
    const item = equipment("equipment-1", {
      status: "in-use",
      specifications: { parentBundleId: parent.id, parentBundleName: parent.name },
    });
    const props = {
      ...createProps(item),
      allEquipment: [parent, item],
      projectInfo: {
        projectId: "project-1",
        returnDate: "2026-07-20",
        assignedByName: "Tim",
        assignedByUserId: "user-1",
      },
    };
    render(<EquipmentCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть сборку" }));
    expect(props.onProjectReturn).toHaveBeenCalledWith(item, true);
    expect(screen.getByText("В сборке")).toBeInTheDocument();
  });
});
