import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  Package,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASHBOARD_WIDGET_CARD_CLASS,
  DASHBOARD_WIDGET_EMPTY_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
  DASHBOARD_WIDGET_WARNING_CLASS,
} from "@/components/dashboard/dashboard-styles";
import { apiRequest } from "@/lib/queryClient";
import {
  buildActiveProjectRows,
  buildEquipmentForTaskRows,
  buildTeamWorkloadRows,
  buildUnassignedTaskRows,
  buildUpcomingReturnRows,
} from "@/lib/dashboard-operational";

function formatShortDate(value: unknown) {
  if (!value) return "без срока";
  const date = new Date(value as string | Date);
  if (!Number.isFinite(date.getTime())) return "без срока";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OperationalWidgetShell({
  title,
  icon,
  href,
  tone = "default",
  isRefreshing,
  onRefresh,
  children,
}: {
  title: string;
  icon: ReactNode;
  href: string;
  tone?: "default" | "danger" | "amber" | "green";
  isRefreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <Card className={DASHBOARD_WIDGET_CARD_CLASS} data-tone={tone}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <CardTitle className="truncate text-sm font-semibold text-foreground">{title}</CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link href={href} className="px-1 text-xs text-primary hover:underline">Все</Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={`Обновить ${title}`}
          >
            <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
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
    <div className={DASHBOARD_WIDGET_EMPTY_CLASS}>
      {text}
    </div>
  );
}

function ErrorState() {
  return (
    <div className={DASHBOARD_WIDGET_WARNING_CLASS}>
      Не удалось обновить данные. Показаны последние доступные значения.
    </div>
  );
}

function useKanbanCards() {
  return useQuery<any[]>({
    queryKey: ["/api/kanban/cards"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/kanban/cards");
      return response.json();
    },
    retry: 1,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
}

export function ActiveProjectsOperationalWidget() {
  const projectsQuery = useQuery<any[]>({
    queryKey: ["/api/projects"],
    retry: 1,
    refetchInterval: 30_000,
  });
  const cardsQuery = useKanbanCards();
  const rows = useMemo(
    () => buildActiveProjectRows(projectsQuery.data ?? [], cardsQuery.data ?? []),
    [cardsQuery.data, projectsQuery.data],
  );
  const refresh = () => {
    projectsQuery.refetch();
    cardsQuery.refetch();
  };

  return (
    <OperationalWidgetShell
      title="Активные проекты"
      icon={<BriefcaseBusiness className="h-4 w-4 shrink-0 text-success" />}
      href="/projects"
      tone="green"
      isRefreshing={projectsQuery.isFetching || cardsQuery.isFetching}
      onRefresh={refresh}
    >
      {(projectsQuery.isError || cardsQuery.isError) && <ErrorState />}
      {projectsQuery.isLoading || cardsQuery.isLoading ? <LoadingRows /> : rows.length === 0 ? (
        <EmptyState text="Активных проектов пока нет" />
      ) : rows.map((row) => (
        <Link
          key={row.id}
          href="/projects"
          className={row.atRisk
            ? "block rounded-control border border-warning/35 bg-warning-muted px-3 py-2 transition hover:bg-warning/10"
            : `block px-3 py-2 transition hover:bg-muted/40 ${DASHBOARD_WIDGET_ROW_CLASS}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{row.name}</span>
            <div className="flex shrink-0 items-center gap-1">
              {row.blocked && <Badge variant="destructive" className="rounded-full">Блок</Badge>}
              {row.overdue > 0 && <Badge variant="outline" className="rounded-full border-warning/50 text-warning">{row.overdue} проср.</Badge>}
              <Badge variant="outline" className="rounded-full">{row.percent}%</Badge>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success" style={{ width: `${row.percent}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{row.completed}/{row.total} карточек готово</div>
        </Link>
      ))}
    </OperationalWidgetShell>
  );
}

function useBoardEquipmentLinks(cards: any[]) {
  const boardIds = useMemo(
    () => Array.from(new Set(cards.map((card) => String(card.boardId || "")).filter(Boolean))).sort(),
    [cards],
  );
  return useQuery<Record<string, any[]>>({
    queryKey: ["/api/dashboard/kanban-equipment-links", boardIds.join(",")],
    enabled: boardIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(boardIds.map(async (boardId) => {
        const response = await apiRequest("GET", `/api/kanban/boards/${boardId}/equipment-links`);
        return response.json();
      }));
      return responses.reduce<Record<string, any[]>>((result, response) => {
        for (const [cardId, rows] of Object.entries(response?.cards ?? {})) {
          result[cardId] = Array.isArray(rows) ? rows : [];
        }
        return result;
      }, {});
    },
    retry: 1,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
}

export function EquipmentForTasksWidget({ user }: { user?: any }) {
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const cardsQuery = useKanbanCards();
  const linksQuery = useBoardEquipmentLinks(cardsQuery.data ?? []);
  const rows = useMemo(
    () => buildEquipmentForTaskRows(cardsQuery.data ?? [], linksQuery.data ?? {}, {
      scope,
      userId: String(user?.id || ""),
      limit: 5,
    }),
    [cardsQuery.data, linksQuery.data, scope, user?.id],
  );
  const refresh = () => {
    cardsQuery.refetch();
    linksQuery.refetch();
  };

  return (
    <OperationalWidgetShell
      title="Оборудование текущих задач"
      icon={<Package className="h-4 w-4 shrink-0 text-primary" />}
      href="/tasks-v2"
      isRefreshing={cardsQuery.isFetching || linksQuery.isFetching}
      onRefresh={refresh}
    >
      <div className="flex items-center justify-end">
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value as "mine" | "team")}
          className="h-7 rounded-control border border-input/60 bg-surface-raised px-2 text-xs"
          aria-label="Область задач для оборудования"
        >
          <option value="mine">Мои задачи</option>
          <option value="team">Команда</option>
        </select>
      </div>
      {(cardsQuery.isError || linksQuery.isError) && <ErrorState />}
      {cardsQuery.isLoading || linksQuery.isLoading ? <LoadingRows /> : rows.length === 0 ? (
        <EmptyState text="К активным задачам оборудование не прикреплено" />
      ) : rows.map((row) => (
        <Link
          key={row.id}
          href={`/tasks-v2?boardId=${encodeURIComponent(row.boardId)}&cardId=${encodeURIComponent(row.cardId)}`}
          className={`flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-muted/40 ${DASHBOARD_WIDGET_ROW_CLASS}`}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{row.equipmentName}</div>
            <div className="truncate text-xs text-muted-foreground">{row.cardTitle}</div>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-full">{row.workflowStatus}</Badge>
        </Link>
      ))}
    </OperationalWidgetShell>
  );
}

export function UpcomingReturnsOperationalWidget() {
  const assignmentsQuery = useQuery<any[]>({
    queryKey: ["/api/equipment-on-projects"],
    retry: 1,
    refetchInterval: 15_000,
  });
  const equipmentQuery = useQuery<any[]>({
    queryKey: ["/api/equipment"],
    retry: 1,
    refetchInterval: 15_000,
  });
  const rows = useMemo(
    () => buildUpcomingReturnRows(assignmentsQuery.data ?? [], equipmentQuery.data ?? []),
    [assignmentsQuery.data, equipmentQuery.data],
  );
  const refresh = () => {
    assignmentsQuery.refetch();
    equipmentQuery.refetch();
  };

  return (
    <OperationalWidgetShell
      title="Ближайшие возвраты"
      icon={<CalendarClock className="h-4 w-4 shrink-0 text-warning" />}
      href="/equipment"
      tone="amber"
      isRefreshing={assignmentsQuery.isFetching || equipmentQuery.isFetching}
      onRefresh={refresh}
    >
      {(assignmentsQuery.isError || equipmentQuery.isError) && <ErrorState />}
      {assignmentsQuery.isLoading || equipmentQuery.isLoading ? <LoadingRows /> : rows.length === 0 ? (
        <EmptyState text="Ожидаемых возвратов нет" />
      ) : rows.map((row) => (
        <Link
          key={row.id}
          href="/equipment"
          className={row.overdue
            ? "flex items-center justify-between gap-3 rounded-control border border-error/35 bg-error-muted px-3 py-2"
            : `flex items-center justify-between gap-3 px-3 py-2 ${DASHBOARD_WIDGET_ROW_CLASS}`}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{row.equipmentName}</div>
            <div className="truncate text-xs text-muted-foreground">{row.projectName}</div>
          </div>
          <Badge variant={row.overdue ? "destructive" : "outline"} className="shrink-0 rounded-full">
            {row.overdue ? "Просрочено" : formatShortDate(row.returnDate)}
          </Badge>
        </Link>
      ))}
    </OperationalWidgetShell>
  );
}

export function UnassignedTasksWidget() {
  const cardsQuery = useKanbanCards();
  const rows = useMemo(() => buildUnassignedTaskRows(cardsQuery.data ?? []), [cardsQuery.data]);

  return (
    <OperationalWidgetShell
      title="Задачи без исполнителя"
      icon={<UserRoundCheck className="h-4 w-4 shrink-0 text-warning" />}
      href="/tasks-v2"
      tone="amber"
      isRefreshing={cardsQuery.isFetching}
      onRefresh={() => cardsQuery.refetch()}
    >
      {cardsQuery.isError && <ErrorState />}
      {cardsQuery.isLoading ? <LoadingRows /> : rows.length === 0 ? (
        <EmptyState text="Все активные карточки назначены" />
      ) : rows.map((row) => (
        <Link
          key={row.id}
          href={`/tasks-v2?boardId=${encodeURIComponent(row.boardId)}&cardId=${encodeURIComponent(row.id)}`}
          className={`flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-muted/40 ${DASHBOARD_WIDGET_ROW_CLASS}`}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{row.title}</div>
            <div className="truncate text-xs text-muted-foreground">{row.boardName}</div>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-full">{formatShortDate(row.dueDate)}</Badge>
        </Link>
      ))}
    </OperationalWidgetShell>
  );
}

export function TeamWorkloadOperationalWidget() {
  const cardsQuery = useKanbanCards();
  const usersQuery = useQuery<any[]>({
    queryKey: ["/api/users"],
    retry: 1,
    staleTime: 30_000,
  });
  const rows = useMemo(
    () => buildTeamWorkloadRows(cardsQuery.data ?? [], usersQuery.data ?? []),
    [cardsQuery.data, usersQuery.data],
  );
  const refresh = () => {
    cardsQuery.refetch();
    usersQuery.refetch();
  };

  return (
    <OperationalWidgetShell
      title="Нагрузка команды"
      icon={<UsersRound className="h-4 w-4 shrink-0 text-primary" />}
      href="/tasks-v2"
      isRefreshing={cardsQuery.isFetching || usersQuery.isFetching}
      onRefresh={refresh}
    >
      {(cardsQuery.isError || usersQuery.isError) && <ErrorState />}
      {cardsQuery.isLoading || usersQuery.isLoading ? <LoadingRows /> : rows.length === 0 ? (
        <EmptyState text="Назначенных активных карточек нет" />
      ) : rows.map((row) => (
        <div key={row.userId} className={`flex items-center justify-between gap-3 px-3 py-2 ${DASHBOARD_WIDGET_ROW_CLASS}`}>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{row.name}</div>
            <div className="text-xs text-muted-foreground">Активных: {row.active}</div>
          </div>
          {row.overdue > 0 ? (
            <Badge variant="destructive" className="shrink-0 rounded-full">
              <AlertTriangle className="mr-1 h-3 w-3" /> {row.overdue}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 rounded-full">В срок</Badge>
          )}
        </div>
      ))}
    </OperationalWidgetShell>
  );
}
