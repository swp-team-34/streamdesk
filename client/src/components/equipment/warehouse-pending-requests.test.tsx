import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@shared/schema";
import {
  WarehousePendingRequests,
  type WarehousePendingRequestGroupView,
} from "./warehouse-pending-requests";

const equipment = {
  id: "camera",
  name: "Cinema camera",
  type: "camera",
  status: "available",
} as Equipment;

const group: WarehousePendingRequestGroupView = {
  id: "group-1",
  requestIds: ["request-1"],
  items: [equipment],
  fallbackEquipmentName: equipment.name,
  requesterName: "Alex",
  requestType: "checkout",
  currentHolderName: "",
  quantity: 2,
  destination: "Studio",
  projectName: "Broadcast",
  kanbanCardTitles: ["Prepare camera"],
  note: "For recording",
};

afterEach(cleanup);

describe("WarehousePendingRequests", () => {
  it("renders nothing without pending groups", () => {
    const { container } = render(
      <WarehousePendingRequests
        groups={[]}
        approvePending={false}
        rejectPending={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders request context and delegates approval decisions", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <WarehousePendingRequests
        groups={[group]}
        approvePending={false}
        rejectPending={false}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    expect(screen.getByText("Cinema camera")).toBeInTheDocument();
    expect(screen.getByText("Проект: Broadcast")).toBeInTheDocument();
    expect(screen.getByText("Kanban V2: Prepare camera")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Разрешить" }));
    fireEvent.click(screen.getByRole("button", { name: "Отклонить" }));
    expect(onApprove).toHaveBeenCalledWith(group);
    expect(onReject).toHaveBeenCalledWith(group.requestIds);
  });

  it("uses the extraction-specific approval action", () => {
    render(
      <WarehousePendingRequests
        groups={[{
          ...group,
          requestType: "kit-extraction",
          currentHolderName: "Manager",
        }]}
        approvePending={false}
        rejectPending={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Подтвердить извлечение" })).toBeInTheDocument();
    expect(screen.getByText("Активный комплект: Manager")).toBeInTheDocument();
  });
});
