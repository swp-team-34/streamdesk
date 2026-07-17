import { Plus } from "lucide-react";
import { KanbanCustomFieldEditor } from "@/components/kanban/kanban-custom-field-editor";
import type { KanbanCustomFieldFormState } from "@/components/kanban/kanban-custom-fields-section";
import {
  KANBAN_PANEL_INPUT_CLASS,
} from "@/components/kanban/kanban-styles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StreamSelect } from "@/components/ui/stream-select";
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
  const supportsOptions = form.type === "select" || form.type === "multi-select";
  const visibilityOptions = [
    { key: "required" as const, label: "Обязательное" },
    { key: "showOnCard" as const, label: "На карточке" },
    { key: "showInList" as const, label: "В списке" },
  ];

  return (
    <div className={expanded ? "space-y-4 border-t border-border/40 pt-4" : "hidden"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Поля карточки</h3>
          <p className="text-xs text-muted-foreground">Дополнительные данные этой задачи.</p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      {fields.length === 0 ? (
        <div className="rounded-control border border-dashed border-border/40 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
          Полей пока нет. Создай первое поле здесь или в настройках доски.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="min-w-0 space-y-2 rounded-control border border-border/35 bg-muted/15 p-3"
            >
              <label className="text-sm font-medium text-foreground" htmlFor={`kanban-detail-custom-field-${field.id}`}>
                {field.name}{field.required ? <span className="text-error"> *</span> : null}
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
        <div className="space-y-3 rounded-control border border-border/35 bg-muted/15 p-3">
          <div>
            <h4 className="text-sm font-medium">Добавить поле</h4>
            <p className="text-xs text-muted-foreground">Поле станет доступно на всех карточках этой доски.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              <span>Название</span>
              <Input
                aria-label="Новое поле карточки"
                value={form.name}
                onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                placeholder="Например, номер сцены"
                className={KANBAN_PANEL_INPUT_CLASS}
                disabled={savePending}
              />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              <span>Тип</span>
              <StreamSelect
                ariaLabel="Тип нового поля карточки"
                value={form.type}
                options={Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                onValueChange={(value) => onFormChange({
                  ...form,
                  type: value as KanbanCustomFieldType,
                })}
                className="h-10 sm:h-10"
                disabled={savePending}
              />
            </label>
            {supportsOptions && (
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
                <span>Варианты</span>
                <Input
                  aria-label="Опции нового поля карточки"
                  value={form.options}
                  onChange={(event) => onFormChange({ ...form, options: event.target.value })}
                  placeholder="Черновой, готово, согласовано"
                  className={KANBAN_PANEL_INPUT_CLASS}
                  disabled={savePending}
                />
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/35 pt-3">
            <div className="flex flex-wrap gap-2">
              {visibilityOptions.map((option) => {
                const id = `kanban-card-custom-field-${option.key}`;
                return (
                  <label
                    key={option.key}
                    htmlFor={id}
                    className="inline-flex min-h-9 items-center gap-2 rounded-control border border-border/35 bg-surface-raised px-2.5 text-xs"
                  >
                    <Checkbox
                      id={id}
                      checked={form[option.key]}
                      onCheckedChange={(checked) => onFormChange({
                        ...form,
                        [option.key]: checked === true,
                      })}
                      disabled={savePending}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            <Button
              className="h-10 rounded-control"
              onClick={onSave}
              disabled={!form.name.trim() || savePending}
            >
              <Plus className="mr-1 h-4 w-4" />
              Добавить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
