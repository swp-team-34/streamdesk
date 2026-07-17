import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  getSubtaskProgress,
  normalizeSubtasks,
  type KanbanSubtask,
} from "@/lib/kanban-board-model";
import { KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

interface KanbanCardSubtasksSectionProps {
  subtasks?: KanbanSubtask[] | null;
  draft: string;
  canEdit: boolean;
  pending: boolean;
  onDraftChange: (value: string) => void;
  onSave: (subtasks: KanbanSubtask[], clearDraftOnSuccess?: boolean) => void;
  confirmDelete: (message: string) => Promise<boolean>;
}

export function KanbanCardSubtasksSection({
  subtasks,
  draft,
  canEdit,
  pending,
  onDraftChange,
  onSave,
  confirmDelete,
}: KanbanCardSubtasksSectionProps) {
  const normalizedSubtasks = normalizeSubtasks(subtasks);
  const progress = getSubtaskProgress(normalizedSubtasks);

  const addSubtask = () => {
    const title = draft.trim();
    if (!title) return;
    onSave([
      ...normalizedSubtasks,
      {
        id: `kst-${Date.now()}`,
        title,
        completed: false,
      },
    ], true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Подзадачи ({progress.completed}/{progress.total})
        </h3>
      </div>

      {normalizedSubtasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          У этой карточки пока нет подзадач.
        </div>
      ) : (
        <div className="space-y-2">
          {normalizedSubtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 rounded-2xl border border-border/35 bg-muted/20 px-3 py-2.5"
            >
              <Checkbox
                aria-label={`Выполнено: ${subtask.title}`}
                checked={Boolean(subtask.completed)}
                onCheckedChange={(checked) => onSave(normalizedSubtasks.map((item) =>
                  item.id === subtask.id ? { ...item, completed: checked === true } : item,
                ))}
                disabled={!canEdit || pending}
              />
              <span
                className={[
                  "flex-1 text-sm",
                  subtask.completed ? "line-through text-muted-foreground" : "",
                ].join(" ")}
              >
                {subtask.title}
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!await confirmDelete(`Удалить подзадачу "${subtask.title}"?`)) return;
                    onSave(normalizedSubtasks.filter((item) => item.id !== subtask.id));
                  }}
                  disabled={pending}
                >
                  Удалить
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Добавить подзадачу"
            disabled={pending}
            className={KANBAN_PANEL_INPUT_CLASS}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !draft.trim()) return;
              event.preventDefault();
              addSubtask();
            }}
          />
          <Button
            className="rounded-xl"
            onClick={addSubtask}
            disabled={!draft.trim() || pending}
          >
            Добавить
          </Button>
        </div>
      )}
    </div>
  );
}
