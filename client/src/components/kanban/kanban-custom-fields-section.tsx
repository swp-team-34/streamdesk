import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StreamSelect } from "@/components/ui/stream-select";
import type {
  KanbanCustomFieldDefinition,
  KanbanCustomFieldType,
} from "@/lib/kanban-board-model";
import { CUSTOM_FIELD_TYPE_LABELS } from "@/lib/kanban-presentation";
import {
  KANBAN_PANEL_INPUT_CLASS,
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
  const supportsOptions = form.type === "select" || form.type === "multi-select";
  const visibilityOptions = [
    { key: "required" as const, label: "Обязательное" },
    { key: "showOnCard" as const, label: "Показывать на карточке" },
    { key: "showInList" as const, label: "Показывать в списке" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Поля карточек</h3>
          <p className="text-sm text-muted-foreground">Настрой дополнительные данные для всех карточек доски.</p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      {canEdit && (
        <div className="mt-4 space-y-4 rounded-control border border-border/40 bg-muted/15 p-4">
          <div>
            <h4 className="text-sm font-medium">{editingFieldId ? "Редактирование поля" : "Новое поле"}</h4>
            <p className="text-xs text-muted-foreground">Название, тип и правила отображения сохраняются для всей доски.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              <span>Название</span>
              <Input
                aria-label="Название поля"
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
                ariaLabel="Тип поля"
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
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground md:col-span-2">
                <span>Варианты</span>
                <Input
                  aria-label="Опции поля"
                  value={form.options}
                  onChange={(event) => onFormChange({ ...form, options: event.target.value })}
                  placeholder="Черновой, готово, согласовано"
                  className={KANBAN_PANEL_INPUT_CLASS}
                  disabled={savePending}
                />
              </label>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {visibilityOptions.map((option) => {
              const id = `kanban-custom-field-setting-${option.key}`;
              return (
                <label
                  key={option.key}
                  htmlFor={id}
                  className="flex min-h-10 items-center gap-2 rounded-control border border-border/35 bg-surface-raised px-3 text-sm"
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/35 pt-3">
            <Button
              variant="outline"
              className="h-10 rounded-control"
              onClick={onCreateDefaults}
              disabled={savePending}
            >
              Шаблон File / Recording
            </Button>
            <div className="flex flex-wrap gap-2">
              {editingFieldId && (
                <Button variant="ghost" className="h-10 rounded-control" onClick={onCancelEdit}>
                  Отмена
                </Button>
              )}
              <Button
                className="h-10 rounded-control"
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
          <div className="rounded-control border border-dashed border-border/40 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
            Полей пока нет.
          </div>
        ) : (
          fields.map((field) => (
            <div key={field.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border/35 bg-muted/15 px-4 py-3">
              <div className="min-w-0 space-y-1.5">
                <div className="font-medium">{field.name}</div>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/35 bg-surface-raised px-2 py-0.5">
                    {CUSTOM_FIELD_TYPE_LABELS[field.type]}
                  </span>
                  {field.required && (
                    <span className="rounded-full border border-border/35 bg-surface-raised px-2 py-0.5">Обязательное</span>
                  )}
                  <span className="rounded-full border border-border/35 bg-surface-raised px-2 py-0.5">
                    {field.showOnCard !== false ? "На карточке" : "Скрыто на карточке"}
                  </span>
                  <span className="rounded-full border border-border/35 bg-surface-raised px-2 py-0.5">
                    {field.showInList !== false ? "В списке" : "Скрыто в списке"}
                  </span>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="rounded-control" onClick={() => onEdit(field)}>
                    Изменить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-control text-error hover:bg-error/10 hover:text-error"
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
