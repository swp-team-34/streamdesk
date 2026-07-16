export const DASHBOARD_GRID_COLUMNS = 12;

export type DashboardWidgetSize = "compact" | "normal" | "wide" | "full";

export interface DashboardWidgetPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidgetConstraints {
  defaultW: number;
  defaultH: number;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
}

export interface DashboardLayoutState {
  version: 2;
  order: string[];
  hidden: string[];
  items: Record<string, DashboardWidgetPlacement>;
}

export type DashboardSavedLayout =
  | string[]
  | (Partial<DashboardLayoutState> & {
      sizes?: Record<string, DashboardWidgetSize | string | undefined>;
    })
  | null
  | undefined;

const LEGACY_SIZE_WIDTHS: Record<DashboardWidgetSize, number> = {
  compact: 4,
  normal: 6,
  wide: 8,
  full: 12,
};

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}

function uniqueKnownIds(values: string[], knownIds: string[]) {
  const known = new Set(knownIds);
  return values.filter((id, index) => known.has(id) && values.indexOf(id) === index);
}

function placementOverlaps(left: DashboardWidgetPlacement, right: DashboardWidgetPlacement) {
  return (
    left.x < right.x + right.w &&
    left.x + left.w > right.x &&
    left.y < right.y + right.h &&
    left.y + left.h > right.y
  );
}

function normalizeConstraints(
  value: DashboardWidgetConstraints | undefined,
  columns = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetConstraints {
  const minW = clamp(value?.minW ?? 3, 1, columns);
  const maxW = clamp(value?.maxW ?? columns, minW, columns);
  const minH = Math.max(1, Math.round(value?.minH ?? 8));
  const maxH = Math.max(minH, Math.round(value?.maxH ?? 32));
  return {
    defaultW: clamp(value?.defaultW ?? 6, minW, maxW),
    defaultH: clamp(value?.defaultH ?? 14, minH, maxH),
    minW,
    maxW,
    minH,
    maxH,
  };
}

function normalizePlacement(
  value: Partial<DashboardWidgetPlacement> | null | undefined,
  constraints: DashboardWidgetConstraints,
  columns = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetPlacement {
  const w = clamp(Number(value?.w ?? constraints.defaultW), constraints.minW, Math.min(constraints.maxW, columns));
  const h = clamp(Number(value?.h ?? constraints.defaultH), constraints.minH, constraints.maxH);
  return {
    x: clamp(Number(value?.x ?? 0), 0, Math.max(columns - w, 0)),
    y: Math.max(0, clamp(Number(value?.y ?? 0), 0, Number.MAX_SAFE_INTEGER)),
    w,
    h,
  };
}

function findFirstAvailablePlacement(
  dimensions: Pick<DashboardWidgetPlacement, "w" | "h">,
  occupied: DashboardWidgetPlacement[],
  columns = DASHBOARD_GRID_COLUMNS,
  startY = 0,
) {
  const maxX = Math.max(columns - dimensions.w, 0);
  for (let y = Math.max(0, Math.round(startY)); y < 10_000; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const candidate = { x, y, w: dimensions.w, h: dimensions.h };
      if (!occupied.some((item) => placementOverlaps(candidate, item))) return candidate;
    }
  }
  return { x: 0, y: 10_000, w: dimensions.w, h: dimensions.h };
}

function sortDashboardWidgetIds(
  ids: string[],
  items: Record<string, DashboardWidgetPlacement>,
  previousOrder: string[],
) {
  const previousIndex = new Map(previousOrder.map((id, index) => [id, index]));
  return [...ids].sort((leftId, rightId) => {
    const left = items[leftId];
    const right = items[rightId];
    return (
      (left?.y ?? 0) - (right?.y ?? 0) ||
      (left?.x ?? 0) - (right?.x ?? 0) ||
      (previousIndex.get(leftId) ?? 0) - (previousIndex.get(rightId) ?? 0)
    );
  });
}

function packDashboardItems(
  order: string[],
  hidden: string[],
  dimensions: Record<string, Pick<DashboardWidgetPlacement, "w" | "h">>,
  constraints: Record<string, DashboardWidgetConstraints>,
  columns = DASHBOARD_GRID_COLUMNS,
) {
  const hiddenSet = new Set(hidden);
  const items: Record<string, DashboardWidgetPlacement> = {};
  const occupied: DashboardWidgetPlacement[] = [];

  for (const id of order) {
    const normalizedConstraints = normalizeConstraints(constraints[id], columns);
    const normalized = normalizePlacement(dimensions[id], normalizedConstraints, columns);
    if (hiddenSet.has(id)) {
      items[id] = normalized;
      continue;
    }
    const placement = findFirstAvailablePlacement(normalized, occupied, columns);
    items[id] = placement;
    occupied.push(placement);
  }
  return items;
}

function resolveDashboardCollisions(
  items: Record<string, DashboardWidgetPlacement>,
  activeIds: string[],
  anchorId: string,
) {
  const next = Object.fromEntries(
    Object.entries(items).map(([id, item]) => [id, { ...item }]),
  ) as Record<string, DashboardWidgetPlacement>;
  const orderIndex = new Map(activeIds.map((id, index) => [id, index]));
  const queue = [anchorId];
  let safetyCounter = 0;

  while (queue.length > 0 && safetyCounter < 10_000) {
    safetyCounter += 1;
    const sourceId = queue.shift()!;
    const source = next[sourceId];
    if (!source) continue;
    const collisions = activeIds
      .filter((id) => id !== sourceId && next[id] && placementOverlaps(source, next[id]))
      .sort((leftId, rightId) =>
        next[leftId].y - next[rightId].y ||
        next[leftId].x - next[rightId].x ||
        (orderIndex.get(leftId) ?? 0) - (orderIndex.get(rightId) ?? 0),
      );
    for (const collidedId of collisions) {
      const collided = next[collidedId];
      const pushedY = source.y + source.h;
      if (collided.y >= pushedY) continue;
      next[collidedId] = { ...collided, y: pushedY };
      queue.push(collidedId);
    }
  }

  const compactOrder = sortDashboardWidgetIds(activeIds, next, activeIds);
  for (const id of compactOrder) {
    if (id === anchorId) continue;
    const item = next[id];
    while (item.y > 0) {
      const candidate = { ...item, y: item.y - 1 };
      const blocked = activeIds.some((otherId) =>
        otherId !== id && next[otherId] && placementOverlaps(candidate, next[otherId]),
      );
      if (blocked) break;
      item.y -= 1;
    }
  }

  return next;
}

export function normalizeDashboardWidgetOrder(savedOrder: string[], visibleWidgetIds: string[]) {
  const ordered = uniqueKnownIds(savedOrder, visibleWidgetIds);
  const missing = visibleWidgetIds.filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
}

export function normalizeDashboardHiddenWidgetIds(savedHiddenIds: string[], visibleWidgetIds: string[]) {
  return uniqueKnownIds(savedHiddenIds, visibleWidgetIds);
}

export function normalizeDashboardWidgetSizes(
  savedSizes: Record<string, string | undefined>,
  visibleWidgetIds: string[],
  defaults: Record<string, DashboardWidgetSize>,
) {
  const sizes: Record<string, DashboardWidgetSize> = {};
  for (const id of visibleWidgetIds) {
    const saved = savedSizes[id];
    sizes[id] = saved === "compact" || saved === "normal" || saved === "wide" || saved === "full"
      ? saved
      : defaults[id] ?? "normal";
  }
  return sizes;
}

export function normalizeDashboardLayoutState(
  savedLayout: DashboardSavedLayout,
  visibleWidgetIds: string[],
  constraints: Record<string, DashboardWidgetConstraints>,
  columns = DASHBOARD_GRID_COLUMNS,
): DashboardLayoutState {
  const savedOrder = Array.isArray(savedLayout) ? savedLayout : savedLayout?.order ?? [];
  const order = normalizeDashboardWidgetOrder(savedOrder, visibleWidgetIds);
  const hidden = Array.isArray(savedLayout)
    ? []
    : normalizeDashboardHiddenWidgetIds(savedLayout?.hidden ?? [], visibleWidgetIds);
  const savedItems = Array.isArray(savedLayout) ? {} : savedLayout?.items ?? {};
  const legacySizes = Array.isArray(savedLayout) ? {} : savedLayout?.sizes ?? {};
  const hasExplicitItems = Boolean(savedItems && Object.keys(savedItems).length > 0);
  const hiddenSet = new Set(hidden);
  const items: Record<string, DashboardWidgetPlacement> = {};

  if (!hasExplicitItems) {
    const dimensions = Object.fromEntries(order.map((id) => {
      const normalizedConstraints = normalizeConstraints(constraints[id], columns);
      const legacySize = legacySizes[id];
      const legacyWidth = legacySize === "compact" || legacySize === "normal" || legacySize === "wide" || legacySize === "full"
        ? LEGACY_SIZE_WIDTHS[legacySize]
        : normalizedConstraints.defaultW;
      return [id, { w: legacyWidth, h: normalizedConstraints.defaultH }];
    }));
    return {
      version: 2,
      order,
      hidden,
      items: packDashboardItems(order, hidden, dimensions, constraints, columns),
    };
  }

  const occupied: DashboardWidgetPlacement[] = [];
  for (const id of order) {
    const normalized = normalizePlacement(savedItems[id], normalizeConstraints(constraints[id], columns), columns);
    if (hiddenSet.has(id)) {
      items[id] = normalized;
      continue;
    }
    if (!occupied.some((item) => placementOverlaps(normalized, item))) {
      items[id] = normalized;
      occupied.push(normalized);
      continue;
    }
    const recovered = findFirstAvailablePlacement(normalized, occupied, columns, normalized.y);
    items[id] = recovered;
    occupied.push(recovered);
  }

  return { version: 2, order, hidden, items };
}

export function resetDashboardLayout(
  layout: DashboardLayoutState,
  defaultOrder: string[],
  constraints: Record<string, DashboardWidgetConstraints>,
  mode: "positions" | "positions-and-sizes",
  columns = DASHBOARD_GRID_COLUMNS,
): DashboardLayoutState {
  const order = normalizeDashboardWidgetOrder(defaultOrder, defaultOrder);
  const dimensions = Object.fromEntries(order.map((id) => {
    const normalizedConstraints = normalizeConstraints(constraints[id], columns);
    const current = layout.items[id];
    return [
      id,
      mode === "positions"
        ? {
            w: clamp(current?.w ?? normalizedConstraints.defaultW, normalizedConstraints.minW, normalizedConstraints.maxW),
            h: clamp(current?.h ?? normalizedConstraints.defaultH, normalizedConstraints.minH, normalizedConstraints.maxH),
          }
        : { w: normalizedConstraints.defaultW, h: normalizedConstraints.defaultH },
    ];
  }));
  return {
    version: 2,
    order,
    hidden: normalizeDashboardHiddenWidgetIds(layout.hidden, defaultOrder),
    items: packDashboardItems(order, layout.hidden, dimensions, constraints, columns),
  };
}

export function reflowDashboardLayout(
  layout: DashboardLayoutState,
  constraints: Record<string, DashboardWidgetConstraints>,
  columns = DASHBOARD_GRID_COLUMNS,
): DashboardLayoutState {
  const dimensions = Object.fromEntries(
    layout.order.map((id) => [id, layout.items[id] ?? normalizePlacement(null, normalizeConstraints(constraints[id], columns), columns)]),
  );
  return {
    ...layout,
    items: packDashboardItems(layout.order, layout.hidden, dimensions, constraints, columns),
  };
}

export function moveDashboardWidget(
  layout: DashboardLayoutState,
  widgetId: string,
  target: Pick<DashboardWidgetPlacement, "x" | "y">,
  constraints: Record<string, DashboardWidgetConstraints>,
  columns = DASHBOARD_GRID_COLUMNS,
): DashboardLayoutState {
  const current = layout.items[widgetId];
  if (!current || layout.hidden.includes(widgetId)) return layout;
  const normalized = normalizePlacement(
    { ...current, x: target.x, y: target.y },
    normalizeConstraints(constraints[widgetId], columns),
    columns,
  );
  const activeIds = layout.order.filter((id) => !layout.hidden.includes(id));
  const items = resolveDashboardCollisions({ ...layout.items, [widgetId]: normalized }, activeIds, widgetId);
  const activeOrder = sortDashboardWidgetIds(activeIds, items, layout.order);
  const hiddenTail = layout.order.filter((id) => layout.hidden.includes(id));
  return { ...layout, order: [...activeOrder, ...hiddenTail], items };
}

export function resizeDashboardWidget(
  layout: DashboardLayoutState,
  widgetId: string,
  dimensions: Pick<DashboardWidgetPlacement, "w" | "h">,
  constraints: Record<string, DashboardWidgetConstraints>,
  columns = DASHBOARD_GRID_COLUMNS,
): DashboardLayoutState {
  const current = layout.items[widgetId];
  if (!current || layout.hidden.includes(widgetId)) return layout;
  const normalized = normalizePlacement(
    { ...current, w: dimensions.w, h: dimensions.h },
    normalizeConstraints(constraints[widgetId], columns),
    columns,
  );
  const activeIds = layout.order.filter((id) => !layout.hidden.includes(id));
  const items = resolveDashboardCollisions({ ...layout.items, [widgetId]: normalized }, activeIds, widgetId);
  return { ...layout, items };
}

export function reorderDashboardWidgetIds(widgetIds: string[], sourceIndex: number, destinationIndex: number) {
  if (
    sourceIndex < 0 ||
    destinationIndex < 0 ||
    sourceIndex >= widgetIds.length ||
    destinationIndex >= widgetIds.length ||
    sourceIndex === destinationIndex
  ) {
    return widgetIds;
  }
  const next = [...widgetIds];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(destinationIndex, 0, moved);
  return next;
}
