import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KANBAN_PANEL_SELECT_CLASS } from "./kanban-styles";

export interface KanbanBoardMemberView {
  id: string;
  boardId: string;
  userId: string;
  role: "viewer" | "editor";
  canComment?: boolean | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface MemberFormState {
  userId: string;
  role: "viewer" | "editor";
  canComment: boolean;
}

interface UserOption {
  id: string;
  name: string;
  email?: string | null;
}

interface KanbanBoardMembersSectionProps {
  personal: boolean;
  canManage: boolean;
  creatorUserId?: string | null;
  loading: boolean;
  members: KanbanBoardMemberView[];
  availableMembers: UserOption[];
  userById: ReadonlyMap<string, UserOption>;
  form: MemberFormState;
  editingMemberId?: string | null;
  pending: boolean;
  onFormChange: (form: MemberFormState) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onEdit: (member: KanbanBoardMemberView) => void;
  onDelete: (member: KanbanBoardMemberView, userName: string) => void;
}

export function KanbanBoardMembersSection({
  personal,
  canManage,
  creatorUserId,
  loading,
  members,
  availableMembers,
  userById,
  form,
  editingMemberId,
  pending,
  onFormChange,
  onCancelEdit,
  onSave,
  onEdit,
  onDelete,
}: KanbanBoardMembersSectionProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Участники</h3>
          <p className="text-sm text-muted-foreground">
            {personal
              ? "Личная доска принадлежит тебе. Для командной совместной работы создай доску компании."
              : "Управляй доступом участников к текущей доске."}
          </p>
        </div>
        {!personal && loading && (
          <span className="text-xs text-muted-foreground">Загружаем...</span>
        )}
      </div>

      {!personal && canManage && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-border/35 bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
          <select
            aria-label="Участник доски"
            className={KANBAN_PANEL_SELECT_CLASS}
            value={form.userId}
            onChange={(event) => onFormChange({ ...form, userId: event.target.value })}
            disabled={Boolean(editingMemberId) || pending}
          >
            {editingMemberId ? (
              <option value={form.userId}>
                {userById.get(form.userId)?.name || form.userId}
              </option>
            ) : availableMembers.length === 0 ? (
              <option value="">Нет доступных участников</option>
            ) : (
              availableMembers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))
            )}
          </select>

          <select
            aria-label="Роль участника"
            className={KANBAN_PANEL_SELECT_CLASS}
            value={form.role}
            onChange={(event) => {
              const role = event.target.value as MemberFormState["role"];
              onFormChange({
                ...form,
                role,
                canComment: role === "editor" ? true : form.canComment,
              });
            }}
            disabled={pending}
          >
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
          </select>

          <label className="flex items-center gap-2 rounded-xl border border-border/35 bg-muted/20 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.role === "editor" ? true : form.canComment}
              onChange={(event) => onFormChange({ ...form, canComment: event.target.checked })}
              disabled={form.role === "editor" || pending}
            />
            can comment
          </label>

          <div className="flex gap-2">
            {editingMemberId && (
              <Button variant="ghost" size="sm" className="rounded-xl" onClick={onCancelEdit} disabled={pending}>
                Отмена
              </Button>
            )}
            <Button
              size="sm"
              className="rounded-xl"
              onClick={onSave}
              disabled={(!form.userId && !editingMemberId) || pending}
            >
              {editingMemberId ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      )}

      {!personal && (
        <div className="mt-4 space-y-2">
          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              В этой доске пока нет отдельных участников.
            </div>
          ) : (
            members.map((member) => {
              const user = userById.get(member.userId);
              const userName = user?.name || member.userId;
              const isCreator = String(member.userId) === String(creatorUserId || "");
              return (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/35 bg-muted/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{userName}</div>
                    <div className="text-xs text-muted-foreground">{user?.email || "Без email"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">{member.role}</Badge>
                    <Badge variant="outline" className="rounded-full">
                      {member.canComment || member.role === "editor" ? "can comment" : "read only"}
                    </Badge>
                    {isCreator && <Badge variant="outline" className="rounded-full">creator</Badge>}
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEdit(member)} disabled={pending}>
                          Изменить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => onDelete(member, userName)}
                          disabled={pending || isCreator}
                        >
                          Удалить
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
