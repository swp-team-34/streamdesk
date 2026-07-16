import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
import StatusCards from "@/components/dashboard/status-cards";
import CurrentActivity from "@/components/dashboard/current-activity";
import QuickCalendar from "@/components/dashboard/quick-calendar";
import SystemStatus from "@/components/dashboard/system-status";
import EquipmentStatus from "@/components/dashboard/equipment-status";
import StreamingStats from "@/components/dashboard/streaming-stats";
import VmixScheduler from "@/components/dashboard/vmix-scheduler";
import DashboardProfileCard from "@/components/dashboard/dashboard-profile-card";
import DashboardCountdownWidget from "@/components/dashboard/dashboard-countdown-widget";
import DashboardServicesSection from "@/components/dashboard/dashboard-services-section";
import DeadlineTasksWidget from "@/components/dashboard/deadline-tasks-widget";
import {
  AttentionSummaryWidget,
  MyWorkloadWidget,
  OverdueTasksWidget,
  UpcomingEventsWidget,
} from "@/components/dashboard/follow-up-widgets";
import {
  ActiveProjectsOperationalWidget,
  EquipmentForTasksWidget,
  TeamWorkloadOperationalWidget,
  UnassignedTasksWidget,
  UpcomingReturnsOperationalWidget,
} from "@/components/dashboard/operational-widgets";
import WorkProgressWidget from "@/components/dashboard/work-progress-widget";
import LocationIssuesWidget from "@/components/dashboard/location-issues-widget";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWorkspace } from "@/contexts/workspace-context";
import { tabPermission } from "@shared/schema";
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
  type DashboardWidgetConstraints,
  type DashboardWidgetPlacement,
} from "@/lib/dashboard-layout";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  GripVertical,
  MoveDiagonal2,
  RotateCcw,
  Settings2,
} from "lucide-react";

const DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY = "streamdesk.dashboard.widgetLayout.v2";
const LEGACY_DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY = "streamdesk.dashboard.widgetOrder.v1";
const DASHBOARD_GRID_ROW_HEIGHT = 12;
const DASHBOARD_GRID_GAP = 8;

type DashboardWidgetId =
  | "status"
  | "location-issues"
  | "attention-summary"
  | "work-progress"
  | "deadline-tasks"
  | "overdue-tasks"
  | "my-workload"
  | "unassigned-tasks"
  | "team-workload"
  | "equipment-current-tasks"
  | "equipment-attention"
  | "upcoming-events"
  | "active-projects"
  | "current-activity"
  | "vmix-scheduler"
  | "quick-calendar"
  | "streaming-stats"
  | "system-status"
  | "equipment-status";

interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  layout: DashboardWidgetConstraints;
  render: () => ReactNode;
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("streamstudio_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function canAccessTab(user: any, tabKey: string): boolean {
  if (!user) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const hasTabPermissions = permissions.some((permission: string) => permission.startsWith("tab:"));
  if (hasTabPermissions) return permissions.includes(tabPermission(tabKey));
  return true;
}

function readSavedWidgetLayout(storageKey = DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY): DashboardSavedLayout {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(storageKey) ??
      window.localStorage.getItem(DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed && typeof parsed === "object") return parsed as DashboardSavedLayout;
    return [];
  } catch {
    return [];
  }
}

function saveWidgetLayout(layout: DashboardLayoutState, storageKey = DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(layout));
}

function DashboardGridWidget({
  widget,
  index,
  total,
  placement,
  isInteracting,
  isInvalidTarget,
  onMove,
  onPointerInteraction,
  onResizeStep,
}: {
  widget: DashboardWidgetDefinition;
  index: number;
  total: number;
  placement: DashboardWidgetPlacement;
  isInteracting: boolean;
  isInvalidTarget: boolean;
  onMove: (index: number, direction: "up" | "down") => void;
  onPointerInteraction: (
    widgetId: DashboardWidgetId,
    mode: "move" | "resize",
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onResizeStep: (widgetId: DashboardWidgetId, deltaW: number, deltaH: number) => void;
}) {
  return (
    <div
      className={[
        "dashboard-widget-placement min-w-0",
        isInteracting ? "dashboard-widget-dragging" : "",
        isInvalidTarget ? "dashboard-widget-invalid-target" : "",
      ].join(" ")}
      style={{
        "--dashboard-widget-x": placement.x + 1,
        "--dashboard-widget-y": placement.y + 1,
        "--dashboard-widget-w": placement.w,
        "--dashboard-widget-h": placement.h,
      } as CSSProperties}
    >
      <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/35 bg-background/30 p-1 shadow-sm transition-colors">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            className="dashboard-direct-drag-handle flex min-w-0 flex-1 touch-none items-center gap-1.5 rounded-md text-left text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onPointerDown={(event) => onPointerInteraction(widget.id, "move", event)}
            aria-label={`Переместить виджет ${widget.title}`}
            title="Перетащить виджет"
          >
            <GripVertical className="h-4 w-4 shrink-0" />
            <span className="truncate">{widget.title}</span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  aria-label={`Настроить размер виджета ${widget.title}`}
                  title="Размер виджета"
                >
                  <MoveDiagonal2 className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, -1, 0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Уже
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, 1, 0)}>
                  <ArrowRight className="mr-2 h-4 w-4" /> Шире
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, 0, -1)}>
                  <ArrowUp className="mr-2 h-4 w-4" /> Меньше по высоте
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, 0, 1)}>
                  <ArrowDown className="mr-2 h-4 w-4" /> Больше по высоте
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onMove(index, "up")}
              disabled={index === 0}
              aria-label="Переместить выше"
              title="Переместить выше"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onMove(index, "down")}
              disabled={index === total - 1}
              aria-label="Переместить ниже"
              title="Переместить ниже"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="dashboard-widget-content min-h-[96px] min-w-0 flex-1 overflow-auto">
          {widget.render()}
        </div>
        <button
          type="button"
          className="dashboard-resize-handle absolute bottom-0 right-0 h-7 w-7 touch-none rounded-tl-lg text-muted-foreground outline-none transition hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
          onPointerDown={(event) => onPointerInteraction(widget.id, "resize", event)}
          onKeyDown={(event) => {
            const delta =
              event.key === "ArrowLeft" ? [-1, 0] :
              event.key === "ArrowRight" ? [1, 0] :
              event.key === "ArrowUp" ? [0, -1] :
              event.key === "ArrowDown" ? [0, 1] :
              null;
            if (!delta) return;
            event.preventDefault();
            onResizeStep(widget.id, delta[0], delta[1]);
          }}
          aria-label={`Изменить размер виджета ${widget.title}. Используйте клавиши со стрелками.`}
          title="Потяните для изменения размера"
        >
          <MoveDiagonal2 className="ml-auto mt-auto h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const { workspace } = useWorkspace();
  const layoutStorageKey = [
    DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY,
    String(currentUser?.id || "anonymous"),
    String(workspace?.type || "none"),
    String(workspace?.companyId || "personal"),
  ].join(":");
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

  const widgetDefinitions = useMemo<DashboardWidgetDefinition[]>(() => {
    const widgets: DashboardWidgetDefinition[] = [
      {
        id: "status",
        title: "Статус",
        layout: { defaultW: 12, defaultH: 8, minW: 6, maxW: 12, minH: 6, maxH: 18 },
        render: () => <StatusCards stats={stats} user={currentUser} />,
      },
    ];

    if (canAccessTab(currentUser, "tasks")) {
      widgets.push(
        {
          id: "attention-summary",
          title: "Требует внимания",
          layout: { defaultW: 4, defaultH: 10, minW: 3, maxW: 8, minH: 8, maxH: 20 },
          render: () => <AttentionSummaryWidget />,
        },
        {
          id: "work-progress",
          title: "Ход работ",
          layout: { defaultW: 12, defaultH: 18, minW: 6, maxW: 12, minH: 12, maxH: 32 },
          render: () => <WorkProgressWidget />,
        },
        {
          id: "deadline-tasks",
          title: "Задачи по срокам",
          layout: { defaultW: 8, defaultH: 22, minW: 5, maxW: 12, minH: 12, maxH: 34 },
          render: () => <DeadlineTasksWidget limit={5} />,
        },
        {
          id: "overdue-tasks",
          title: "Просроченные задачи",
          layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
          render: () => <OverdueTasksWidget />,
        },
        {
          id: "my-workload",
          title: "Моя нагрузка",
          layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
          render: () => <MyWorkloadWidget user={currentUser} />,
        },
        {
          id: "unassigned-tasks",
          title: "Задачи без исполнителя",
          layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
          render: () => <UnassignedTasksWidget />,
        },
        {
          id: "team-workload",
          title: "Нагрузка команды",
          layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
          render: () => <TeamWorkloadOperationalWidget />,
        },
      );
    }

    if (canAccessTab(currentUser, "locations")) {
      widgets.push({
        id: "location-issues",
        title: "Обновления площадок",
        layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
        render: () => <LocationIssuesWidget />,
      });
    }

    if (canAccessTab(currentUser, "tasks") && canAccessTab(currentUser, "equipment")) {
      widgets.push({
        id: "equipment-current-tasks",
        title: "Оборудование текущих задач",
        layout: { defaultW: 6, defaultH: 18, minW: 4, maxW: 12, minH: 12, maxH: 30 },
        render: () => <EquipmentForTasksWidget user={currentUser} />,
      });
    }

    if (canAccessTab(currentUser, "equipment")) {
      widgets.push({
        id: "equipment-attention",
        title: "Ближайшие возвраты",
        layout: { defaultW: 6, defaultH: 14, minW: 4, maxW: 12, minH: 10, maxH: 26 },
        render: () => <UpcomingReturnsOperationalWidget />,
      });
    }

    if (canAccessTab(currentUser, "calendar")) {
      widgets.push({
        id: "upcoming-events",
        title: "Ближайшие события",
        layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
        render: () => <UpcomingEventsWidget events={events} />,
      });
    }

    if (canAccessTab(currentUser, "projects")) {
      widgets.push({
        id: "active-projects",
        title: "Активные проекты",
        layout: { defaultW: 8, defaultH: 18, minW: 5, maxW: 12, minH: 12, maxH: 30 },
        render: () => <ActiveProjectsOperationalWidget />,
      });
    }

    if (canAccessTab(currentUser, "streams") || canAccessTab(currentUser, "calendar")) {
      widgets.push({
        id: "current-activity",
        title: "Текущая активность",
        layout: { defaultW: 8, defaultH: 16, minW: 5, maxW: 12, minH: 10, maxH: 28 },
        render: () => (
          <CurrentActivity
            streams={canAccessTab(currentUser, "streams") ? streams : []}
            events={canAccessTab(currentUser, "calendar") ? events : []}
          />
        ),
      });
    }

    if (canAccessTab(currentUser, "vmix-scheduler")) {
      widgets.push({
        id: "vmix-scheduler",
        title: "vMix Scheduler",
        layout: { defaultW: 8, defaultH: 20, minW: 5, maxW: 12, minH: 12, maxH: 34 },
        render: () => <VmixScheduler />,
      });
    }

    if (canAccessTab(currentUser, "calendar")) {
      widgets.push({
        id: "quick-calendar",
        title: "Календарь",
        layout: { defaultW: 8, defaultH: 18, minW: 5, maxW: 12, minH: 12, maxH: 30 },
        render: () => <QuickCalendar events={events} />,
      });
    }

    if (canAccessTab(currentUser, "streams")) {
      widgets.push({
        id: "streaming-stats",
        title: "Статистика стримов",
        layout: { defaultW: 4, defaultH: 16, minW: 3, maxW: 8, minH: 10, maxH: 28 },
        render: () => <StreamingStats />,
      });
    }

    if (canAccessTab(currentUser, "monitoring")) {
      widgets.push({
        id: "system-status",
        title: "Системы",
        layout: { defaultW: 4, defaultH: 14, minW: 3, maxW: 8, minH: 10, maxH: 26 },
        render: () => <SystemStatus systems={systems} />,
      });
    }

    if (canAccessTab(currentUser, "equipment")) {
      widgets.push({
        id: "equipment-status",
        title: "Склад техники",
        layout: { defaultW: 4, defaultH: 16, minW: 3, maxW: 8, minH: 10, maxH: 28 },
        render: () => <EquipmentStatus equipment={equipment} />,
      });
    }

    return widgets;
  }, [currentUser, equipment, events, stats, streams, systems]);

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
