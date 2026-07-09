export type DashboardWidgetSize = "compact" | "normal" | "wide" | "full";

export interface DashboardLayoutState {
  order: string[];
  hidden: string[];
  sizes: Record<string, DashboardWidgetSize>;
}

export function normalizeDashboardWidgetOrder(savedOrder: string[], visibleWidgetIds: string[]) {
  const visible = new Set(visibleWidgetIds);
  const ordered = savedOrder.filter((id, index) => visible.has(id) && savedOrder.indexOf(id) === index);
  const missing = visibleWidgetIds.filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
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

export function normalizeDashboardHiddenWidgetIds(savedHiddenIds: string[], visibleWidgetIds: string[]) {
  const visible = new Set(visibleWidgetIds);
  return savedHiddenIds.filter((id, index) => visible.has(id) && savedHiddenIds.indexOf(id) === index);
}

export function normalizeDashboardLayoutState(
  savedLayout: Partial<DashboardLayoutState> | string[] | null | undefined,
  visibleWidgetIds: string[],
  defaults: Record<string, DashboardWidgetSize>,
): DashboardLayoutState {
  if (Array.isArray(savedLayout)) {
    return {
      order: normalizeDashboardWidgetOrder(savedLayout, visibleWidgetIds),
      hidden: [],
      sizes: normalizeDashboardWidgetSizes({}, visibleWidgetIds, defaults),
    };
  }

  return {
    order: normalizeDashboardWidgetOrder(savedLayout?.order ?? [], visibleWidgetIds),
    hidden: normalizeDashboardHiddenWidgetIds(savedLayout?.hidden ?? [], visibleWidgetIds),
    sizes: normalizeDashboardWidgetSizes(savedLayout?.sizes ?? {}, visibleWidgetIds, defaults),
  };
}

export function reorderDashboardWidgetIds(widgetIds: string[], sourceIndex: number, destinationIndex: number) {
  const next = [...widgetIds];
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) return widgetIds;
  next.splice(destinationIndex, 0, moved);
  return next;
}

export function calculateDashboardWidgetRowSpan(
  contentHeight: number,
  rowHeight = 8,
  rowGap = 8,
  minSpan = 1,
) {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return minSpan;
  return Math.max(minSpan, Math.ceil((contentHeight + rowGap) / (rowHeight + rowGap)) + 2);
}
