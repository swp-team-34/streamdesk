import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamColorPicker } from "@/components/ui/stream-color-picker";
import { LABEL_COLOR_PRESETS } from "@/components/kanban/kanban-labels-section";
import type { KanbanLabelGroupView, KanbanLabelView } from "@/lib/kanban-board-model";
import { formatPluralRu } from "@/lib/plural-ru";
import { KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

export interface KanbanLabelGroupFormState {
  name: string;
  color: string;
}

interface KanbanLabelGroupsSectionProps {
  groups: KanbanLabelGroupView[];
  labels: KanbanLabelView[];
  form: KanbanLabelGroupFormState;
  editingGroupId?: string | null;
  canEdit: boolean;
  loading: boolean;
  savePending: boolean;
  deletePending: boolean;
  onFormChange: (form: KanbanLabelGroupFormState) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onEdit: (group: KanbanLabelGroupView) => void;
  onDelete: (group: KanbanLabelGroupView) => void;
}

export function KanbanLabelGroupsSection({
  groups,
  labels,
  form,
  editingGroupId,
  canEdit,
  loading,
  savePending,
  deletePending,
  onFormChange,
  onCancelEdit,
  onSave,
  onEdit,
  onDelete,
}: KanbanLabelGroupsSectionProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Группы меток</h3>
          <p className="text-sm text-muted-foreground">Группируй теги по смыслу и фильтруй задачи по целой группе.</p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      {canEdit && (
        <div className="mt-4 grid gap-2 rounded-2xl border border-border/30 bg-muted/15 p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
          <Input
            aria-label="Название группы меток"
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            placeholder="Например: Production или Recording"
            className={KANBAN_PANEL_INPUT_CLASS}
            disabled={savePending}
          />
          <StreamColorPicker
            ariaLabel="Цвет группы меток"
            value={form.color}
            onChange={(color) => onFormChange({ ...form, color })}
            presets={LABEL_COLOR_PRESETS.map((preset) => ({ ...preset }))}
            className="h-10 sm:h-10"
            disabled={savePending}
          />
          <div className="flex gap-2">
            {editingGroupId && (
              <Button variant="ghost" className="rounded-xl" onClick={onCancelEdit}>
                Отмена
              </Button>
            )}
            <Button
              className="rounded-xl"
              onClick={onSave}
              disabled={!form.name.trim() || savePending}
            >
              {editingGroupId ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/30 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
            Групп меток пока нет.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/30 bg-muted/15 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color || "var(--primary)" }} />
                <div>
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPluralRu(
                      labels.filter((label) => label.groupId === group.id).length,
                      "метка",
                      "метки",
                      "меток",
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEdit(group)}>
                    Изменить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => onDelete(group)}
                    disabled={deletePending}
                  >
                    Архивировать
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
