export type KanbanListType = "active" | "closed" | "archive" | "trash";
export type KanbanCardPriority = "low" | "medium" | "high" | "urgent";
export type KanbanCustomFieldType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "multi-select"
  | "url"
  | "email"
  | "person";

export interface KanbanCustomFieldDefinition {
  id: string;
  name: string;
  type: KanbanCustomFieldType;
  options?: string[];
  required?: boolean;
  showOnCard?: boolean;
  showInList?: boolean;
  position?: number;
  archivedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface KanbanLabelGroupView {
  id: string;
  name: string;
  color?: string | null;
  archivedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface KanbanListView {
  id: string;
  boardId: string;
  type: KanbanListType;
  position: number;
  name: string;
  color?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface KanbanSubtask {
  id: string;
  title: string;
  completed?: boolean;
}

export interface KanbanCardView {
  id: string;
  boardId: string;
  projectId?: string | null;
  listId: string;
  title: string;
  description?: string | null;
  position: number;
  priority: KanbanCardPriority;
  startDate?: string | Date | null;
  startDateHasTime?: boolean;
  dueDate?: string | Date | null;
  dueDateHasTime?: boolean;
  locationId?: string | null;
  locationIds?: string[];
  locations?: Array<{ id: string; name: string; archivedAt?: string | Date | null }>;
  locationWarnings?: Array<{
    id: string;
    locationId: string;
    locationName: string;
    title: string;
    severity: string;
  }>;
  locationTopics?: Array<{
    id: string;
    locationId: string;
    locationName: string;
    title: string;
    type: "note" | "issue";
    severity?: string | null;
    status: "active" | "resolved" | "archived";
    updatedAt?: string | Date | null;
  }>;
  labelIds?: string[];
  subtasks?: KanbanSubtask[];
  customFieldValues?: Record<string, unknown>;
  creatorUserId: string;
  initiatorUserId?: string | null;
  responsibleUserId?: string | null;
  assigneeUserIds?: string[];
  assigneeUserId?: string | null;
  commentCount?: number;
  latestCommentAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface KanbanLabelView {
  id: string;
  boardId: string;
  name: string;
  color?: string | null;
  groupId?: string | null;
  archivedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface KanbanCardHistoryView {
  id: string;
  cardId: string;
  userId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt?: string | Date | null;
}

export interface KanbanCardAttachmentView {
  id: string;
  cardId: string;
  uploadedByUserId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface BoardCompletionSummary {
  total: number;
  completed: number;
  percent: number;
}

export interface KanbanCardMovement {
  cardId: string;
  targetListId: string;
  targetPosition: number;
}

export function normalizeLabelIds(labelIds?: string[] | null) {
  return Array.from(new Set((labelIds ?? []).map(String).filter(Boolean)));
}

export function normalizeLocationIds(locationIds?: string[] | null) {
  return Array.from(new Set((locationIds ?? []).map(String).filter(Boolean)));
}

export function getCardLocationIds(card?: KanbanCardView | null) {
  const linkedIds = normalizeLocationIds(card?.locationIds);
  if (linkedIds.length) return linkedIds;
  return card?.locationId ? [String(card.locationId)] : [];
}

export function getCompletionSummary(
  sourceCards: KanbanCardView[],
  listById: Map<string, KanbanListView>,
): BoardCompletionSummary {
  const total = sourceCards.length;
  const completed = sourceCards.filter((card) => {
    const list = listById.get(card.listId);
    return list?.type === "closed" || list?.type === "archive";
  }).length;

  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function normalizeCustomFieldDefinitions(
  fields?: KanbanCustomFieldDefinition[] | null,
) {
  return (Array.isArray(fields) ? fields : [])
    .filter((field) => field && !field.archivedAt && field.name)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
}

export function normalizeLabelGroups(groups?: KanbanLabelGroupView[] | null) {
  return (Array.isArray(groups) ? groups : [])
    .filter((group) => group && !group.archivedAt && group.name);
}

export function normalizeCustomFieldOptions(value: string) {
  return Array.from(new Set(value.split(",").map((option) => option.trim()).filter(Boolean)));
}

export function normalizeSubtasks(subtasks?: KanbanSubtask[] | null) {
  return Array.isArray(subtasks)
    ? subtasks
        .map((subtask) => ({
          id: String(subtask.id || "").trim(),
          title: String(subtask.title || "").trim(),
          completed: Boolean(subtask.completed),
        }))
        .filter((subtask) => subtask.id && subtask.title)
    : [];
}

export function getSubtaskProgress(subtasks?: KanbanSubtask[] | null) {
  const normalized = normalizeSubtasks(subtasks);
  const completed = normalized.filter((subtask) => subtask.completed).length;
  return { total: normalized.length, completed };
}

export function moveKanbanCards(
  cards: KanbanCardView[],
  movement: KanbanCardMovement,
) {
  const movingCard = cards.find((card) => card.id === movement.cardId);
  if (!movingCard) return cards;

  const sourceListId = String(movingCard.listId);
  const targetListId = String(movement.targetListId);
  const normalizedTargetPosition = Math.max(0, Number(movement.targetPosition || 0));

  if (sourceListId === targetListId) {
    const sameListCards = cards.filter(
      (card) => String(card.listId) === sourceListId && card.id !== movingCard.id,
    );
    const insertionIndex = Math.min(normalizedTargetPosition, sameListCards.length);
    sameListCards.splice(insertionIndex, 0, movingCard);

    const updatedSameListCards = sameListCards.map((card, index) => ({
      ...card,
      position: index,
    }));

    return [
      ...cards.filter((card) => String(card.listId) !== sourceListId),
      ...updatedSameListCards,
    ];
  }

  const sourceCards = cards.filter(
    (card) => String(card.listId) === sourceListId && card.id !== movingCard.id,
  );
  const targetCards = cards.filter(
    (card) => String(card.listId) === targetListId && card.id !== movingCard.id,
  );
  const insertionIndex = Math.min(normalizedTargetPosition, targetCards.length);

  targetCards.splice(insertionIndex, 0, {
    ...movingCard,
    listId: targetListId,
  });

  const updatedSourceCards = sourceCards.map((card, index) => ({
    ...card,
    position: index,
  }));
  const updatedTargetCards = targetCards.map((card, index) => ({
    ...card,
    listId: targetListId,
    position: index,
  }));

  return [
    ...cards.filter(
      (card) => String(card.listId) !== sourceListId && String(card.listId) !== targetListId,
    ),
    ...updatedSourceCards,
    ...updatedTargetCards,
  ];
}

export function reorderKanbanLists(lists: KanbanListView[], listIds: string[]) {
  const listMap = new Map(lists.map((list) => [String(list.id), list]));

  return listIds
    .map((listId, index) => {
      const list = listMap.get(String(listId));
      if (!list) return null;
      return {
        ...list,
        position: index,
      };
    })
    .filter((list): list is KanbanListView => Boolean(list));
}
