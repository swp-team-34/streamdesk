import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";
import { KanbanCardEquipmentSection } from "./kanban-card-equipment-section";
import type { KanbanEquipmentLinkView } from "@/lib/kanban-equipment-links";

const manualLink: KanbanEquipmentLinkView = {
  id: "link-1",
  cardId: "card-1",
  source: "manual",
  active: true,
  workflowStatus: "linked",
  equipment: {
    id: "equipment-1",
    name: "Camera",
    model: "C100",
  },
};

function renderSection(overrides: Partial<React.ComponentProps<typeof KanbanCardEquipmentSection>> = {}) {
  const callbacks = {
    onSelectionChange: vi.fn(),
    onAttach: vi.fn(),
    onDetach: vi.fn(),
  };
  render(
    <Router>
      <KanbanCardEquipmentSection
        companyScoped
        links={[manualLink]}
        availableEquipment={[{ id: "equipment-2", name: "Microphone", model: "M1" }]}
        loading={false}
        canManage
        selection="equipment-2"
        attachPending={false}
        detachPending={false}
        getUserName={(id) => id}
        {...callbacks}
        {...overrides}
      />
    </Router>,
  );
  return callbacks;
}

afterEach(cleanup);

describe("KanbanCardEquipmentSection", () => {
  it("delegates selection, attach and manual detach actions", () => {
    const callbacks = renderSection();
    chooseStreamSelectOption("Оборудование для карточки", "Выберите оборудование");
    fireEvent.click(screen.getByRole("button", { name: "Прикрепить" }));
    fireEvent.click(screen.getByRole("button", { name: "Открепить Camera" }));

    expect(callbacks.onSelectionChange).toHaveBeenCalledWith("");
    expect(callbacks.onAttach).toHaveBeenCalledWith("equipment-2");
    expect(callbacks.onDetach).toHaveBeenCalledWith("equipment-1");
    expect(screen.getByText("Прикреплено")).toBeInTheDocument();
  });

  it("renders checkout request details", () => {
    renderSection({
      links: [{
        ...manualLink,
        id: "request-link",
        source: "checkout",
        workflowStatus: "issued",
        request: {
          id: "request-1",
          status: "issued",
          requestedBy: "user-1",
          quantity: 2,
          location: "Studio",
          note: "Handle carefully",
        },
      }],
      getUserName: () => "Tim",
    });

    expect(screen.getByText("Заявка / выдача")).toBeInTheDocument();
    expect(screen.getByText("Выдано")).toBeInTheDocument();
    expect(screen.getByText("Запросил: Tim")).toBeInTheDocument();
    expect(screen.getByText("Количество: 2")).toBeInTheDocument();
    expect(screen.getByText("Локация: Studio")).toBeInTheDocument();
    expect(screen.getByText("Handle carefully")).toBeInTheDocument();
  });

  it("shows company gating and empty state without management controls", () => {
    renderSection({
      companyScoped: false,
      links: [],
      availableEquipment: [],
      canManage: false,
    });

    expect(screen.getByText("Warehouse доступен только в пространстве компании.")).toBeInTheDocument();
    expect(screen.getByText("К этой карточке пока не прикреплено оборудование.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Оборудование для карточки" })).not.toBeInTheDocument();
  });
});
