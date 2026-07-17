import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  KanbanCustomFieldDefinition,
  KanbanCustomFieldType,
} from "@/lib/kanban-board-model";
import { CUSTOM_FIELD_TYPE_LABELS } from "@/lib/kanban-presentation";
import {
  KANBAN_PANEL_INPUT_CLASS,
  KANBAN_PANEL_SELECT_CLASS,
} from "./kanban-styles";

export interface KanbanCustomFieldFormState {
  name: string;
  type: KanbanCustomFieldType;
  options: string;
  required: boolean;
  showOnCard: boolean;
  showInList: boolean;
}

interface KanbanCustomFieldsSectionProps {
  fields: KanbanCustomFieldDefinition[];
  form: KanbanCustomFieldFormState;
  editingFieldId?: string | null;
  canEdit: boolean;
  loading: boolean;
  savePending: boolean;
  deletePending: boolean;
  onFormChange: (form: KanbanCustomFieldFormState) => void;
  onCancelEdit: () => void;
  onCreateDefaults: () => void;
  onSave: () => void;
  onEdit: (field: KanbanCustomFieldDefinition) => void;
  onDelete: (field: KanbanCustomFieldDefinition) => void;
}

export function KanbanCustomFieldsSection({
  fields,
  form,
  editingFieldId,
  canEdit,
  loading,
  savePending,
  deletePending,
  onFormChange,
  onCancelEdit,
  onCreateDefaults,
  onSave,
  onEdit,
  onDelete,
}: KanbanCustomFieldsSectionProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Поля карточек</h3>
          <p className="text-sm text-muted-foreground">Создавай поля доски: текст, дата, checkbox, select, person и другие.</p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      {canEdit && (
        <div className="mt-4 space-y-3 rounded-2xl border border-border/30 bg-muted/15 p-3">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)]">
            <Input
              aria-label="Название поля"
              value={form.name}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              placeholder="Название поля"
              className={KANBAN_PANEL_INPUT_CLASS}
              disabled={savePending}
            />
            <select
              aria-label="Тип поля"
              className={KANBAN_PANEL_SELECT_CLASS}
              value={form.type}
              onChange={(event) => onFormChange({
                ...form,
                type: event.target.value as KanbanCustomFieldType,
              })}
              disabled={savePending}
            >
              {Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Input
              aria-label="Опции поля"
              value={form.options}
              onChange={(event) => onFormChange({ ...form, options: event.target.value })}
              placeholder="Опции через запятую"
              className={KANBAN_PANEL_INPUT_CLASS}
              disabled={savePending || !["select", "multi-select"].includes(form.type)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(event) => onFormChange({ ...form, required: event.target.checked })}
                />
                Required
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.showOnCard}
                  onChange={(event) => onFormChange({ ...form, showOnCard: event.target.checked })}
                />
                На карточке
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.showInList}
                  onChange={(event) => onFormChange({ ...form, showInList: event.target.checked })}
                />
                В списке
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {editingFieldId && (
                <Button variant="ghost" className="rounded-xl" onClick={onCancelEdit}>
                  Отмена
                </Button>
              )}
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={onCreateDefaults}
                disabled={savePending}
              >
                File/Recording шаблон
              </Button>
              <Button
                className="rounded-xl"
                onClick={onSave}
                disabled={!form.name.trim() || savePending}
              >
                {editingFieldId ? "Сохранить" : "Добавить поле"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {fields.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/30 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
            Полей пока нет.
          </div>
        ) : (
          fields.map((field) => (
            <div key={field.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/30 bg-muted/15 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">{field.name}</div>
                <div className="text-xs text-muted-foreground">
                  {CUSTOM_FIELD_TYPE_LABELS[field.type]} · {field.showOnCard !== false ? "card" : "hidden card"} · {field.showInList !== false ? "list" : "hidden list"}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEdit(field)}>
                    Изменить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => onDelete(field)}
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
