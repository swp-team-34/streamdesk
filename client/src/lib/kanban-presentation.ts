import { formatDueDateLabel } from "@/lib/task-dates";
import type {
  KanbanCardPriority,
  KanbanCustomFieldDefinition,
  KanbanCustomFieldType,
  KanbanListType,
} from "@/lib/kanban-board-model";

export const LIST_TYPE_LABELS: Record<KanbanListType, string> = {
  active: "Активный",
  closed: "Закрытый",
  archive: "Архив",
  trash: "Корзина",
};

export const CARD_PRIORITY_LABELS: Record<KanbanCardPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

export const CUSTOM_FIELD_TYPE_LABELS: Record<KanbanCustomFieldType, string> = {
  text: "Текст",
  number: "Число",
  date: "Дата",
  checkbox: "Чекбокс",
  select: "Select",
  "multi-select": "Multi-select",
  url: "URL",
  email: "Email",
  person: "Исполнитель",
};

export const CARD_PRIORITY_BADGE_VARIANTS: Record<
  KanbanCardPriority,
  "outline" | "secondary" | "default" | "destructive"
> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

export type EquipmentWorkflowStatus =
  | "linked"
  | "requested"
  | "approved"
  | "issued"
  | "returned"
  | "rejected"
  | "overdue"
  | "cancelled";

export function toSoftColor(value?: string | null, alpha = 0.12) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  const percent = Math.min(100, Math.max(0, Math.round(alpha * 100)));

  const shortHexMatch = normalized.match(/^#([\da-fA-F]{3})$/);
  if (shortHexMatch) {
    const hex = shortHexMatch[1].split("").map((part) => part + part).join("");
    return `color-mix(in srgb, #${hex} ${percent}%, var(--card))`;
  }

  const fullHexMatch = normalized.match(/^#([\da-fA-F]{6})$/);
  if (fullHexMatch) {
    return `color-mix(in srgb, #${fullHexMatch[1]} ${percent}%, var(--card))`;
  }

  return undefined;
}

export function getKanbanHistoryActionLabel(action: string) {
  switch (action) {
    case "created":
      return "Создал карточку";
    case "updated":
      return "Обновил карточку";
    case "moved":
      return "Переместил карточку";
    case "labels_updated":
      return "Обновил метки карточки";
    case "roles_updated":
      return "Обновил роли карточки";
    case "commented":
      return "Добавил комментарий";
    case "attachment_added":
      return "Добавил вложение";
    default:
      return action || "Изменил карточку";
  }
}

export function formatCustomFieldValue(
  field: KanbanCustomFieldDefinition,
  value: unknown,
  userById?: ReadonlyMap<string, { name: string }>,
) {
  if (value === undefined || value === null || value === "") return "";
  if (field.type === "checkbox") return value ? "Да" : "Нет";
  if (field.type === "multi-select") {
    return Array.isArray(value) ? value.map(String).filter(Boolean).join(", ") : String(value);
  }
  if (field.type === "person") {
    const user = userById?.get(String(value));
    return user?.name || String(value);
  }
  if (field.type === "date") return formatDueDateLabel(value as string | Date | null) || String(value);
  return String(value);
}

export function formatFileSize(value?: number | null) {
  if (!value || value < 0) return "Неизвестный размер";
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

export function getEquipmentWorkflowStatusLabel(
  status: EquipmentWorkflowStatus | string | null | undefined,
) {
  switch (status) {
    case "linked": return "Прикреплено";
    case "requested": return "Запрошено";
    case "approved": return "Подтверждено";
    case "issued": return "Выдано";
    case "returned": return "Возвращено";
    case "rejected": return "Отклонено";
    case "overdue": return "Просрочено";
    case "cancelled": return "Отменено";
    default: return status || "Связано";
  }
}

export function getEquipmentWorkflowStatusVariant(
  status: EquipmentWorkflowStatus | string | null | undefined,
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "approved" || status === "issued") return "default";
  if (status === "rejected" || status === "cancelled" || status === "overdue") return "destructive";
  if (status === "returned") return "secondary";
  return "outline";
}
