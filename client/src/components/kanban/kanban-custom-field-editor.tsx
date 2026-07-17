import { Input } from "@/components/ui/input";
import type { KanbanCustomFieldDefinition } from "@/lib/kanban-board-model";
import {
  KANBAN_PANEL_INPUT_CLASS,
  KANBAN_PANEL_SELECT_CLASS,
} from "./kanban-styles";

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
      <label className="flex items-center gap-2 rounded-xl border border-border/30 bg-background px-3 py-2 text-sm">
        <input
          id={commonId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        {field.name}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={commonId}
        className={KANBAN_PANEL_SELECT_CLASS}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Не выбрано</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (field.type === "multi-select") {
    const values = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((option) => {
          const selected = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={[
                "rounded-full border px-3 py-1 text-sm transition",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/35 bg-background text-muted-foreground hover:bg-muted/50",
              ].join(" ")}
              onClick={() => onChange(
                selected ? values.filter((item) => item !== option) : [...values, option],
              )}
              disabled={disabled}
            >
              {option}
            </button>
          );
        })}
        {(field.options ?? []).length === 0 && (
          <span className="text-sm text-muted-foreground">Добавь варианты в настройках доски.</span>
        )}
      </div>
    );
  }

  if (field.type === "person") {
    return (
      <select
        id={commonId}
        className={KANBAN_PANEL_SELECT_CLASS}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Не выбрано</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{user.name}</option>
        ))}
      </select>
    );
  }

  const inputType = field.type === "number"
    ? "number"
    : field.type === "date"
      ? "date"
      : field.type === "email"
        ? "email"
        : field.type === "url"
          ? "url"
          : "text";

  return (
    <Input
      id={commonId}
      type={inputType}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={KANBAN_PANEL_INPUT_CLASS}
      disabled={disabled}
    />
  );
}
