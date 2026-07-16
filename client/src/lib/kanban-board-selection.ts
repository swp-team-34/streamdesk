const BOARD_SELECTION_STORAGE_PREFIX = "streamdesk.tasks.v2.selectedBoard";

export function getKanbanBoardSelectionStorageKey(input: {
  userId?: string | null;
  workspaceType?: string | null;
  companyId?: string | null;
}) {
  const userId = String(input.userId || "").trim();
  const workspaceType = String(input.workspaceType || "").trim();
  if (!userId || !workspaceType) return null;
  const workspaceId = workspaceType === "company"
    ? String(input.companyId || "").trim()
    : "personal";
  if (!workspaceId) return null;
  return `${BOARD_SELECTION_STORAGE_PREFIX}:${userId}:${workspaceType}:${workspaceId}`;
}

export function resolveKanbanBoardSelection(input: {
  boardIds: string[];
  requestedBoardId?: string | null;
  currentBoardId?: string | null;
  storedBoardId?: string | null;
}) {
  const availableIds = new Set(input.boardIds.map(String));
  return [
    input.requestedBoardId,
    input.currentBoardId,
    input.storedBoardId,
    input.boardIds[0],
  ]
    .map((boardId) => String(boardId || "").trim())
    .find((boardId) => boardId && availableIds.has(boardId)) || null;
}
