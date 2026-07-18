import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import { WarehouseCartSheet } from "./warehouse-cart-sheet";

const equipment = {
  id: "camera",
  name: "Cinema camera",
  model: "C100",
  type: "camera",
  status: "available",
} as Equipment;

const baseProps = {
  open: true,
  cart: [equipment],
  projects: [{ id: "project-1", name: "Broadcast" }],
  equipmentCountByProject: { "project-1": 2 },
  canReserve: false,
  canRequestCheckout: true,
  sendToProjectId: "",
  handoffAt: "2026-07-17T10:00",
  returnDate: "",
  returnTime: "18:00",
  passDirection: "out" as const,
  passBasis: "",
  passResponsiblePhone: "",
  passPending: false,
  takePending: false,
  sendPending: false,
  onOpenChange: vi.fn(),
  onRemove: vi.fn(),
  onClear: vi.fn(),
  onSendToProjectIdChange: vi.fn(),
  onHandoffAtChange: vi.fn(),
  onReturnDateChange: vi.fn(),
  onReturnTimeChange: vi.fn(),
  onPassDirectionChange: vi.fn(),
  onPassBasisChange: vi.fn(),
  onPassResponsiblePhoneChange: vi.fn(),
  onDownloadPass: vi.fn(),
  onTakeForSelf: vi.fn(),
  onSendToProject: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WarehouseCartSheet", () => {
  it("shows the empty cart state", () => {
    render(<WarehouseCartSheet {...baseProps} cart={[]} />);
    expect(screen.getByText(/Добавьте оборудование с карточек/)).toBeInTheDocument();
  });

  it("delegates employee cart actions", () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    const onTakeForSelf = vi.fn();
    render(
      <WarehouseCartSheet
        {...baseProps}
        onRemove={onRemove}
        onClear={onClear}
        onTakeForSelf={onTakeForSelf}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Убрать «Cinema camera» из корзины" }));
    fireEvent.click(screen.getByRole("button", { name: "Очистить" }));
    fireEvent.click(screen.getByRole("button", { name: "Запросить себе" }));
    expect(onRemove).toHaveBeenCalledWith(equipment.id);
    expect(onClear).toHaveBeenCalledOnce();
    expect(onTakeForSelf).toHaveBeenCalledOnce();
  });

  it("keeps project handoff fields controlled and submits their snapshot", () => {
    const onReturnDateChange = vi.fn();
    const onPassBasisChange = vi.fn();
    const onDownloadPass = vi.fn();
    const onSendToProject = vi.fn();
    render(
      <WarehouseCartSheet
        {...baseProps}
        canReserve
        sendToProjectId="project-1"
        returnDate="2026-07-20"
        onReturnDateChange={onReturnDateChange}
        onPassBasisChange={onPassBasisChange}
        onDownloadPass={onDownloadPass}
        onSendToProject={onSendToProject}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Вернуть до/));
    fireEvent.click(screen.getByRole("gridcell", { name: "21" }));
    fireEvent.change(screen.getByLabelText("Основание"), {
      target: { value: "Production" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Скачать пропуск DOCX" }));
    fireEvent.click(screen.getByRole("button", { name: "Отправить на проект" }));

    expect(onReturnDateChange).toHaveBeenCalledWith("2026-07-21");
    expect(onPassBasisChange).toHaveBeenCalledWith("Production");
    expect(onDownloadPass).toHaveBeenCalledOnce();
    expect(onSendToProject).toHaveBeenCalledWith({
      projectId: "project-1",
      handoffAt: "2026-07-17T10:00",
      returnDate: "2026-07-20",
      returnTime: "18:00",
    });
  });
});
