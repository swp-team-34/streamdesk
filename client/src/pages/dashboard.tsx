import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
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
  ActiveProjectsWidget,
  AttentionSummaryWidget,
  EquipmentAttentionWidget,
  MyWorkloadWidget,
  OverdueTasksWidget,
  UpcomingEventsWidget,
} from "@/components/dashboard/follow-up-widgets";
import WorkProgressWidget from "@/components/dashboard/work-progress-widget";
import { useWebSocket } from "@/hooks/use-websocket";
import { tabPermission } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  calculateDashboardWidgetRowSpan,
  normalizeDashboardLayoutState,
  reorderDashboardWidgetIds,
  type DashboardLayoutState,
  type DashboardWidgetSize,
} from "@/lib/dashboard-layout";
import { ArrowDown, ArrowUp, GripVertical, Settings2 } from "lucide-react";

const DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY = "streamdesk.dashboard.widgetOrder.v1";
const DASHBOARD_WIDGET_SIZE_LABELS: Record<DashboardWidgetSize, string> = {
  compact: "S",
  normal: "M",
  wide: "L",
  full: "XL",
};
const DASHBOARD_WIDGET_SIZE_OPTIONS: DashboardWidgetSize[] = ["compact", "normal", "wide", "full"];
const DASHBOARD_MASONRY_ROW_HEIGHT = 8;
const DASHBOARD_MASONRY_ROW_GAP = 8;

type DashboardWidgetId =
  | "status"
  | "attention-summary"
  | "work-progress"
  | "deadline-tasks"
  | "overdue-tasks"
  | "my-workload"
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
  defaultSize: DashboardWidgetSize;
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

function getWidgetSizeClass(size: DashboardWidgetSize) {
  return {
    compact: "xl:col-span-4",
    normal: "xl:col-span-6",
    wide: "xl:col-span-8",
    full: "xl:col-span-12",
  }[size];
}

function readSavedWidgetLayout(): Partial<DashboardLayoutState> | string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed && typeof parsed === "object") return parsed as Partial<DashboardLayoutState>;
    return [];
  } catch {
    return [];
  }
}

function saveWidgetLayout(layout: DashboardLayoutState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DASHBOARD_WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function DashboardMasonryWidget({
  widget,
  index,
  total,
  size,
  dragProvided,
  snapshot,
  onMove,
  onSizeChange,
}: {
  widget: DashboardWidgetDefinition;
  index: number;
  total: number;
  size: DashboardWidgetSize;
  dragProvided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onMove: (index: number, direction: "up" | "down") => void;
  onSizeChange: (widgetId: DashboardWidgetId, nextSize: DashboardWidgetSize) => void;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [rowSpan, setRowSpan] = useState(12);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const updateRowSpan = () => {
      const measuredHeight = Math.max(
        element.getBoundingClientRect().height,
        element.scrollHeight,
        element.offsetHeight,
      );
      setRowSpan(calculateDashboardWidgetRowSpan(
        measuredHeight,
        DASHBOARD_MASONRY_ROW_HEIGHT,
        DASHBOARD_MASONRY_ROW_GAP,
      ));
    };

    updateRowSpan();
    const observer = new ResizeObserver(updateRowSpan);
    observer.observe(element);
    return () => observer.disconnect();
  }, [widget.id, size]);

  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      className={[
        "min-w-0",
        getWidgetSizeClass(size),
        snapshot.isDragging ? "dashboard-widget-dragging" : "",
      ].join(" ")}
      style={{
        ...dragProvided.draggableProps.style,
        gridRowEnd: `span ${rowSpan}`,
      } as CSSProperties}
    >
      <div ref={contentRef} className="min-w-0 rounded-xl border border-border/35 bg-background/30 p-1 shadow-sm transition-colors">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <div
            className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground"
            {...dragProvided.dragHandleProps}
          >
            <GripVertical className="h-4 w-4 shrink-0" />
            <span className="truncate">{widget.title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <select
              aria-label={`Габарит виджета ${widget.title}`}
              title="Габарит виджета"
              value={size}
              onChange={(event) => onSizeChange(widget.id, event.target.value as DashboardWidgetSize)}
              className="h-7 rounded-lg border border-border bg-background px-1.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            >
              {DASHBOARD_WIDGET_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{DASHBOARD_WIDGET_SIZE_LABELS[option]}</option>
              ))}
            </select>
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
        <div className="min-h-[96px] min-w-0">{widget.render()}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const [widgetLayout, setWidgetLayout] = useState<Partial<DashboardLayoutState> | string[]>(() => readSavedWidgetLayout());
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
        defaultSize: "full",
        render: () => <StatusCards stats={stats} user={currentUser} />,
      },
    ];

    if (canAccessTab(currentUser, "tasks")) {
      widgets.push(
        {
          id: "attention-summary",
          title: "Требует внимания",
          defaultSize: "compact",
          render: () => <AttentionSummaryWidget />,
        },
        {
          id: "work-progress",
          title: "Ход работ",
          defaultSize: "full",
          render: () => <WorkProgressWidget />,
        },
        {
          id: "deadline-tasks",
          title: "Задачи по срокам",
          defaultSize: "wide",
          render: () => <DeadlineTasksWidget limit={5} />,
        },
        {
          id: "overdue-tasks",
          title: "Просроченные задачи",
          defaultSize: "normal",
          render: () => <OverdueTasksWidget />,
        },
        {
          id: "my-workload",
          title: "Моя нагрузка",
          defaultSize: "normal",
          render: () => <MyWorkloadWidget user={currentUser} />,
        },
      );
    }

    if (canAccessTab(currentUser, "equipment")) {
      widgets.push({
        id: "equipment-attention",
        title: "Оборудование требует внимания",
        defaultSize: "normal",
        render: () => <EquipmentAttentionWidget />,
      });
    }

    if (canAccessTab(currentUser, "calendar")) {
      widgets.push({
        id: "upcoming-events",
        title: "Ближайшие события",
        defaultSize: "normal",
        render: () => <UpcomingEventsWidget events={events} />,
      });
    }

    if (canAccessTab(currentUser, "projects")) {
      widgets.push({
        id: "active-projects",
        title: "Проекты в работе",
        defaultSize: "wide",
        render: () => <ActiveProjectsWidget />,
      });
    }

    if (canAccessTab(currentUser, "streams") || canAccessTab(currentUser, "calendar")) {
      widgets.push({
        id: "current-activity",
        title: "Текущая активность",
        defaultSize: "wide",
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
        defaultSize: "wide",
        render: () => <VmixScheduler />,
      });
    }

    if (canAccessTab(currentUser, "calendar")) {
      widgets.push({
        id: "quick-calendar",
        title: "Календарь",
        defaultSize: "wide",
        render: () => <QuickCalendar events={events} />,
      });
    }

    if (canAccessTab(currentUser, "streams")) {
      widgets.push({
        id: "streaming-stats",
        title: "Статистика стримов",
        defaultSize: "compact",
        render: () => <StreamingStats />,
      });
    }

    if (canAccessTab(currentUser, "monitoring")) {
      widgets.push({
        id: "system-status",
        title: "Системы",
        defaultSize: "compact",
        render: () => <SystemStatus systems={systems} />,
      });
    }

    if (canAccessTab(currentUser, "equipment")) {
      widgets.push({
        id: "equipment-status",
        title: "Склад техники",
        defaultSize: "compact",
        render: () => <EquipmentStatus equipment={equipment} />,
      });
    }

    return widgets;
  }, [currentUser, equipment, events, stats, streams, systems]);

  const visibleWidgetIds = useMemo(() => widgetDefinitions.map((widget) => widget.id), [widgetDefinitions]);
  const widgetSizeDefaults = useMemo(
    () => Object.fromEntries(widgetDefinitions.map((widget) => [widget.id, widget.defaultSize])),
    [widgetDefinitions],
  );
  const normalizedWidgetLayout = useMemo(
    () => normalizeDashboardLayoutState(widgetLayout, visibleWidgetIds, widgetSizeDefaults),
    [visibleWidgetIds, widgetLayout, widgetSizeDefaults],
  );
  const normalizedWidgetOrder = normalizedWidgetLayout.order;
  const hiddenWidgetIds = normalizedWidgetLayout.hidden;
  const widgetSizes = normalizedWidgetLayout.sizes;
  const widgetsById = useMemo(() => new Map(widgetDefinitions.map((widget) => [widget.id, widget])), [widgetDefinitions]);
  const orderedWidgets = normalizedWidgetOrder
    .filter((id) => !hiddenWidgetIds.includes(id))
    .map((id) => widgetsById.get(id as DashboardWidgetId))
    .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget));

  useEffect(() => {
    if (JSON.stringify(normalizedWidgetLayout) === JSON.stringify(widgetLayout)) return;
    setWidgetLayout(normalizedWidgetLayout);
    saveWidgetLayout(normalizedWidgetLayout);
  }, [normalizedWidgetLayout, widgetLayout]);

  const commitWidgetLayout = (nextLayout: DashboardLayoutState) => {
    setWidgetLayout(nextLayout);
    saveWidgetLayout(nextLayout);
  };

  const commitWidgetOrder = (nextOrder: string[]) => {
    const hiddenOrderTail = normalizedWidgetOrder.filter((id) => !nextOrder.includes(id));
    commitWidgetLayout({ ...normalizedWidgetLayout, order: [...nextOrder, ...hiddenOrderTail] });
  };

  const changeWidgetSize = (widgetId: DashboardWidgetId, nextSize: DashboardWidgetSize) => {
    commitWidgetLayout({
      ...normalizedWidgetLayout,
      sizes: {
        ...normalizedWidgetLayout.sizes,
        [widgetId]: nextSize,
      },
    });
  };

  const toggleWidgetVisibility = (widgetId: DashboardWidgetId, nextVisible: boolean) => {
    const hidden = nextVisible
      ? hiddenWidgetIds.filter((id) => id !== widgetId)
      : [...hiddenWidgetIds, widgetId];
    commitWidgetLayout({
      ...normalizedWidgetLayout,
      hidden: hidden.filter((id, index) => hidden.indexOf(id) === index),
    });
  };

  const resetWidgetLayout = () => {
    const nextLayout = normalizeDashboardLayoutState(null, visibleWidgetIds, widgetSizeDefaults);
    commitWidgetLayout(nextLayout);
  };

  const handleWidgetDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    commitWidgetOrder(reorderDashboardWidgetIds(normalizedWidgetOrder, result.source.index, result.destination.index));
  };

  const moveWidgetByButton = (index: number, direction: "up" | "down") => {
    const destinationIndex = direction === "up" ? index - 1 : index + 1;
    if (destinationIndex < 0 || destinationIndex >= normalizedWidgetOrder.length) return;
    commitWidgetOrder(reorderDashboardWidgetIds(normalizedWidgetOrder, index, destinationIndex));
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
          <Button variant="ghost" size="sm" className="h-8 rounded-lg" onClick={resetWidgetLayout}>
            Сбросить layout
          </Button>
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

      <DragDropContext onDragEnd={handleWidgetDragEnd}>
        <Droppable droppableId="dashboard-widgets" direction="vertical">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-flow-dense auto-rows-[8px] grid-cols-1 gap-1.5 sm:gap-2 xl:grid-cols-12"
            >
              {orderedWidgets.map((widget, index) => (
                <Draggable key={widget.id} draggableId={widget.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <DashboardMasonryWidget
                      widget={widget}
                      index={index}
                      total={orderedWidgets.length}
                      size={widgetSizes[widget.id] ?? widget.defaultSize}
                      dragProvided={dragProvided}
                      snapshot={snapshot}
                      onMove={moveWidgetByButton}
                      onSizeChange={changeWidgetSize}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <DashboardServicesSection user={currentUser} />
    </div>
  );
}
