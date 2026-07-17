import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { EquipmentCheckoutRequestDialog } from "./equipment-checkout-request-dialog";

const equipment = {
  id: "camera",
  name: "Cinema camera",
  type: "camera",
  status: "available",
  operabilityStatus: "working",
} as Equipment;

const project = { id: "project-1", name: "Broadcast" };
const card = {
  id: "card-1",
  title: "Prepare camera",
  boardName: "Production",
  listName: "Todo",
  projectId: project.id,
};

const baseProps = {
  equipment,
  requestType: "checkout" as const,
  companyId: "company-1",
  assignedUserName: "",
  locations: [{ id: "location-1", name: "Studio" }],
  projects: [project],
  cards: [card],
  locationChoice: "location-1",
  manualLocation: "",
  quantity: "1",
  projectId: "none",
  selectedCardIds: new Set<string>(),
  note: "For recording",
  pending: false,
  onClose: vi.fn(),
  onLocationChoiceChange: vi.fn(),
  onManualLocationChange: vi.fn(),
  onQuantityChange: vi.fn(),
  onProjectIdChange: vi.fn(),
  onSelectedCardIdsChange: vi.fn(),
  onNoteChange: vi.fn(),
  onValidationError: vi.fn(),
  onSubmit: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EquipmentCheckoutRequestDialog", () => {
  it("submits a normalized checkout request", () => {
    const onSubmit = vi.fn();
    render(
      <EquipmentCheckoutRequestDialog
        {...baseProps}
        manualLocation="  Offsite stage  "
        locationChoice="manual"
        quantity="2"
        projectId={project.id}
        selectedCardIds={new Set([card.id])}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onSubmit).toHaveBeenCalledWith({
      physicalDestination: { manualLocation: "Offsite stage" },
      workContext: { projectId: project.id, kanbanCardIds: [card.id] },
      note: "For recording",
      requestType: "checkout",
      quantity: 2,
    });
  });

  it("reports invalid quantity and location without submitting", () => {
    const onValidationError = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <EquipmentCheckoutRequestDialog
        {...baseProps}
        quantity="0"
        onValidationError={onValidationError}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onValidationError).toHaveBeenLastCalledWith({
      title: "Проверьте количество",
      description: "Укажите положительное целое число.",
    });

    rerender(
      <EquipmentCheckoutRequestDialog
        {...baseProps}
        locationChoice=""
        onValidationError={onValidationError}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onValidationError).toHaveBeenLastCalledWith({
      title: "Укажите место",
      description: "Выберите площадку или заполните ручное местоположение.",
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("selecting a card also selects its project and reconciles the card set", () => {
    const onProjectIdChange = vi.fn();
    const onSelectedCardIdsChange = vi.fn();
    render(
      <EquipmentCheckoutRequestDialog
        {...baseProps}
        onProjectIdChange={onProjectIdChange}
        onSelectedCardIdsChange={onSelectedCardIdsChange}
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Карточки Kanban V2" }));
    fireEvent.click(screen.getByRole("option", { name: /Prepare camera/ }));
    expect(onProjectIdChange).toHaveBeenCalledWith(project.id);
    expect([...onSelectedCardIdsChange.mock.calls[0][0]]).toEqual([card.id]);
  });

  it("renders transfer context and delegates cancellation", () => {
    const onClose = vi.fn();
    render(
      <EquipmentCheckoutRequestDialog
        {...baseProps}
        requestType="transfer"
        assignedUserName="Alex"
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("heading", { name: "Запросить перенос оборудования" })).toBeInTheDocument();
    expect(screen.getByText("Сейчас у сотрудника: Alex")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
