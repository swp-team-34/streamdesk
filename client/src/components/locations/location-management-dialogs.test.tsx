import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationArchiveDialog, LocationFormDialog } from "./location-management-dialogs";

afterEach(cleanup);

describe("Location management dialogs", () => {
  it("delegates controlled form changes and creation", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(
      <LocationFormDialog
        open
        editing={false}
        companies={[{ id: "company-1", name: "Team A" }, { id: "company-2", name: "Team B" }]}
        form={{
          companyId: "company-1",
          name: "Studio A",
          type: "recording",
          address: "",
          description: "",
          notes: "",
          status: "available",
        }}
        primaryCompanyId="company-1"
        pending={false}
        onClose={vi.fn()}
        onChange={onChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Studio A"), { target: { value: "Studio B" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Studio B" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows archive impact and delegates confirmation", () => {
    const onConfirm = vi.fn();
    render(
      <LocationArchiveDialog
        target={{ id: "location-1", name: "Studio A" }}
        preview={{
          locationId: "location-1",
          activeLinks: {
            activeKanbanCards: 2,
            activeProjects: 1,
            unresolvedDiscussions: 3,
            total: 6,
          },
        }}
        previewPending={false}
        archivePending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Активные карточки Kanban V2: 2")).toBeInTheDocument();
    expect(screen.getByText("Активные проекты: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить архивирование" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
