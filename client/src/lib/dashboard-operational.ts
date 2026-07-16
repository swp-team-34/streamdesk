const COMPLETE_LIST_TYPES = new Set(["closed", "archive", "trash"]);
const COMPLETE_PROJECT_STATUSES = new Set(["completed", "done", "archived", "cancelled"]);
const BLOCKED_PROJECT_STATUSES = new Set(["blocked", "on_hold", "paused"]);

function getTime(value: unknown) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value as string | Date).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function getReturnTime(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = new Date(`${value}T23:59:59.999+03:00`).getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
  }
  return getTime(value);
}

export function isActiveKanbanCard(card: any) {
  return !COMPLETE_LIST_TYPES.has(String(card?.listType || ""));
}

export function isOverdueKanbanCard(card: any, now = new Date()) {
  return isActiveKanbanCard(card) && getTime(card?.dueDate) < now.getTime();
}

export function buildActiveProjectRows(projects: any[], cards: any[], now = new Date(), limit = 5) {
  return projects
    .filter((project) => !COMPLETE_PROJECT_STATUSES.has(String(project?.status || "")))
    .map((project) => {
      const projectCards = cards.filter((card) =>
        String(card?.projectId || card?.boardProjectId || "") === String(project.id),
      );
      const completed = projectCards.filter((card) => !isActiveKanbanCard(card)).length;
      const overdue = projectCards.filter((card) => isOverdueKanbanCard(card, now)).length;
      const blocked = BLOCKED_PROJECT_STATUSES.has(String(project?.status || ""));
      const deadlineOverdue =
        Number.isFinite(getTime(project?.deadline)) &&
        getTime(project.deadline) < now.getTime();
      return {
        id: String(project.id),
        name: String(project.name || "Проект"),
        status: String(project.status || "planning"),
        total: projectCards.length,
        completed,
        percent: Math.round((completed / Math.max(projectCards.length, 1)) * 100),
        overdue,
        blocked,
        atRisk: blocked || deadlineOverdue || overdue > 0,
      };
    })
    .sort((left, right) =>
      Number(right.atRisk) - Number(left.atRisk) ||
      right.overdue - left.overdue ||
      left.name.localeCompare(right.name, "ru"),
    )
    .slice(0, limit);
}

export function buildUnassignedTaskRows(cards: any[], limit = 5) {
  return cards
    .filter((card) => isActiveKanbanCard(card) && !card?.assigneeUserId)
    .sort((left, right) =>
      getTime(left?.dueDate) - getTime(right?.dueDate) ||
      getTime(left?.createdAt) - getTime(right?.createdAt),
    )
    .slice(0, limit)
    .map((card) => ({
      id: String(card.id),
      boardId: String(card.boardId || ""),
      title: String(card.title || "Карточка"),
      boardName: String(card.boardName || "Доска"),
      dueDate: card.dueDate || null,
    }));
}

export function buildTeamWorkloadRows(cards: any[], users: any[], now = new Date(), limit = 6) {
  const userById = new Map(users.map((user) => [String(user.id), user]));
  const summaries = new Map<string, {
    userId: string;
    name: string;
    active: number;
    overdue: number;
  }>();

  for (const card of cards) {
    if (!isActiveKanbanCard(card) || !card?.assigneeUserId) continue;
    const userId = String(card.assigneeUserId);
    const user = userById.get(userId);
    const summary = summaries.get(userId) ?? {
      userId,
      name: String(user?.name || user?.username || userId),
      active: 0,
      overdue: 0,
    };
    summary.active += 1;
    if (isOverdueKanbanCard(card, now)) summary.overdue += 1;
    summaries.set(userId, summary);
  }

  return Array.from(summaries.values())
    .sort((left, right) =>
      right.overdue - left.overdue ||
      right.active - left.active ||
      left.name.localeCompare(right.name, "ru"),
    )
    .slice(0, limit);
}

export function buildEquipmentForTaskRows(
  cards: any[],
  equipmentLinksByCard: Record<string, any[]>,
  options: { scope: "mine" | "team"; userId?: string; limit?: number },
) {
  const limit = options.limit ?? 5;
  const activeCards = cards.filter((card) =>
    isActiveKanbanCard(card) &&
    (options.scope === "team" || String(card?.assigneeUserId || "") === String(options.userId || "")),
  );
  const rows: Array<{
    id: string;
    cardId: string;
    boardId: string;
    cardTitle: string;
    equipmentId: string;
    equipmentName: string;
    workflowStatus: string;
  }> = [];
  const seen = new Set<string>();

  for (const card of activeCards) {
    for (const link of equipmentLinksByCard[String(card.id)] ?? []) {
      const equipmentId = String(link?.equipment?.id || "");
      if (!equipmentId || link?.active === false) continue;
      const key = `${card.id}:${equipmentId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: key,
        cardId: String(card.id),
        boardId: String(card.boardId || ""),
        cardTitle: String(card.title || "Карточка"),
        equipmentId,
        equipmentName: String(link?.equipment?.name || "Оборудование"),
        workflowStatus: String(link?.workflowStatus || link?.equipment?.status || "linked"),
      });
    }
  }
  return rows.slice(0, limit);
}

export function buildUpcomingReturnRows(
  assignments: any[],
  equipment: any[],
  now = new Date(),
  limit = 5,
) {
  const equipmentById = new Map(equipment.map((item) => [String(item.id), item]));
  return assignments
    .filter((assignment) =>
      (!Array.isArray(assignment?.sources) || assignment.sources.includes("project-bundle")) &&
      Number.isFinite(getReturnTime(assignment?.returnDate)),
    )
    .map((assignment) => {
      const returnTime = getReturnTime(assignment.returnDate);
      const item = equipmentById.get(String(assignment.equipmentId));
      return {
        id: `${assignment.equipmentId}:${assignment.projectId}`,
        equipmentId: String(assignment.equipmentId),
        equipmentName: String(item?.name || "Оборудование"),
        projectId: String(assignment.projectId || ""),
        projectName: String(assignment.projectName || "Проект"),
        returnDate: assignment.returnDate,
        returnTime,
        overdue: returnTime < now.getTime(),
      };
    })
    .sort((left, right) =>
      Number(right.overdue) - Number(left.overdue) ||
      left.returnTime - right.returnTime,
    )
    .slice(0, limit);
}
