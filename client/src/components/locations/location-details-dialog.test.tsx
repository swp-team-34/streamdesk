import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationDetailsDialog } from "./location-details-dialog";

afterEach(cleanup);

describe("LocationDetailsDialog", () => {
  it("renders linked work and delegates management actions", () => {
    const onRemoveAttachment = vi.fn();
    const onArchive = vi.fn();
    const onEdit = vi.fn();
    render(
      <LocationDetailsDialog
        location={{
          id: "location-1",
          name: "Studio A",
          status: "available",
          linkedWork: {
            cards: [{
              id: "card-1",
              title: "Prepare stream",
              boardId: "board-1",
              boardName: "Sprint",
              listName: "Active",
              listType: "active",
              status: "active",
            }],
            projects: [{
              id: "project-1",
              name: "Launch",
              status: "planning",
              completed: false,
              source: "direct_and_cards",
            }],
          },
          attachments: [{
            id: "file-1",
            fileName: "plan.pdf",
            fileUrl: "/files/plan.pdf",
            fileSize: 1024,
          }],
        }}
        loading={false}
        canManage
        restorePending={false}
        onClose={vi.fn()}
        onUpload={vi.fn()}
        onRemoveAttachment={onRemoveAttachment}
        onRestore={vi.fn()}
        onArchive={onArchive}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("Prepare stream")).toBeInTheDocument();
    expect(screen.getByText("Launch")).toBeInTheDocument();
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Удалить файл" }));
    fireEvent.click(screen.getByRole("button", { name: "В архив" }));
    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    expect(onRemoveAttachment).toHaveBeenCalledWith("file-1");
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
