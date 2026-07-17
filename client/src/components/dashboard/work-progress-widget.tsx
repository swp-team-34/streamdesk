import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock3, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StreamSelect } from "@/components/ui/stream-select";
import {
  DASHBOARD_WIDGET_EMPTY_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
  DASHBOARD_WIDGET_SCROLL_CARD_CLASS,
  DASHBOARD_WIDGET_SCROLL_CONTENT_CLASS,
  DASHBOARD_WIDGET_WARNING_CLASS,
} from "@/components/dashboard/dashboard-styles";
import { useDeadlineNow } from "@/hooks/use-deadline-now";
import { apiRequest } from "@/lib/queryClient";
import { isTaskDeadlineOverdue } from "@shared/task-deadlines";

type GroupMode = "assignee" | "location" | "tags";

interface WorkItem {
  id: string;
  title: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  priority?: string | null;
  completed: boolean;
  inProgress: boolean;
  location?: string | null;
  tags: string[];
}

interface GroupSummary {
  key: string;
  label: string;
  active: number;
  completed: number;
  overdue: number;
  inProgress: number;
}

const COMPLETE_LEGACY_STATUSES = new Set(["done", "completed", "cancelled"]);
const IN_PROGRESS_LEGACY_STATUSES = new Set(["in_progress", "review"]);
const COMPLETE_KANBAN_LIST_TYPES = new Set(["closed", "archive", "trash"]);
const LOCATION_KEYS = ["location", "мест", "локац", "студ", "room", "zone"];

function isOverdue(item: WorkItem, now: Date) {
  return isTaskDeadlineOverdue(item.dueDate, { isComplete: item.completed, now });
}

function readLocationFromCustomFields(values: unknown) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return "";
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (!LOCATION_KEYS.some((marker) => normalizedKey.includes(marker))) continue;
    const normalizedValue = String(value ?? "").trim();
    if (normalizedValue) return normalizedValue;
  }
  return "";
}

function normalizeTag(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.name || record.title || record.label || record.id || "").trim();
  }
  return String(value ?? "").trim();
}

function buildGroups(items: WorkItem[], mode: GroupMode, now: Date): GroupSummary[] {
  const groups = new Map<string, GroupSummary>();

  const addItem = (key: string, label: string, item: WorkItem) => {
    const safeKey = key || "empty";
    const current = groups.get(safeKey) ?? {
      key: safeKey,
      label: label || "Без значения",
      active: 0,
      completed: 0,
      overdue: 0,
      inProgress: 0,
    };
    if (!item.completed) current.active += 1;
    if (item.completed) current.completed += 1;
    if (item.inProgress) current.inProgress += 1;
    if (isOverdue(item, now)) current.overdue += 1;
    groups.set(safeKey, current);
  };

  for (const item of items) {
    if (mode === "assignee") {
      addItem(item.assigneeId || "unassigned", item.assigneeName || "Без исполнителя", item);
      continue;
    }
    if (mode === "location") {
      addItem(item.location || "no-location", item.location || "Без локации", item);
      continue;
    }
    const tags = item.tags.length > 0 ? item.tags : ["Без тегов"];
    for (const tag of tags) addItem(tag, tag, item);
  }

  return Array.from(groups.values())
    .sort((left, right) => right.overdue - left.overdue || right.active - left.active || left.label.localeCompare(right.label, "ru"))
    .slice(0, 6);
}

export default function WorkProgressWidget() {
  const [groupMode, setGroupMode] = useState<GroupMode>("assignee");
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

  const tasksQuery = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    retry: 1,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const usersQuery = useQuery<Array<{ id: string; name?: string | null; username?: string | null }>>({
    queryKey: ["/api/users"],
    retry: 1,
    staleTime: 60_000,
  });

  const userById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  );

  const items = useMemo<WorkItem[]>(() => {
    const kanbanItems = (cardsQuery.data ?? []).map((card) => {
      const completed = COMPLETE_KANBAN_LIST_TYPES.has(String(card.listType || ""));
      const labelIds = Array.isArray(card.labelIds) ? card.labelIds.map(normalizeTag).filter(Boolean) : [];
      const assignee = card.assigneeUserId ? userById.get(String(card.assigneeUserId)) : undefined;
      return {
        id: `card:${card.id}`,
        title: String(card.title || "Карточка"),
        assigneeId: card.assigneeUserId || null,
        assigneeName: assignee?.name || assignee?.username || (card.assigneeUserId ? String(card.assigneeUserId) : null),
        dueDate: card.dueDate,
        createdAt: card.createdAt,
        priority: card.priority,
        completed,
        inProgress: !completed && String(card.listType || "active") === "active",
        location: readLocationFromCustomFields(card.customFieldValues),
        tags: labelIds,
      };
    });

    const legacyItems = (tasksQuery.data ?? []).map((task) => {
      const status = String(task.status || "");
      const completed = COMPLETE_LEGACY_STATUSES.has(status);
      const assignee = task.assigneeId ? userById.get(String(task.assigneeId)) : undefined;
      const tags = Array.isArray(task.tags) ? task.tags.map(normalizeTag).filter(Boolean) : [];
      return {
        id: `task:${task.id}`,
        title: String(task.title || "Задача"),
        assigneeId: task.assigneeId || null,
        assigneeName: assignee?.name || assignee?.username || (task.assigneeId ? String(task.assigneeId) : null),
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        priority: task.priority,
        completed,
        inProgress: IN_PROGRESS_LEGACY_STATUSES.has(status),
        location: "",
        tags,
      };
    });

    return [...kanbanItems, ...legacyItems];
  }, [cardsQuery.data, tasksQuery.data, userById]);

  const active = items.filter((item) => !item.completed).length;
  const completed = items.filter((item) => item.completed).length;
  const overdue = items.filter((item) => isOverdue(item, now)).length;
  const inProgress = items.filter((item) => item.inProgress).length;
  const groups = buildGroups(items, groupMode, now);
  const isLoading = cardsQuery.isLoading || tasksQuery.isLoading;
  const hasError = cardsQuery.isError || tasksQuery.isError;

  return (
    <Card className={DASHBOARD_WIDGET_SCROLL_CARD_CLASS}>
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-primary" />
          <CardTitle className="truncate text-sm font-semibold text-foreground">Ход работ</CardTitle>
        </div>
        <StreamSelect
          ariaLabel="Группировка хода работ"
          value={groupMode}
          options={[
            { value: "assignee", label: "По сотрудникам" },
            { value: "location", label: "По локациям" },
            { value: "tags", label: "По тегам" },
          ]}
          onValueChange={(value) => setGroupMode(value as GroupMode)}
          className="h-8 w-auto min-w-40 px-2 text-xs sm:h-8"
        />
      </CardHeader>
      <CardContent className={`${DASHBOARD_WIDGET_SCROLL_CONTENT_CLASS} space-y-3 px-3 pb-3 pt-0`}>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : (
          <>
            {hasError && (
              <div className={DASHBOARD_WIDGET_WARNING_CLASS}>
                Не удалось обновить часть данных, показаны последние доступные значения.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Активные" value={active} icon={Clock3} />
              <Metric label="В работе" value={inProgress} icon={Activity} />
              <Metric label="Готово" value={completed} icon={CheckCircle2} />
              <Metric label="Просрочено" value={overdue} icon={AlertTriangle} tone="danger" />
            </div>
            <div className="space-y-1.5">
              {groups.length === 0 ? (
                <div className={DASHBOARD_WIDGET_EMPTY_CLASS}>
                  Задач пока нет
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.key} className={`flex items-center justify-between gap-3 px-3 py-2 ${DASHBOARD_WIDGET_ROW_CLASS}`}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{group.label}</div>
                      <div className="text-xs text-muted-foreground">В работе: {group.inProgress} · Готово: {group.completed}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {group.overdue > 0 && <Badge variant="destructive" className="rounded-full">{group.overdue}</Badge>}
                      <Badge variant="outline" className="rounded-full">{group.active}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone?: "danger" }) {
  return (
    <div className={`${DASHBOARD_WIDGET_ROW_CLASS} px-3 py-2`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={tone === "danger" ? "h-4 w-4 text-error" : "h-4 w-4 text-primary"} />
      </div>
      <div className={tone === "danger" ? "mt-1 text-xl font-bold text-error" : "mt-1 text-xl font-bold text-foreground"}>{value}</div>
    </div>
  );
}
