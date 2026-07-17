import { getKanbanCardAssigneeUserIds } from "@shared/kanban-card-roles";
import {
  normalizeLabelIds,
  normalizeLocationIds,
  type KanbanCardPriority,
} from "@/lib/kanban-board-model";

export interface KanbanCardDetailForm {
  listId: string;
  title: string;
  description: string;
  priority: KanbanCardPriority;
  startDate: string;
  startDateHasTime: boolean;
  dueDate: string;
  dueDateHasTime: boolean;
  locationId: string;
  locationIds: string[];
  initiatorUserId: string;
  responsibleUserId: string;
  assigneeUserIds: string[];
  assigneeUserId: string;
  labelIds: string[];
  customFieldValues: Record<string, unknown>;
}

export function serializeCardForm(form: KanbanCardDetailForm) {
  return JSON.stringify({
    listId: form.listId,
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    startDate: form.startDate || "",
    startDateHasTime: form.startDateHasTime,
    dueDate: form.dueDate || "",
    dueDateHasTime: form.dueDateHasTime,
    locationIds: normalizeLocationIds(form.locationIds).sort(),
    initiatorUserId: form.initiatorUserId || "",
    responsibleUserId: form.responsibleUserId || "",
    assigneeUserIds: getKanbanCardAssigneeUserIds(form).sort(),
    assigneeUserId: form.assigneeUserId || "",
    labelIds: normalizeLabelIds(form.labelIds).sort(),
    customFieldValues: form.customFieldValues ?? {},
  });
}
