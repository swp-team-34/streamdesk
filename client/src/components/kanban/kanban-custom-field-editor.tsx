import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StreamDatePicker } from "@/components/ui/stream-date-picker";
import { StreamMultiSelect } from "@/components/ui/stream-multi-select";
import { StreamSelect } from "@/components/ui/stream-select";
import type { KanbanCustomFieldDefinition } from "@/lib/kanban-board-model";
import { KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

interface UserOption {
  id: string;
  name: string;
}

interface KanbanCustomFieldEditorProps {
  field: KanbanCustomFieldDefinition;
  value: unknown;
  users: UserOption[];
  disabled?: boolean;
  placeholder: string;
  onChange: (value: unknown) => void;
}

export function KanbanCustomFieldEditor({
  field,
  value,
  users,
  disabled,
  placeholder,
  onChange,
}: KanbanCustomFieldEditorProps) {
  const commonId = `kanban-detail-custom-field-${field.id}`;

  if (field.type === "checkbox") {
    return (
      <label
        htmlFor={commonId}
        className="flex min-h-10 items-center gap-2 rounded-control border border-border/50 bg-surface-raised px-3 py-2 text-sm transition-colors hover:bg-surface-overlay"
      >
        <Checkbox
          id={commonId}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
        />
        <span>{Boolean(value) ? "Да" : "Нет"}</span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <StreamSelect
        id={commonId}
        ariaLabel={field.name}
        value={String(value ?? "")}
        options={[
          { value: "", label: "Не выбрано" },
          ...(field.options ?? []).map((option) => ({ value: option, label: option })),
        ]}
        onValueChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (field.type === "multi-select") {
    const values = Array.isArray(value) ? value.map(String) : [];
    return (
      <StreamMultiSelect
        id={commonId}
        ariaLabel={field.name}
        title={field.name}
        values={values}
        options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
        placeholder={(field.options ?? []).length ? "Выбрать значения" : "Нет доступных вариантов"}
        emptyMessage="Добавь варианты в настройках доски"
        onValuesChange={onChange}
        disabled={disabled || (field.options ?? []).length === 0}
      />
    );
  }

  if (field.type === "person") {
    return (
      <StreamSelect
        id={commonId}
        ariaLabel={field.name}
        value={String(value ?? "")}
        options={[
          { value: "", label: "Не выбрано" },
          ...users.map((user) => ({ value: user.id, label: user.name })),
        ]}
        onValueChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (field.type === "date") {
    return (
      <StreamDatePicker
        id={commonId}
        value={String(value ?? "")}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  const inputType = field.type === "email"
      ? "email"
      : field.type === "url"
        ? "url"
        : "text";

  return (
    <Input
      id={commonId}
      type={inputType}
      inputMode={field.type === "number" ? "decimal" : undefined}
      value={String(value ?? "")}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (field.type === "number") {
          if (!/^-?\d*(?:[.,]\d*)?$/.test(nextValue)) return;
          onChange(nextValue.replace(",", "."));
          return;
        }
        onChange(nextValue);
      }}
      placeholder={placeholder}
      className={KANBAN_PANEL_INPUT_CLASS}
      disabled={disabled}
    />
  );
}
