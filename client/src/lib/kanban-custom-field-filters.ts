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
      return "Можно выбрать несколько вариантов. Карточка попадёт в результат, если содержит хотя бы один из них.";
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
  rawFilter: string | string[],
  formattedValue: string,
): boolean => {
  const filters = (Array.isArray(rawFilter) ? rawFilter : [rawFilter])
    .map((value) => value.trim())
    .filter(Boolean);
  if (filters.length === 0) return true;
  if (filters.includes(KANBAN_EMPTY_FIELD_FILTER) && isKanbanCustomFieldValueEmpty(rawValue)) return true;
  const nonEmptyFilters = filters.filter((filter) => filter !== KANBAN_EMPTY_FIELD_FILTER);
  if (nonEmptyFilters.length === 0) return false;

  if (field.type === "checkbox") {
    return nonEmptyFilters.some((filter) =>
      filter === "true" ? rawValue === true : filter === "false" ? rawValue === false : false,
    );
  }

  if (field.type === "select") return nonEmptyFilters.includes(String(rawValue ?? ""));
  if (field.type === "multi-select") {
    const values = Array.isArray(rawValue) ? rawValue.map(String) : [];
    return nonEmptyFilters.some((filter) => values.includes(filter));
  }
  if (field.type === "date" || field.type === "number") {
    return nonEmptyFilters.some((filter) => {
      const normalizedFilter = filter.toLocaleLowerCase("ru");
      return String(rawValue ?? "").toLocaleLowerCase("ru").includes(normalizedFilter) ||
        formattedValue.toLocaleLowerCase("ru").includes(normalizedFilter);
    });
  }

  return nonEmptyFilters.some((filter) =>
    formattedValue.toLocaleLowerCase("ru").includes(filter.toLocaleLowerCase("ru")),
  );
};
