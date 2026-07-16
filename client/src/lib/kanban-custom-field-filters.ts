export const KANBAN_EMPTY_FIELD_FILTER = "__kanban_empty__";

export type KanbanFilterFieldType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "multi-select"
  | "url"
  | "email"
  | "person";

export interface KanbanFilterField {
  type: KanbanFilterFieldType;
  options?: string[];
}

export const getKanbanCustomFieldFilterHelp = (field: KanbanFilterField): string => {
  switch (field.type) {
    case "select":
      return "Выберите один вариант или «Без значения».";
    case "multi-select":
      return "Показывает карточки, содержащие выбранный вариант. Можно выбрать «Без значения».";
    case "checkbox":
      return "Выберите «Да», «Нет» или «Без значения».";
    case "number":
      return "Введите число целиком или его часть. Пустые значения доступны отдельным вариантом.";
    case "date":
      return "Введите дату в формате ГГГГ-ММ-ДД или выберите карточки без значения.";
    case "person":
      return "Введите имя участника или выберите карточки без значения.";
    default:
      return "Поиск без учёта регистра по части значения. Пустые значения доступны отдельным вариантом.";
  }
};

export const isKanbanCustomFieldValueEmpty = (value: unknown): boolean =>
  value == null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

export const matchesKanbanCustomFieldFilter = (
  field: KanbanFilterField,
  rawValue: unknown,
  rawFilter: string,
  formattedValue: string,
): boolean => {
  const filter = rawFilter.trim();
  if (!filter) return true;
  if (filter === KANBAN_EMPTY_FIELD_FILTER) return isKanbanCustomFieldValueEmpty(rawValue);

  if (field.type === "checkbox") {
    if (filter === "true") return rawValue === true;
    if (filter === "false") return rawValue === false;
  }

  if (field.type === "select") return String(rawValue ?? "") === filter;
  if (field.type === "multi-select") {
    return Array.isArray(rawValue) && rawValue.map(String).includes(filter);
  }
  if (field.type === "date" || field.type === "number") {
    const normalizedFilter = filter.toLocaleLowerCase("ru");
    return String(rawValue ?? "").toLocaleLowerCase("ru").includes(normalizedFilter) ||
      formattedValue.toLocaleLowerCase("ru").includes(normalizedFilter);
  }

  return formattedValue.toLocaleLowerCase("ru").includes(filter.toLocaleLowerCase("ru"));
};
