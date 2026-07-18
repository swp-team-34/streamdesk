import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanCardAttachmentsSection } from "./kanban-card-attachments-section";

const attachment = {
  id: "attachment-1",
  cardId: "card-1",
  uploadedByUserId: "user-1",
  fileName: "brief.pdf",
  fileUrl: "/files/brief.pdf",
  mimeType: "application/pdf",
  fileSize: 1536,
};

afterEach(cleanup);

describe("KanbanCardAttachmentsSection", () => {
  it("renders attachment metadata and delegates confirmed deletion", async () => {
    const onDelete = vi.fn();
    const confirmDelete = vi.fn(async () => true);
    render(
      <KanbanCardAttachmentsSection
        attachments={[attachment]}
        loading={false}
        canEdit
        uploadPending={false}
        deletePending={false}
        getUserName={() => "Tim"}
        onUpload={vi.fn()}
        onDelete={onDelete}
        confirmDelete={confirmDelete}
      />,
    );

    expect(screen.getByRole("link", { name: "brief.pdf" })).toHaveAttribute("href", "/files/brief.pdf");
    expect(screen.getByText(/1.5 КБ · application\/pdf/)).toBeInTheDocument();
    expect(screen.getByText("Загрузил: Tim")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(confirmDelete).toHaveBeenCalledOnce());
    expect(onDelete).toHaveBeenCalledWith("attachment-1");
  });

  it("delegates a selected upload and clears the file input", () => {
    const onUpload = vi.fn();
    render(
      <KanbanCardAttachmentsSection
        attachments={[]}
        loading={false}
        canEdit
        uploadPending={false}
        deletePending={false}
        getUserName={(id) => id}
        onUpload={onUpload}
        onDelete={vi.fn()}
        confirmDelete={async () => true}
      />,
    );

    const input = screen.getByLabelText("Загрузить файл") as HTMLInputElement;
    const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
  });

  it("shows loading/empty state and hides editing controls for viewers", () => {
    render(
      <KanbanCardAttachmentsSection
        attachments={[]}
        loading
        canEdit={false}
        uploadPending={false}
        deletePending={false}
        getUserName={(id) => id}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        confirmDelete={async () => true}
      />,
    );

    expect(screen.getByText("Загружаем файлы...")).toBeInTheDocument();
    expect(screen.getByText("У этой карточки пока нет вложений.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Загрузить файл")).not.toBeInTheDocument();
  });
});
