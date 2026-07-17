import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useRealtimeSubscriptions } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type TaskStats = {
  source: {
    type: "kanban-v2";
    boardIds: string[];
  };
  total: number;
  done: number;
  byStatus: Record<string, number>;
  statusNames: Record<string, string>;
  tasks: {
    total: number;
    active: number;
    inProgress: number;
    completed: number;
    overdue: number;
    unassigned: number;
    deadlines: {
      overdue: number;
      dueSoon: number;
      future: number;
      noDeadline: number;
    };
  };
  assignees: Array<{
    userId: string;
    name: string;
    total: number;
    active: number;
    completed: number;
    overdue: number;
  }>;
  locations: {
    total: number;
    active: number;
    archived: number;
    unresolvedIssues: number;
    bySeverity: Record<string, number>;
    items: Array<{
      id: string;
      name: string;
      archived: boolean;
      unresolvedIssues: number;
    }>;
  };
  equipment: {
    total: number;
    linked: number;
    requested: number;
    approved: number;
    issued: number;
    returned: number;
    overdue: number;
    brokenOrRepair: number;
    items: Array<{
      id: string;
      name: string;
      model?: string | null;
      linked: boolean;
      workflowStatus?: "requested" | "approved" | "issued" | "returned" | "overdue" | null;
      brokenOrRepair: boolean;
    }>;
  };
};

interface ProjectTaskStatsProps {
  projectId: string;
  companyId?: string | null;
  onClose: () => void;
}

export function ProjectTaskStats({ projectId, companyId, onClose }: ProjectTaskStatsProps) {
  const { data: stats, isLoading } = useQuery<TaskStats>({
    queryKey: ["/api/projects", projectId, "task-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/task-stats`);
      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  useRealtimeSubscriptions(
    companyId ? [`company:${companyId}`] : [`project:${projectId}:comments`],
    (message) => {
      if (message.type === "discussion_event" || message.type === "realtime_reconnected") {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "task-stats"] });
      }
    },
  );

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const { total, done, byStatus, statusNames, tasks, assignees, locations, equipment } = stats;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const boardId = stats.source.boardIds[0] || "";
  const boardHref = boardId ? `/tasks?boardId=${encodeURIComponent(boardId)}` : "/tasks";
  const taskMetrics = [
    { label: "Всего", value: tasks.total },
    { label: "Активные", value: tasks.active },
    { label: "В работе", value: tasks.inProgress },
    { label: "Готово", value: tasks.completed },
    { label: "Просрочено", value: tasks.overdue, danger: tasks.overdue > 0 },
    { label: "Без исполнителя", value: tasks.unassigned, danger: tasks.unassigned > 0 },
  ];
  const deadlineMetrics = [
    { label: "Просрочено", value: tasks.deadlines.overdue, danger: tasks.deadlines.overdue > 0 },
    { label: "Ближайшие 7 дней", value: tasks.deadlines.dueSoon },
    { label: "Позже", value: tasks.deadlines.future },
    { label: "Без срока", value: tasks.deadlines.noDeadline },
  ];
  const equipmentMetrics = [
    { label: "Всего", value: equipment.total },
    { label: "Связано", value: equipment.linked },
    { label: "Запрошено", value: equipment.requested },
    { label: "Подтверждено", value: equipment.approved },
    { label: "Выдано", value: equipment.issued },
    { label: "Возвращено", value: equipment.returned },
    { label: "Просрочено", value: equipment.overdue, danger: equipment.overdue > 0 },
    { label: "Неисправно / ремонт", value: equipment.brokenOrRepair, danger: equipment.brokenOrRepair > 0 },
  ];
  const workflowLabels: Record<string, string> = {
    requested: "Запрошено",
    approved: "Подтверждено",
    issued: "Выдано",
    returned: "Возвращено",
    overdue: "Просрочено",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Источник: выделенная доска Kanban V2</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Сводка пересчитывается из карточек, площадок и складских связей проекта.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link href={boardHref}>Открыть задачи</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Задачи</h3>
            <p className="text-xs text-muted-foreground">Текущая готовность и риски по Kanban V2.</p>
          </div>
          <Badge variant="outline">{percent}% готово</Badge>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Progress value={percent} className="h-3 rounded-full" />
          <p className="mt-2 text-xs text-muted-foreground">
            {total > 0 ? `${done} из ${total} задач выполнено` : "На доске проекта пока нет карточек"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {taskMetrics.map((metric) => (
            <Link
              key={metric.label}
              href={boardHref}
              className={cn(
                "rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/30",
                metric.danger && "border-red-500/35 bg-red-500/5",
              )}
            >
              <div className="text-xs text-muted-foreground">{metric.label}</div>
              <div className={cn("mt-1 text-2xl font-semibold", metric.danger && "text-red-500")}>
                {metric.value}
              </div>
            </Link>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">Сроки активных задач</p>
            <div className="grid grid-cols-2 gap-2">
              {deadlineMetrics.map((metric) => (
                <Link
                  key={metric.label}
                  href={boardHref}
                  className={cn(
                    "rounded-lg border border-border/60 bg-muted/20 p-3 hover:bg-muted/40",
                    metric.danger && "border-red-500/35 text-red-500",
                  )}
                >
                  <div className="text-xs text-muted-foreground">{metric.label}</div>
                  <div className="mt-1 text-xl font-semibold">{metric.value}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">Колонки</p>
            {Object.keys(byStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет данных по колонкам.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byStatus)
                  .sort((left, right) => right[1] - left[1])
                  .map(([status, count]) => (
                    <Link
                      key={status}
                      href={boardHref}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <span className="truncate text-muted-foreground">{statusNames[status] || status}</span>
                      <span className="font-medium">{count}</span>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Нагрузка участников</h3>
          <p className="text-xs text-muted-foreground">Включены участники проекта и текущей доски.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          {assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground">У проекта пока нет доступных участников.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {assignees.map((assignee) => (
                <Link
                  key={assignee.userId}
                  href={boardHref}
                  className="rounded-lg border border-border/60 p-3 hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{assignee.name}</span>
                    <Badge variant="secondary">{assignee.total}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <span>Активно: {assignee.active}</span>
                    <span>· Готово: {assignee.completed}</span>
                    {assignee.overdue > 0 && <span className="text-red-500">· Просрочено: {assignee.overdue}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Площадки</h3>
            <p className="text-xs text-muted-foreground">Прямые связи проекта и площадки карточек.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href="/locations">Открыть площадки</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Всего", locations.total],
            ["Активные", locations.active],
            ["Архив", locations.archived],
            ["Открытые проблемы", locations.unresolvedIssues],
          ].map(([label, value]) => (
            <Link
              key={String(label)}
              href="/locations"
              className="rounded-xl border border-border bg-card p-3 hover:bg-muted/30"
            >
              <div className="text-xs text-muted-foreground">{label}</div>
              <div
                className={cn(
                  "mt-1 text-2xl font-semibold",
                  label === "Открытые проблемы" && Number(value) > 0 && "text-amber-500",
                )}
              >
                {value}
              </div>
            </Link>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["critical", "high", "medium", "low"] as const).map((severity) => (
              <Badge
                key={severity}
                variant={severity === "critical" || severity === "high" ? "destructive" : "outline"}
              >
                {severity}: {locations.bySeverity[severity] || 0}
              </Badge>
            ))}
          </div>
          {locations.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">К проекту пока не привязаны площадки.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {locations.items.map((location) => (
                <Link
                  key={location.id}
                  href="/locations"
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{location.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {location.archived ? "Архивная" : "Активная"} · проблем: {location.unresolvedIssues}
                    </div>
                  </div>
                  {location.unresolvedIssues > 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Оборудование</h3>
            <p className="text-xs text-muted-foreground">Уникальные позиции без повторного подсчёта связей.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href="/equipment">Открыть склад</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {equipmentMetrics.map((metric) => (
            <Link
              key={metric.label}
              href="/equipment"
              className={cn(
                "rounded-xl border border-border bg-card p-3 hover:bg-muted/30",
                metric.danger && "border-red-500/35 bg-red-500/5",
              )}
            >
              <div className="text-xs text-muted-foreground">{metric.label}</div>
              <div className={cn("mt-1 text-2xl font-semibold", metric.danger && "text-red-500")}>
                {metric.value}
              </div>
            </Link>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          {equipment.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">У проекта пока нет связанного оборудования.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {equipment.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/equipment?equipmentId=${encodeURIComponent(item.id)}`}
                  className="rounded-lg border border-border/60 p-3 hover:bg-muted/30"
                >
                  <div className="truncate text-sm font-medium">
                    {[item.name, item.model].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.linked && <Badge variant="outline">Связано</Badge>}
                    {item.workflowStatus && (
                      <Badge variant={item.workflowStatus === "overdue" ? "destructive" : "secondary"}>
                        {workflowLabels[item.workflowStatus]}
                      </Badge>
                    )}
                    {item.brokenOrRepair && <Badge variant="destructive">Неисправно / ремонт</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Button variant="outline" size="sm" onClick={onClose} className="w-full rounded-xl">
        Закрыть
      </Button>
    </div>
  );
}
