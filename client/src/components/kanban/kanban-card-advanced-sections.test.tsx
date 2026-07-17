import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanCardAdvancedSections } from "./kanban-card-advanced-sections";

vi.mock("@/components/kanban/kanban-card-equipment-section", () => ({
  KanbanCardEquipmentSection: ({ onAttach }: { onAttach: (id: string) => void }) => (
    <button type="button" onClick={() => onAttach("equipment-1")}>Equipment section</button>
  ),
}));
vi.mock("@/components/kanban/kanban-card-subtasks-section", () => ({
  KanbanCardSubtasksSection: () => <div>Subtasks section</div>,
}));
vi.mock("@/components/kanban/kanban-card-attachments-section", () => ({
  KanbanCardAttachmentsSection: () => <div>Attachments section</div>,
}));
vi.mock("@/components/kanban/kanban-card-activity-section", () => ({
  KanbanCardActivitySection: () => <div>Activity section</div>,
}));
vi.mock("@/components/discussion-thread", () => ({
  DiscussionThread: ({ apiPath, onActivity }: { apiPath: string; onActivity: () => void }) => (
    <button type="button" onClick={onActivity}>Discussion {apiPath}</button>
  ),
}));

const baseProps = {
  expanded: true,
  sectionClassName: "section",
  boardId: "board-1",
  cardId: "card-1",
  commentCount: 2,
  canComment: true,
  canEdit: true,
  companyScoped: true,
  equipmentLinks: [],
  availableEquipment: [],
  equipmentLoading: false,
  canManageEquipment: true,
  equipmentSelection: "",
  attachPending: false,
  detachPending: false,
  subtasks: [],
  subtaskDraft: "",
  subtaskPending: false,
  attachments: [],
  attachmentsLoading: false,
  uploadPending: false,
  deleteAttachmentPending: false,
  history: [],
  historyLoading: false,
  historyExpanded: false,
  getUserName: (id: string) => id,
  getHistoryChangeLines: () => [],
  confirmDelete: () => true,
  onEquipmentSelectionChange: vi.fn(),
  onAttachEquipment: vi.fn(),
  onDetachEquipment: vi.fn(),
  onSubtaskDraftChange: vi.fn(),
  onSaveSubtasks: vi.fn(),
  onUploadAttachment: vi.fn(),
  onDeleteAttachment: vi.fn(),
  onToggleHistoryExpanded: vi.fn(),
  onCommentActivity: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("KanbanCardAdvancedSections", () => {
  it("connects advanced workflows and the discussion endpoint", () => {
    const onAttachEquipment = vi.fn();
    const onCommentActivity = vi.fn();
    render(
      <KanbanCardAdvancedSections
        {...baseProps}
        onAttachEquipment={onAttachEquipment}
        onCommentActivity={onCommentActivity}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Equipment section" }));
    fireEvent.click(screen.getByRole("button", { name: /Discussion \/api\/kanban\/boards\/board-1\/cards\/card-1\/comments/ }));
    expect(onAttachEquipment).toHaveBeenCalledWith("equipment-1");
    expect(onCommentActivity).toHaveBeenCalledOnce();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("keeps every advanced section hidden while collapsed", () => {
    const { container } = render(<KanbanCardAdvancedSections {...baseProps} expanded={false} />);
    expect(container.querySelectorAll(".hidden")).toHaveLength(5);
  });

  it("separates resource workflows from activity workflows", () => {
    const { rerender } = render(
      <KanbanCardAdvancedSections {...baseProps} mode="resources" />,
    );
    expect(screen.getByText("Equipment section")).toBeInTheDocument();
    expect(screen.getByText("Subtasks section")).toBeInTheDocument();
    expect(screen.getByText("Attachments section")).toBeInTheDocument();
    expect(screen.queryByText("Activity section")).not.toBeInTheDocument();
    expect(screen.queryByText(/Discussion/)).not.toBeInTheDocument();

    rerender(<KanbanCardAdvancedSections {...baseProps} mode="activity" />);
    expect(screen.queryByText("Equipment section")).not.toBeInTheDocument();
    expect(screen.getByText("Activity section")).toBeInTheDocument();
    expect(screen.getByText(/Discussion/)).toBeInTheDocument();
  });
});
