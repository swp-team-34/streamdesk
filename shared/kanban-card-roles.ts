export interface KanbanCardRoleFields {
  assigneeUserId?: string | null;
  assigneeUserIds?: unknown;
  responsibleUserId?: string | null;
  initiatorUserId?: string | null;
  creatorUserId?: string | null;
}

export const normalizeKanbanUserIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((userId) => String(userId || "").trim()).filter(Boolean)),
  );
};

export const getKanbanCardAssigneeUserIds = (card: KanbanCardRoleFields): string[] => {
  const normalized = normalizeKanbanUserIds(card.assigneeUserIds);
  if (normalized.length > 0) return normalized;

  const legacyAssigneeUserId = String(card.assigneeUserId || "").trim();
  return legacyAssigneeUserId ? [legacyAssigneeUserId] : [];
};

export const getKanbanCardInitiatorUserId = (card: KanbanCardRoleFields): string | null => {
  const initiatorUserId = String(card.initiatorUserId || "").trim();
  if (initiatorUserId) return initiatorUserId;

  const creatorUserId = String(card.creatorUserId || "").trim();
  return creatorUserId || null;
};

export const getKanbanCardWorkloadUserIds = (card: KanbanCardRoleFields): string[] => {
  const responsibleUserId = String(card.responsibleUserId || "").trim();
  return Array.from(new Set([
    ...getKanbanCardAssigneeUserIds(card),
    ...(responsibleUserId ? [responsibleUserId] : []),
  ]));
};
