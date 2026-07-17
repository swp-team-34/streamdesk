import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamColorPicker } from "@/components/ui/stream-color-picker";
import { StreamSelect } from "@/components/ui/stream-select";
import type { KanbanLabelGroupView, KanbanLabelView } from "@/lib/kanban-board-model";
import { KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

export const LABEL_COLOR_PRESETS = [
  { label: "Sky", value: "#0ea5e9" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Fuchsia", value: "#d946ef" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Slate", value: "#64748b" },
] as const;

interface KanbanLabelsSectionProps {
  labels: KanbanLabelView[];
  groups: KanbanLabelGroupView[];
  loading: boolean;
  canEdit: boolean;
  draft: string;
  editingLabelId?: string | null;
  editingLabelName: string;
  savePending: boolean;
  deletePending: boolean;
  onDraftChange: (value: string) => void;
  onCreate: () => void;
  onEditingLabelNameChange: (value: string) => void;
  onBeginEdit: (label: KanbanLabelView) => void;
  onCancelEdit: () => void;
  onCommitEdit: (label: KanbanLabelView) => void;
  onGroupChange: (label: KanbanLabelView, groupId: string | null) => void;
  onColorChange: (label: KanbanLabelView, color: string) => void;
  onDelete: (label: KanbanLabelView) => void;
}

export function KanbanLabelsSection({
  labels,
  groups,
  loading,
  canEdit,
  draft,
  editingLabelId,
  editingLabelName,
  savePending,
  deletePending,
  onDraftChange,
  onCreate,
  onEditingLabelNameChange,
  onBeginEdit,
  onCancelEdit,
  onCommitEdit,
  onGroupChange,
  onColorChange,
  onDelete,
}: KanbanLabelsSectionProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Метки доски</h3>
          <p className="text-sm text-muted-foreground">
            Новые метки создаются прямо в карточке. Здесь можно поменять цвет через палитру или удалить метку.
          </p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-surface border border-border/50 bg-surface-subtle p-3">
          <Input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Название новой метки"
            className={`${KANBAN_PANEL_INPUT_CLASS} min-w-[220px] flex-1`}
            disabled={savePending}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onCreate();
            }}
          />
          <Button className="rounded-control" onClick={onCreate} disabled={!draft.trim() || savePending}>
            <Plus className="mr-1 h-4 w-4" />
            Добавить метку
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {labels.length === 0 ? (
          <div className="rounded-surface border border-dashed border-border/50 bg-surface-subtle px-4 py-5 text-sm text-muted-foreground">
            Меток пока нет. Создай первую из detail modal карточки.
          </div>
        ) : (
          labels.map((label) => (
            <div key={label.id} className="rounded-surface border border-border/50 bg-surface-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {editingLabelId === label.id ? (
                  <Input
                    aria-label={`Название метки ${label.name}`}
                    value={editingLabelName}
                    onChange={(event) => onEditingLabelNameChange(event.target.value)}
                    autoFocus
                    className={`${KANBAN_PANEL_INPUT_CLASS} max-w-[260px]`}
                    disabled={savePending}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        onCancelEdit();
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onCommitEdit(label);
                      }
                    }}
                    onBlur={() => onCommitEdit(label)}
                  />
                ) : (
                  <Badge
                    variant="outline"
                    className="cursor-text rounded-full border-transparent px-3 py-1.5"
                    style={{ backgroundColor: label.color || "var(--muted)", color: "var(--foreground)" }}
                    onDoubleClick={() => onBeginEdit(label)}
                  >
                    {label.name}
                  </Badge>
                )}
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-control"
                      onClick={() => onBeginEdit(label)}
                      disabled={savePending}
                      title="Переименовать"
                      aria-label={`Переименовать ${label.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-control text-error hover:bg-error-muted hover:text-error"
                      onClick={() => onDelete(label)}
                      disabled={deletePending}
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="mt-3 space-y-3">
                  <StreamSelect
                    ariaLabel={`Группа метки ${label.name}`}
                    className="max-w-[260px]"
                    value={label.groupId || ""}
                    options={[
                      { value: "", label: "Без группы" },
                      ...groups.map((group) => ({ value: group.id, label: group.name })),
                    ]}
                    onValueChange={(groupId) => onGroupChange(label, groupId || null)}
                    disabled={savePending}
                  />
                  <StreamColorPicker
                    value={label.color || LABEL_COLOR_PRESETS[0].value}
                    onChange={(color) => onColorChange(label, color)}
                    ariaLabel={`Цвет метки ${label.name}`}
                    presets={[...LABEL_COLOR_PRESETS]}
                    disabled={savePending}
                    className="max-w-[260px]"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
