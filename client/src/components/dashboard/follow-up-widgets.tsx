import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BriefcaseBusiness, CalendarClock, CheckCircle2, PackageCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

const COMPLETE_LEGACY_STATUSES = new Set(["done", "completed", "cancelled"]);
const COMPLETE_KANBAN_LIST_TYPES = new Set(["closed", "archive", "trash"]);

function getTime(value: unknown) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value as string | Date).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function formatShortDate(value: unknown) {
  const time = getTime(value);
  if (!Number.isFinite(time)) return "без срока";
  return new Date(time).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isComplete(item: any) {
  if (item?.source === "legacy") return COMPLETE_LEGACY_STATUSES.has(String(item.status || ""));
  return COMPLETE_KANBAN_LIST_TYPES.has(String(item.listType || ""));
}

function isOverdue(item: any, now: Date) {
  return !isComplete(item) && getTime(item.dueDate) < now.getTime();
}

function isOperationalEquipmentAssignment(item: any) {
  return !Array.isArray(item?.sources) || item.sources.includes("project-bundle");
}

function useTaskSources() {
  const cardsQuery = useQuery<any[]>({
    queryKey: ["/api/kanban/cards"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/kanban/cards");
      return response.json();
    },
    retry: 1,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const tasksQuery = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    retry: 1,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const tasks = useMemo(
    () => [
      ...(cardsQuery.data ?? []).map((card) => ({ ...card, source: "kanban", taskTitle: card.title })),
      ...(tasksQuery.data ?? []).map((task) => ({ ...task, source: "legacy", taskTitle: task.title })),
    ],
    [cardsQuery.data, tasksQuery.data],
  );

  return {
    tasks,
    isLoading: cardsQuery.isLoading || tasksQuery.isLoading,
    hasError: cardsQuery.isError || tasksQuery.isError,
  };
}

function WidgetShell({
  title,
  icon,
  tone = "default",
  children,
}: {
  title: string;
  icon: ReactNode;
  tone?: "default" | "danger" | "amber" | "green";
  children: ReactNode;
}) {
  const border =
    tone === "danger" ? "border-l-red-500/80" :
    tone === "amber" ? "border-l-amber-500/80" :
    tone === "green" ? "border-l-emerald-500/80" :
    "border-l-primary/70";

  return (
    <Card className={`bg-card/80 dark:bg-card/90 backdrop-blur-sm border border-border rounded-xl overflow-hidden min-w-0 border-l-4 ${border}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <CardTitle className="truncate text-sm font-semibold text-foreground">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">{children}</CardContent>
    </Card>
  );
}

function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export function OverdueTasksWidget() {
  const { tasks, isLoading, hasError } = useTaskSources();
  const now = new Date();
  const overdue = tasks
    .filter((task) => isOverdue(task, now))
    .sort((left, right) => getTime(left.dueDate) - getTime(right.dueDate))
    .slice(0, 5);

  return (
    <WidgetShell title="Просроченные задачи" tone="danger" icon={<AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}>
      {hasError && <Badge variant="outline" className="w-fit rounded-full text-amber-600">ошибка обновления</Badge>}
      {isLoading ? <LoadingRows /> : overdue.length === 0 ? <EmptyState text="Просроченных задач нет" /> : overdue.map((task) => (
        <div key={`${task.source}:${task.id}`} className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2">
          <div className="truncate text-sm font-medium text-foreground">{task.taskTitle || "Задача"}</div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{task.boardName || task.status || task.source}</span>
            <Badge variant="destructive" className="shrink-0 rounded-full">{formatShortDate(task.dueDate)}</Badge>
          </div>
        </div>
      ))}
    </WidgetShell>
  );
}

export function MyWorkloadWidget({ user }: { user?: any }) {
  const { tasks, isLoading } = useTaskSources();
  const userId = String(user?.id || "");
  const now = new Date();
  const mine = tasks.filter((task) => userId && String(task.assigneeUserId || task.assigneeId || "") === userId);
  const active = mine.filter((task) => !isComplete(task)).length;
  const overdue = mine.filter((task) => isOverdue(task, now)).length;
  const upcoming = mine
    .filter((task) => !isComplete(task) && getTime(task.dueDate) >= now.getTime())
    .sort((left, right) => getTime(left.dueDate) - getTime(right.dueDate))
    .slice(0, 3);

  return (
    <WidgetShell title="Моя нагрузка" icon={<UserRound className="h-4 w-4 shrink-0 text-primary" />}>
      {isLoading ? <LoadingRows /> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <div className="text-xs text-muted-foreground">активные</div>
              <div className="text-xl font-bold">{active}</div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <div className="text-xs text-muted-foreground">просрочено</div>
              <div className="text-xl font-bold text-red-500">{overdue}</div>
            </div>
          </div>
          {upcoming.length === 0 ? <EmptyState text="Ближайших назначенных задач нет" /> : upcoming.map((task) => (
            <div key={`${task.source}:${task.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <span className="truncate text-sm font-medium">{task.taskTitle || "Задача"}</span>
              <Badge variant="outline" className="shrink-0 rounded-full">{formatShortDate(task.dueDate)}</Badge>
            </div>
          ))}
        </>
      )}
    </WidgetShell>
  );
}

export function EquipmentAttentionWidget() {
  const equipmentOnProjectsQuery = useQuery<any[]>({ queryKey: ["/api/equipment-on-projects"], retry: 1, refetchInterval: 15000 });
  const checkoutRequestsQuery = useQuery<any[]>({ queryKey: ["/api/equipment-checkout-requests"], retry: 1, refetchInterval: 15000 });
  const now = new Date();
  const overdueReturns = (equipmentOnProjectsQuery.data ?? []).filter((item) =>
    isOperationalEquipmentAssignment(item) && getTime(item.returnDate) < now.getTime(),
  );
  const pendingRequests = (checkoutRequestsQuery.data ?? []).filter((request) => String(request.status || "pending") === "pending");

  return (
    <WidgetShell title="Оборудование требует внимания" tone="amber" icon={<PackageCheck className="h-4 w-4 shrink-0 text-amber-500" />}>
      {equipmentOnProjectsQuery.isLoading || checkoutRequestsQuery.isLoading ? <LoadingRows count={2} /> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <div className="text-xs text-muted-foreground">возврат просрочен</div>
              <div className="text-xl font-bold text-red-500">{overdueReturns.length}</div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <div className="text-xs text-muted-foreground">заявки ждут</div>
              <div className="text-xl font-bold text-amber-500">{pendingRequests.length}</div>
            </div>
          </div>
          {overdueReturns.slice(0, 3).map((item) => (
            <div key={`${item.equipmentId}:${item.projectId}`} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm">
              <div className="truncate font-medium">{item.projectName || "Проект"}</div>
              <div className="text-xs text-muted-foreground">вернуть: {formatShortDate(item.returnDate)}</div>
            </div>
          ))}
        </>
      )}
    </WidgetShell>
  );
}

export function UpcomingEventsWidget({ events = [] }: { events?: any[] }) {
  const now = new Date();
  const upcoming = [...events]
    .filter((event) => getTime(event.startTime) >= now.getTime())
    .sort((left, right) => getTime(left.startTime) - getTime(right.startTime))
    .slice(0, 5);

  return (
    <WidgetShell title="Ближайшие события" icon={<CalendarClock className="h-4 w-4 shrink-0 text-blue-500" />}>
      {upcoming.length === 0 ? <EmptyState text="Ближайших событий нет" /> : upcoming.map((event) => (
        <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{event.title || "Событие"}</div>
            <div className="truncate text-xs text-muted-foreground">{event.location || "Без локации"}</div>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-full">{formatShortDate(event.startTime)}</Badge>
        </div>
      ))}
    </WidgetShell>
  );
}

export function AttentionSummaryWidget() {
  const { tasks } = useTaskSources();
  const equipmentOnProjectsQuery = useQuery<any[]>({ queryKey: ["/api/equipment-on-projects"], retry: 1, refetchInterval: 15000 });
  const checkoutRequestsQuery = useQuery<any[]>({ queryKey: ["/api/equipment-checkout-requests"], retry: 1, refetchInterval: 15000 });
  const now = new Date();
  const overdueTasks = tasks.filter((task) => isOverdue(task, now)).length;
  const overdueReturns = (equipmentOnProjectsQuery.data ?? []).filter((item) =>
    isOperationalEquipmentAssignment(item) && getTime(item.returnDate) < now.getTime(),
  ).length;
  const pendingRequests = (checkoutRequestsQuery.data ?? []).filter((request) => String(request.status || "pending") === "pending").length;

  return (
    <WidgetShell title="Требует внимания" tone="danger" icon={<AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2 text-center">
          <div className="text-lg font-bold text-red-500">{overdueTasks}</div>
          <div className="text-[11px] text-muted-foreground">задачи</div>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-center">
          <div className="text-lg font-bold text-amber-500">{overdueReturns}</div>
          <div className="text-[11px] text-muted-foreground">возврат</div>
        </div>
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-2 text-center">
          <div className="text-lg font-bold text-blue-500">{pendingRequests}</div>
          <div className="text-[11px] text-muted-foreground">заявки</div>
        </div>
      </div>
      {overdueTasks + overdueReturns + pendingRequests === 0 && <EmptyState text="Критичных пунктов нет" />}
    </WidgetShell>
  );
}

export function ActiveProjectsWidget() {
  const projectsQuery = useQuery<any[]>({ queryKey: ["/api/projects"], retry: 1, staleTime: 30_000 });
  const cardsQuery = useQuery<any[]>({
    queryKey: ["/api/kanban/cards"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/kanban/cards");
      return response.json();
    },
    retry: 1,
    refetchInterval: 15000,
  });

  const rows = (projectsQuery.data ?? []).slice(0, 5).map((project) => {
    const cards = (cardsQuery.data ?? []).filter((card) => String(card.projectId || "") === String(project.id));
    const done = cards.filter(isComplete).length;
    const total = cards.length;
    return { project, total, done, percent: Math.round((done / Math.max(total, 1)) * 100) };
  });

  return (
    <WidgetShell title="Проекты в работе" tone="green" icon={<BriefcaseBusiness className="h-4 w-4 shrink-0 text-emerald-500" />}>
      {projectsQuery.isLoading || cardsQuery.isLoading ? <LoadingRows /> : rows.length === 0 ? <EmptyState text="Проектов пока нет" /> : rows.map((row) => (
        <div key={row.project.id} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{row.project.name || "Проект"}</span>
            <Badge variant="outline" className="shrink-0 rounded-full">{row.percent}%</Badge>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.percent}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{row.done}/{row.total} задач готово</div>
        </div>
      ))}
    </WidgetShell>
  );
}
