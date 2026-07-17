import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DashboardProfileCard from "@/components/dashboard/dashboard-profile-card";
import DashboardCountdownWidget from "@/components/dashboard/dashboard-countdown-widget";
import DashboardServicesSection from "@/components/dashboard/dashboard-services-section";
import { DashboardGridWidget } from "@/components/dashboard/dashboard-grid-widget";
import { buildDashboardWidgetDefinitions } from "@/components/dashboard/dashboard-widget-definitions";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiRequest } from "@/lib/queryClient";
import {
  DASHBOARD_GRID_COLUMNS,
  moveDashboardWidget,
  normalizeDashboardLayoutState,
  reflowDashboardLayout,
  reorderDashboardWidgetIds,
  resetDashboardLayout,
  resizeDashboardWidget,
  type DashboardLayoutState,
  type DashboardSavedLayout,
} from "@/lib/dashboard-layout";
import {
  DASHBOARD_GRID_GAP,
  DASHBOARD_GRID_ROW_HEIGHT,
  getCurrentUser,
  getDashboardLayoutStorageKey,
  readSavedWidgetLayout,
  saveWidgetLayout,
  type DashboardWidgetDefinition,
  type DashboardWidgetId,
} from "@/lib/dashboard-page-model";
import { RotateCcw, Settings2 } from "lucide-react";

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const { workspace } = useWorkspace();
  const layoutStorageKey = getDashboardLayoutStorageKey({
    userId: currentUser?.id,
    workspaceType: workspace?.type,
    companyId: workspace?.companyId,
  });
  const [widgetLayout, setWidgetLayout] = useState<DashboardSavedLayout>(() => readSavedWidgetLayout());
  const previousLayoutStorageKeyRef = useRef(layoutStorageKey);
  const skipLayoutPersistRef = useRef(false);
  const [previewLayout, setPreviewLayout] = useState<DashboardLayoutState | null>(null);
  const previewLayoutRef = useRef<DashboardLayoutState | null>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<{
    widgetId: DashboardWidgetId;
    mode: "move" | "resize";
  } | null>(null);
  const [isInvalidTarget, setIsInvalidTarget] = useState(false);
  const [resetMode, setResetMode] = useState<"positions" | "positions-and-sizes" | null>(null);
  const [isWidgetSettingsOpen, setIsWidgetSettingsOpen] = useState(false);
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
    retry: 1,
    retryDelay: 1000,
  });

  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useQuery<any[]>({
    queryKey: ["/api/events"],
    retry: 1,
    retryDelay: 1000,
  });

  const { data: systems = [], isLoading: systemsLoading, isError: systemsError } = useQuery<any[]>({
    queryKey: ["/api/systems"],
    retry: 1,
    retryDelay: 1000,
  });

  const { data: equipment = [], isLoading: equipmentLoading, isError: equipmentError } = useQuery<any[]>({
    queryKey: ["/api/equipment"],
    retry: 1,
    retryDelay: 1000,
  });

  const { data: streams = [], isLoading: streamsLoading, isError: streamsError } = useQuery<any[]>({
    queryKey: ["/api/streams", "active=true"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/streams?active=true");
      return response.json();
    },
    retry: 1,
    retryDelay: 1000,
  });

  // Connect to WebSocket for real-time updates (опционально)
  // WebSocket не критичен - приложение должно работать без него
  useWebSocket();

  useEffect(() => () => interactionCleanupRef.current?.(), []);

  useEffect(() => {
    if (previousLayoutStorageKeyRef.current === layoutStorageKey) return;
    previousLayoutStorageKeyRef.current = layoutStorageKey;
    skipLayoutPersistRef.current = true;
    setWidgetLayout(readSavedWidgetLayout(layoutStorageKey));
    setPreviewLayout(null);
    previewLayoutRef.current = null;
  }, [layoutStorageKey]);

  const isLoading = statsLoading || eventsLoading || systemsLoading || equipmentLoading || streamsLoading;
  const hasError = statsError || eventsError || systemsError || equipmentError || streamsError;

  const nextEvent = (events as any[])
    ?.filter((e: any) => e.startTime && new Date(e.startTime) > new Date())
    ?.sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  const widgetDefinitions = useMemo(
    () => buildDashboardWidgetDefinitions({
      currentUser,
      stats,
      events,
      systems,
      equipment,
      streams,
    }),
    [currentUser, equipment, events, stats, streams, systems],
  );

  const visibleWidgetIds = useMemo(() => widgetDefinitions.map((widget) => widget.id), [widgetDefinitions]);
  const widgetConstraints = useMemo(
    () => Object.fromEntries(widgetDefinitions.map((widget) => [widget.id, widget.layout])),
    [widgetDefinitions],
  );
  const normalizedWidgetLayout = useMemo(
    () => normalizeDashboardLayoutState(widgetLayout, visibleWidgetIds, widgetConstraints),
    [visibleWidgetIds, widgetConstraints, widgetLayout],
  );
  const displayedWidgetLayout = previewLayout ?? normalizedWidgetLayout;
  const displayedWidgetOrder = displayedWidgetLayout.order;
  const hiddenWidgetIds = displayedWidgetLayout.hidden;
  const widgetsById = useMemo(() => new Map(widgetDefinitions.map((widget) => [widget.id, widget])), [widgetDefinitions]);
  const orderedWidgets = displayedWidgetOrder
    .filter((id) => !hiddenWidgetIds.includes(id))
    .map((id) => widgetsById.get(id as DashboardWidgetId))
    .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget));

  useEffect(() => {
    if (skipLayoutPersistRef.current) {
      skipLayoutPersistRef.current = false;
      return;
    }
    if (JSON.stringify(normalizedWidgetLayout) === JSON.stringify(widgetLayout)) return;
    setWidgetLayout(normalizedWidgetLayout);
    saveWidgetLayout(normalizedWidgetLayout, layoutStorageKey);
  }, [layoutStorageKey, normalizedWidgetLayout, widgetLayout]);

  const commitWidgetLayout = (nextLayout: DashboardLayoutState) => {
    previewLayoutRef.current = null;
    setPreviewLayout(null);
    setWidgetLayout(nextLayout);
    saveWidgetLayout(nextLayout, layoutStorageKey);
  };

  const commitWidgetOrder = (nextOrder: string[]) => {
    const hiddenOrderTail = normalizedWidgetLayout.order.filter((id) => !nextOrder.includes(id));
    commitWidgetLayout(reflowDashboardLayout(
      { ...normalizedWidgetLayout, order: [...nextOrder, ...hiddenOrderTail] },
      widgetConstraints,
    ));
  };

  const resizeWidgetByStep = (widgetId: DashboardWidgetId, deltaW: number, deltaH: number) => {
    const placement = normalizedWidgetLayout.items[widgetId];
    if (!placement) return;
    commitWidgetLayout(resizeDashboardWidget(
      normalizedWidgetLayout,
      widgetId,
      { w: placement.w + deltaW, h: placement.h + deltaH },
      widgetConstraints,
    ));
  };

  const toggleWidgetVisibility = (widgetId: DashboardWidgetId, nextVisible: boolean) => {
    const hidden = nextVisible
      ? hiddenWidgetIds.filter((id) => id !== widgetId)
      : [...hiddenWidgetIds, widgetId];
    commitWidgetLayout(reflowDashboardLayout(
      {
        ...normalizedWidgetLayout,
        hidden: hidden.filter((id, index) => hidden.indexOf(id) === index),
      },
      widgetConstraints,
    ));
  };

  const confirmWidgetLayoutReset = () => {
    if (!resetMode) return;
    commitWidgetLayout(resetDashboardLayout(
      normalizedWidgetLayout,
      visibleWidgetIds,
      widgetConstraints,
      resetMode,
    ));
    setResetMode(null);
  };

  const startPointerInteraction = (
    widgetId: DashboardWidgetId,
    mode: "move" | "resize",
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0 || !window.matchMedia("(min-width: 1024px)").matches) return;
    const grid = gridRef.current;
    const initialPlacement = displayedWidgetLayout.items[widgetId];
    if (!grid || !initialPlacement) return;

    event.preventDefault();
    interactionCleanupRef.current?.();
    const gridRect = grid.getBoundingClientRect();
    const columnPitch = (gridRect.width + DASHBOARD_GRID_GAP) / DASHBOARD_GRID_COLUMNS;
    const rowPitch = DASHBOARD_GRID_ROW_HEIGHT + DASHBOARD_GRID_GAP;
    const initialLayout = displayedWidgetLayout;
    const startX = event.clientX;
    const startY = event.clientY;
    let invalidTarget = false;

    previewLayoutRef.current = initialLayout;
    setPreviewLayout(initialLayout);
    setActiveInteraction({ widgetId, mode });
    setIsInvalidTarget(false);

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const deltaColumns = Math.round((pointerEvent.clientX - startX) / columnPitch);
      const deltaRows = Math.round((pointerEvent.clientY - startY) / rowPitch);
      let nextLayout = initialLayout;

      if (mode === "move") {
        const targetX = initialPlacement.x + deltaColumns;
        const targetY = initialPlacement.y + deltaRows;
        invalidTarget =
          targetX < 0 ||
          targetX + initialPlacement.w > DASHBOARD_GRID_COLUMNS ||
          targetY < 0;
        if (!invalidTarget) {
          nextLayout = moveDashboardWidget(
            initialLayout,
            widgetId,
            { x: targetX, y: targetY },
            widgetConstraints,
          );
        }
      } else {
        invalidTarget = false;
        nextLayout = resizeDashboardWidget(
          initialLayout,
          widgetId,
          { w: initialPlacement.w + deltaColumns, h: initialPlacement.h + deltaRows },
          widgetConstraints,
        );
      }

      previewLayoutRef.current = nextLayout;
      setPreviewLayout(nextLayout);
      setIsInvalidTarget(invalidTarget);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      interactionCleanupRef.current = null;
      setActiveInteraction(null);
      setIsInvalidTarget(false);
    };

    const finish = (shouldCommit: boolean) => {
      const nextLayout = previewLayoutRef.current;
      cleanup();
      previewLayoutRef.current = null;
      setPreviewLayout(null);
      if (shouldCommit && !invalidTarget && nextLayout) commitWidgetLayout(nextLayout);
    };

    const handlePointerUp = () => finish(true);
    const handlePointerCancel = () => finish(false);

    interactionCleanupRef.current = () => finish(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, { once: true });
  };

  const moveWidgetByButton = (index: number, direction: "up" | "down") => {
    const destinationIndex = direction === "up" ? index - 1 : index + 1;
    const activeOrder = normalizedWidgetLayout.order.filter((id) => !hiddenWidgetIds.includes(id));
    if (destinationIndex < 0 || destinationIndex >= activeOrder.length) return;
    commitWidgetOrder(reorderDashboardWidgetIds(activeOrder, index, destinationIndex));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (hasError) {
    console.warn("[Dashboard] Some data failed to load, showing dashboard with available data");
  }

  return (
    <div className="space-y-1.5 sm:space-y-2 w-full min-w-0 max-w-full overflow-hidden pt-0 sm:pt-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 w-full min-w-0">
        <DashboardProfileCard />
        <DashboardCountdownWidget nextEvent={nextEvent} />
      </div>

      <div className="rounded-xl border border-border/40 bg-background/35 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg"
            onClick={() => setIsWidgetSettingsOpen((value) => !value)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Виджеты
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 rounded-lg">
                <RotateCcw className="mr-2 h-4 w-4" />
                Сбросить layout
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setResetMode("positions")}>
                Сбросить только позиции
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setResetMode("positions-and-sizes")}>
                Сбросить позиции и размеры
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isWidgetSettingsOpen && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {widgetDefinitions.map((widget) => {
              const isVisible = !hiddenWidgetIds.includes(widget.id);
              return (
                <label
                  key={widget.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">{widget.title}</span>
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(event) => toggleWidgetVisibility(widget.id, event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div ref={gridRef} className="dashboard-widget-grid">
        {orderedWidgets.map((widget, index) => {
          const placement = displayedWidgetLayout.items[widget.id];
          if (!placement) return null;
          const isCurrentInteraction = activeInteraction?.widgetId === widget.id;
          return (
            <DashboardGridWidget
              key={widget.id}
              widget={widget}
              index={index}
              total={orderedWidgets.length}
              placement={placement}
              isInteracting={isCurrentInteraction}
              isInvalidTarget={isCurrentInteraction && isInvalidTarget}
              onMove={moveWidgetByButton}
              onPointerInteraction={startPointerInteraction}
              onResizeStep={resizeWidgetByStep}
            />
          );
        })}
      </div>

      <DashboardServicesSection user={currentUser} />

      <AlertDialog open={resetMode !== null} onOpenChange={(open) => !open && setResetMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить расположение виджетов?</AlertDialogTitle>
            <AlertDialogDescription>
              {resetMode === "positions"
                ? "Позиции вернутся к значениям по умолчанию, текущие размеры и выбор видимых виджетов сохранятся."
                : "Позиции и размеры вернутся к значениям по умолчанию. Скрытые виджеты останутся скрытыми."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWidgetLayoutReset}>Сбросить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
