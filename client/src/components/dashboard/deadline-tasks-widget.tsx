import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASHBOARD_WIDGET_EMPTY_CLASS,
  DASHBOARD_WIDGET_ENTITY_LINK_CLASS,
  DASHBOARD_WIDGET_ERROR_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
  DASHBOARD_WIDGET_SCROLL_CARD_CLASS,
  DASHBOARD_WIDGET_SCROLL_CONTENT_CLASS,
} from "@/components/dashboard/dashboard-styles";
import { useDeadlineNow } from "@/hooks/use-deadline-now";
import { apiRequest } from "@/lib/queryClient";
import { getKanbanCardHref } from "@/lib/entity-navigation";
import {
  getTaskDeadlineTimestamp,
  isTaskDeadlineOverdue,
} from "@shared/task-deadlines";

interface DeadlineTask {
  id: string;
  title: string;
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  priority?: string | null;
  completed: boolean;
  subtitle?: string;
  href: string;
}

const COMPLETE_KANBAN_LIST_TYPES = new Set(["closed", "archive", "trash"]);
const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getDueTime(value: unknown) {
  return getTaskDeadlineTimestamp(value as string | Date | null) ?? Number.POSITIVE_INFINITY;
}

function isOverdue(task: DeadlineTask, now: Date) {
  return isTaskDeadlineOverdue(task.dueDate, { isComplete: task.completed, now });
}

function compareDeadlineTasks(left: DeadlineTask, right: DeadlineTask, now: Date) {
  const leftOverdue = isOverdue(left, now);
  const rightOverdue = isOverdue(right, now);
  if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;

  const leftDue = getDueTime(left.dueDate);
  const rightDue = getDueTime(right.dueDate);
  if (leftDue !== rightDue) return leftDue - rightDue;

  const leftPriority = PRIORITY_WEIGHT[String(left.priority || "medium")] ?? 2;
  const rightPriority = PRIORITY_WEIGHT[String(right.priority || "medium")] ?? 2;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  return getDueTime(left.createdAt) - getDueTime(right.createdAt);
}

function formatDueDate(value: unknown) {
  if (!value) return "Без срока";
  const date = new Date(value as string | Date);
  if (!Number.isFinite(date.getTime())) return "Без срока";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeadlineTasksWidget({ limit = 5 }: { limit?: number }) {
  const now = useDeadlineNow();
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

  const allActiveTasks = useMemo<DeadlineTask[]>(() => {
    const kanbanTasks = (cardsQuery.data ?? []).map((card) => ({
      id: `card:${card.id}`,
      title: String(card.title || "Карточка"),
      dueDate: card.dueDate,
      createdAt: card.createdAt,
      priority: card.priority,
      completed: COMPLETE_KANBAN_LIST_TYPES.has(String(card.listType || "")),
      subtitle: [card.boardName, card.listName].filter(Boolean).join(" · "),
      href: getKanbanCardHref(card.boardId, card.id),
    }));

    return kanbanTasks
      .filter((task) => !task.completed)
      .sort((left, right) => compareDeadlineTasks(left, right, now));
  }, [cardsQuery.data, now]);
  const tasks = allActiveTasks.slice(0, limit);

  const isLoading = cardsQuery.isLoading;
  const hasError = cardsQuery.isError;

  return (
    <Card className={DASHBOARD_WIDGET_SCROLL_CARD_CLASS}>
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock className="h-4 w-4 shrink-0 text-warning" />
          <CardTitle className="truncate text-sm font-semibold text-foreground">Задачи по срокам</CardTitle>
        </div>
        {hasError && <Badge variant="outline" className="rounded-full text-warning">Ошибка обновления</Badge>}
      </CardHeader>
      <CardContent className={`${DASHBOARD_WIDGET_SCROLL_CONTENT_CLASS} space-y-2 px-3 pb-3 pt-0`}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/60" />
          ))
        ) : tasks.length === 0 ? (
          <div className={`${DASHBOARD_WIDGET_EMPTY_CLASS} py-5`}>
            Активных задач со сроками пока нет
          </div>
        ) : (
          tasks.map((task) => {
            const overdue = isOverdue(task, now);
            const hasDeadline = Number.isFinite(getDueTime(task.dueDate));
            return (
              <Link
                key={task.id}
                href={task.href}
                className={overdue
                  ? `block ${DASHBOARD_WIDGET_ERROR_CLASS} ${DASHBOARD_WIDGET_ENTITY_LINK_CLASS} text-foreground`
                  : `block px-3 py-2 ${DASHBOARD_WIDGET_ROW_CLASS} ${DASHBOARD_WIDGET_ENTITY_LINK_CLASS}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{task.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{task.subtitle}</div>
                  </div>
                  <Badge variant={overdue ? "destructive" : "outline"} className="shrink-0 rounded-full">
                    {overdue ? (
                      <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Просрочено</span>
                    ) : hasDeadline ? (
                      formatDueDate(task.dueDate)
                    ) : (
                      "Без срока"
                    )}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Приоритет: {task.priority || "medium"}</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Kanban</span>
                </div>
              </Link>
            );
          })
        )}
        {!isLoading && allActiveTasks.length > limit && (
          <div className="text-right text-xs text-muted-foreground">
            Показано {tasks.length} из {allActiveTasks.length}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
