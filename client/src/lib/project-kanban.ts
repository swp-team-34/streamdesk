type EntityWithId = {
  id: string;
};

export function upsertProjectKanbanBoard<T extends EntityWithId>(
  current: T[] | undefined,
  board: T,
) {
  const items = Array.isArray(current) ? current : [];
  const index = items.findIndex((item) => item.id === board.id);
  if (index === -1) return [board, ...items];
  return items.map((item) => item.id === board.id ? { ...item, ...board } : item);
}

export function updateOpenedProject<T extends EntityWithId>(
  current: T[] | undefined,
  project: T,
) {
  const items = Array.isArray(current) ? current : [];
  return items.map((item) => item.id === project.id ? { ...item, ...project } : item);
}
