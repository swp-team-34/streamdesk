import { Plus } from "lucide-react";
import { KanbanCustomFieldEditor } from "@/components/kanban/kanban-custom-field-editor";
import type { KanbanCustomFieldFormState } from "@/components/kanban/kanban-custom-fields-section";
import {
  KANBAN_PANEL_INPUT_CLASS,
  KANBAN_PANEL_SELECT_CLASS,
} from "@/components/kanban/kanban-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  KanbanCustomFieldDefinition,
  KanbanCustomFieldType,
} from "@/lib/kanban-board-model";
import { CUSTOM_FIELD_TYPE_LABELS } from "@/lib/kanban-presentation";

interface UserOption {
  id: string;
  name: string;
}

interface KanbanCardCustomFieldsEditorProps {
  expanded: boolean;
  fields: KanbanCustomFieldDefinition[];
  values: Record<string, unknown>;
  users: UserOption[];
  canEdit: boolean;
  loading: boolean;
  form: KanbanCustomFieldFormState;
  savePending: boolean;
  onValuesChange: (values: Record<string, unknown>) => void;
  onFormChange: (form: KanbanCustomFieldFormState) => void;
  onSave: () => void;
}

export function KanbanCardCustomFieldsEditor({
  expanded,
  fields,
  values,
  users,
  canEdit,
  loading,
  form,
  savePending,
  onValuesChange,
  onFormChange,
  onSave,
}: KanbanCardCustomFieldsEditorProps) {
  return (
    <div className={expanded ? "space-y-3" : "hidden"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Поля карточки</h3>
          <p className="text-xs text-muted-foreground">Custom fields доски, как в Notion.</p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      {fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/30 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
          Полей пока нет. Создай первое поле здесь или в настройках доски.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`kanban-detail-custom-field-${field.id}`}>
                {field.name}{field.required ? " *" : ""}
              </label>
              <KanbanCustomFieldEditor
                field={field}
                value={values[field.id]}
                users={users}
                disabled={!canEdit}
                placeholder={CUSTOM_FIELD_TYPE_LABELS[field.type]}
                onChange={(value) => onValuesChange({ ...values, [field.id]: value })}
              />
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="grid gap-2 rounded-2xl border border-border/30 bg-muted/15 p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
          <Input
            aria-label="Новое поле карточки"
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            placeholder="Новое поле"
            className={KANBAN_PANEL_INPUT_CLASS}
            disabled={savePending}
          />
          <select
            aria-label="Тип нового поля карточки"
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
          <Button
            className="rounded-xl"
            onClick={onSave}
            disabled={!form.name.trim() || savePending}
          >
            <Plus className="mr-1 h-4 w-4" />
            Добавить
          </Button>
        </div>
      )}
    </div>
  );
}
