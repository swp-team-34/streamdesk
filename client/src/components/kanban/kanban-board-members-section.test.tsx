import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";
import { KanbanBoardMembersSection } from "./kanban-board-members-section";

const user = { id: "user-1", name: "Tim", email: "tim@example.test" };
const member = {
  id: "member-1",
  boardId: "board-1",
  userId: "user-1",
  role: "viewer" as const,
  canComment: false,
};

afterEach(cleanup);

describe("KanbanBoardMembersSection", () => {
  it("explains personal-board membership without management controls", () => {
    render(
      <KanbanBoardMembersSection
        personal
        canManage
        loading={false}
        members={[]}
        availableMembers={[]}
        userById={new Map()}
        form={{ userId: "", role: "viewer", canComment: false }}
        pending={false}
        onFormChange={vi.fn()}
        onCancelEdit={vi.fn()}
        onSave={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Личная доска принадлежит тебе/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Участник доски" })).not.toBeInTheDocument();
  });

  it("delegates member form and save actions", () => {
    const onFormChange = vi.fn();
    const onSave = vi.fn();
    render(
      <KanbanBoardMembersSection
        personal={false}
        canManage
        loading={false}
        members={[]}
        availableMembers={[user]}
        userById={new Map([[user.id, user]])}
        form={{ userId: "user-1", role: "viewer", canComment: false }}
        pending={false}
        onFormChange={onFormChange}
        onCancelEdit={vi.fn()}
        onSave={onSave}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    chooseStreamSelectOption("Роль участника", "editor");
    expect(onFormChange).toHaveBeenCalledWith({ userId: "user-1", role: "editor", canComment: true });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("renders member permissions and delegates edit/delete", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <KanbanBoardMembersSection
        personal={false}
        canManage
        creatorUserId="another-user"
        loading={false}
        members={[member]}
        availableMembers={[]}
        userById={new Map([[user.id, user]])}
        form={{ userId: "", role: "viewer", canComment: false }}
        pending={false}
        onFormChange={vi.fn()}
        onCancelEdit={vi.fn()}
        onSave={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Tim")).toBeInTheDocument();
    expect(screen.getByText("read only")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onEdit).toHaveBeenCalledWith(member);
    expect(onDelete).toHaveBeenCalledWith(member, "Tim");
  });
});
