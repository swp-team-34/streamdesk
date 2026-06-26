import { useState, Fragment, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  Users,
  Edit,
  Settings,
  Trash2,
  Check,
  X,
  UserRound,
  Flag,
  FolderOpen,
  Paperclip,
} from "lucide-react";
import { EventForm } from "@/components/forms/event-form";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  setHours,
  setMinutes,
  startOfMonth,
  endOfMonth,
  getISOWeek,
  isWithinInterval,
  addDays,
} from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AuthService } from "@/lib/auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { getDueDateStatus, getDueDateStatusClasses, getDueDateStatusLabel } from "@/lib/task-dates";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  location?: string | null;
  participants?: Array<{ id: string; userId: string; userName?: string; status?: string }>;
  type?: string;
};

type CalendarTask = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  assigneeId?: string | null;
  dueDate?: string | Date | null;
  startDate?: string | Date | null;
  category?: string | null;
  subtasks?: Array<{ id: string; title: string; completed?: boolean }> | null;
  attachments?: Array<{ name?: string; url?: string }> | null;
  links?: Array<{ title?: string; url?: string }> | null;
};

type CalendarKanbanCard = {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  assigneeUserId?: string | null;
  dueDate?: string | Date | null;
  startDate?: string | Date | null;
  listName?: string | null;
  listType?: string | null;
  boardName?: string | null;
};

type CalendarUser = {
  id: string;
  name?: string | null;
  username?: string | null;
};

type EventEntry = CalendarEvent & {
  kind: "event";
  badgeText: string;
  statusLabel: null;
  responsibleLabel: null;
};

type TaskEntry = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  type: "task";
  kind: "task";
  badgeText: string;
  statusLabel: string;
  responsibleLabel: string | null;
  task: CalendarTask;
};

type KanbanEntry = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  type: "kanban";
  kind: "kanban";
  badgeText: string;
  statusLabel: string;
  responsibleLabel: string | null;
  task: CalendarKanbanCard;
};

type CalendarEntry = EventEntry | TaskEntry | KanbanEntry;

const TASK_STATUS_LABELS: Record<string, string> = {
  not_ready: "Бэклог",
  todo: "К выполнению",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово",
  cancelled: "Отменено",
};

const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

const EVENT_COLOR_PALETTES = [
  {
    card: "border-l-rose-400 border-rose-200/80 dark:border-rose-900/70 bg-rose-100/90 dark:bg-rose-950/45 text-rose-950 dark:text-rose-50",
    inline: "border-l-rose-400 border-rose-200/80 dark:border-rose-900/70 bg-rose-100/95 dark:bg-rose-950/55 text-rose-950 dark:text-rose-50",
    dot: "bg-rose-400",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200",
  },
  {
    card: "border-l-sky-400 border-sky-200/80 dark:border-sky-900/70 bg-sky-100/90 dark:bg-sky-950/45 text-sky-950 dark:text-sky-50",
    inline: "border-l-sky-400 border-sky-200/80 dark:border-sky-900/70 bg-sky-100/95 dark:bg-sky-950/55 text-sky-950 dark:text-sky-50",
    dot: "bg-sky-400",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  },
  {
    card: "border-l-emerald-400 border-emerald-200/80 dark:border-emerald-900/70 bg-emerald-100/90 dark:bg-emerald-950/45 text-emerald-950 dark:text-emerald-50",
    inline: "border-l-emerald-400 border-emerald-200/80 dark:border-emerald-900/70 bg-emerald-100/95 dark:bg-emerald-950/55 text-emerald-950 dark:text-emerald-50",
    dot: "bg-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
  {
    card: "border-l-amber-400 border-amber-200/80 dark:border-amber-900/70 bg-amber-100/90 dark:bg-amber-950/45 text-amber-950 dark:text-amber-50",
    inline: "border-l-amber-400 border-amber-200/80 dark:border-amber-900/70 bg-amber-100/95 dark:bg-amber-950/55 text-amber-950 dark:text-amber-50",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  },
  {
    card: "border-l-violet-400 border-violet-200/80 dark:border-violet-900/70 bg-violet-100/90 dark:bg-violet-950/45 text-violet-950 dark:text-violet-50",
    inline: "border-l-violet-400 border-violet-200/80 dark:border-violet-900/70 bg-violet-100/95 dark:bg-violet-950/55 text-violet-950 dark:text-violet-50",
    dot: "bg-violet-400",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
  },
] as const;

function getEventTypeText(type?: string) {
  switch (type) {
    case "task":
      return "Задача";
    case "kanban":
      return "Карточка";
    case "stream":
      return "Стрим";
    case "meeting":
      return "Встреча";
    case "production":
      return "Производство";
    case "maintenance":
      return "Обслуживание";
    case "recording":
      return "Запись";
    default:
      return type || "Событие";
  }
}

function isTaskEntry(entry: CalendarEntry | null): entry is TaskEntry {
  return !!entry && entry.kind === "task";
}

function isKanbanEntry(entry: CalendarEntry | null): entry is KanbanEntry {
  return !!entry && entry.kind === "kanban";
}

export default function Calendar() {
  useWebSocket();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [draftSlot, setDraftSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "day" | "month" | "3days" | "list">("week");
  const [slotSelectStart, setSlotSelectStart] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [slotSelectEnd, setSlotSelectEnd] = useState<{ dayIndex: number; hour: number } | null>(null);
  const { toast } = useToast();
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const threeDaysScrollRef = useRef<HTMLDivElement>(null);

  const { data: events = [], isLoading: isLoadingEvents } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/events"],
  });
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<CalendarTask[]>({
    queryKey: ["/api/tasks"],
  });
  const { data: kanbanCards = [], isLoading: isLoadingKanbanCards } = useQuery<CalendarKanbanCard[]>({
    queryKey: ["/api/kanban/cards"],
  });
  const { data: users = [] } = useQuery<CalendarUser[]>({
    queryKey: ["/api/users"],
  });

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      if (!user?.id) return;
      map.set(user.id, user.name || user.username || "Без имени");
    });
    return map;
  }, [users]);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handleSlotMouseUp = useCallback(() => {
    if (!slotSelectStart) return;
    const end = slotSelectEnd || slotSelectStart;
    const dayStart = weekDays[slotSelectStart.dayIndex];
    const dayEnd = weekDays[end.dayIndex];
    const startTime = setMinutes(setHours(dayStart, slotSelectStart.hour), 0);
    let endTime = setMinutes(setHours(dayEnd, end.hour), 0);
    if (slotSelectStart.dayIndex === end.dayIndex && slotSelectStart.hour === end.hour) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    } else {
      endTime = new Date(endTime.getTime() + 60 * 60 * 1000);
    }
    setDraftSlot({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });
    setSelectedEntry(null);
    setIsFormOpen(true);
    setSlotSelectStart(null);
    setSlotSelectEnd(null);
  }, [slotSelectStart, slotSelectEnd, weekDays]);

  useEffect(() => {
    if (!slotSelectStart) return;
    const onUp = () => handleSlotMouseUp();
    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const dayIdx = target.getAttribute("data-day-index");
      const hourStr = target.getAttribute("data-hour");
      if (dayIdx != null && hourStr != null) {
        setSlotSelectEnd({ dayIndex: parseInt(dayIdx, 10), hour: parseInt(hourStr, 10) });
      }
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousemove", onMove);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousemove", onMove);
    };
  }, [slotSelectStart, handleSlotMouseUp]);

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/events/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.refetchQueries({ queryKey: ["/api/events"] });
      toast({ title: "Успешно", description: "Событие перемещено" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось переместить событие", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/events/${id}`);
      if (!response.ok) throw new Error("Не удалось удалить");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setSelectedEntry(null);
      setIsDetailOpen(false);
      toast({ title: "Событие удалено" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить событие", variant: "destructive" });
    },
  });

  const respondParticipantMutation = useMutation({
    mutationFn: async ({ eventId, participantId, status }: { eventId: string; participantId: string; status: "accepted" | "declined" }) => {
      const response = await apiRequest("PATCH", `/api/events/${eventId}/participants/${participantId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Ответ сохранён" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось сохранить ответ", variant: "destructive" });
    },
  });

  const HOUR_START = 0;
  const HOUR_END = 24;
  const ROW_HEIGHT = 48;
  const threeDays = eachDayOfInterval({ start: selectedDate, end: addDays(selectedDate, 2) });
  const todayColumnIndexWeek = weekDays.findIndex((d) => isSameDay(d, new Date()));
  const todayColumnIndex3 = threeDays.findIndex((d) => isSameDay(d, new Date()));

  useEffect(() => {
    const scrollToCurrentHour = (el: HTMLDivElement | null) => {
      if (!el) return;
      const now = new Date();
      const currentHour = now.getHours() - HOUR_START + now.getMinutes() / 60;
      const scrollTop = Math.max(0, currentHour * ROW_HEIGHT - el.clientHeight / 3);
      el.scrollTo({ top: scrollTop, behavior: "smooth" });
    };
    const t = setTimeout(() => {
      if (viewMode === "week") scrollToCurrentHour(weekScrollRef.current);
      if (viewMode === "3days") scrollToCurrentHour(threeDaysScrollRef.current);
    }, 100);
    return () => clearTimeout(t);
  }, [viewMode]);

  const entries = useMemo<CalendarEntry[]>(() => {
    const taskEntries: TaskEntry[] = tasks
      .filter((task) => task?.dueDate || task?.startDate)
      .map((task) => {
        const startTime = new Date(task.startDate || task.dueDate || new Date());
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const endTime = dueDate && dueDate.getTime() > startTime.getTime()
          ? dueDate
          : new Date(startTime.getTime() + 60 * 60 * 1000);

        return {
          id: `task-${task.id}`,
          title: task.title,
          description: task.description,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          type: "task",
          kind: "task",
          badgeText: "Задача",
          statusLabel: TASK_STATUS_LABELS[String(task.status || "")] || String(task.status || "Без статуса"),
          responsibleLabel: task.assigneeId ? userNameById.get(String(task.assigneeId)) || "Назначен" : null,
          task,
        };
      });

    const kanbanEntries: KanbanEntry[] = kanbanCards
      .filter((card) => card?.dueDate || card?.startDate)
      .map((card) => {
        const startTime = new Date(card.startDate || card.dueDate || new Date());
        const dueDate = card.dueDate ? new Date(card.dueDate) : null;
        const endTime = dueDate && dueDate.getTime() > startTime.getTime()
          ? dueDate
          : new Date(startTime.getTime() + 60 * 60 * 1000);

        return {
          id: `kanban-${card.id}`,
          title: card.title,
          description: card.description,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          type: "kanban",
          kind: "kanban",
          badgeText: "Карточка",
          statusLabel: card.listName || "Список",
          responsibleLabel: card.assigneeUserId ? userNameById.get(String(card.assigneeUserId)) || "Назначен" : null,
          task: card,
        };
      });

    const eventEntries: EventEntry[] = events.map((event) => ({
      ...event,
      kind: "event",
      badgeText: getEventTypeText(event.type),
      statusLabel: null,
      responsibleLabel: null,
    }));

    return [...eventEntries, ...taskEntries, ...kanbanEntries];
  }, [events, kanbanCards, tasks, userNameById]);

  const getEntriesForDate = useCallback((date: Date) => {
    return entries.filter((entry) => {
      if (!entry.startTime) return false;
      try {
        return isSameDay(new Date(entry.startTime), date);
      } catch {
        return false;
      }
    });
  }, [entries]);

  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const weekNumber = getISOWeek(weekStart);
  const now = new Date();
  const showNowLineWeek =
    viewMode === "week" &&
    todayColumnIndexWeek >= 0 &&
    isWithinInterval(now, { start: weekStart, end: weekEnd }) &&
    now.getHours() >= HOUR_START &&
    now.getHours() < HOUR_END;
  const showNowLine3 = viewMode === "3days" && todayColumnIndex3 >= 0 && now.getHours() >= HOUR_START && now.getHours() < HOUR_END;
  const showNowLine = showNowLineWeek || showNowLine3;
  const nowTop = showNowLine ? (now.getHours() - HOUR_START + now.getMinutes() / 60) * ROW_HEIGHT : 0;
  const nowColumnIndex = viewMode === "week" ? todayColumnIndexWeek : todayColumnIndex3;
  const nowColumnCount = viewMode === "week" ? 7 : 3;

  const getEventBlockStyle = (entry: CalendarEntry) => {
    const start = new Date(entry.startTime);
    const end = new Date(entry.endTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
    const endMinutes = end.getHours() * 60 + end.getMinutes() - HOUR_START * 60;
    const top = Math.max(0, (startMinutes / 60) * ROW_HEIGHT);
    const height = Math.min((Math.max(0, endMinutes - startMinutes) / 60) * ROW_HEIGHT, (HOUR_END - HOUR_START) * ROW_HEIGHT - top);
    return { top: `${top}px`, height: `${Math.max(height, 24)}px` };
  };

  const getEventLaneLayout = (dayEntries: CalendarEntry[]) => {
    const sorted = [...dayEntries].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const lanes: number[] = [];
    const result = new Map<string, { laneIndex: number; totalLanes: number }>();
    for (const entry of sorted) {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      const startM = start.getHours() * 60 + start.getMinutes();
      const endM = end.getHours() * 60 + end.getMinutes();
      let lane = 0;
      for (; lane < lanes.length; lane++) {
        if (lanes[lane] <= startM) break;
      }
      if (lane === lanes.length) lanes.push(0);
      lanes[lane] = endM;
      result.set(entry.id, { laneIndex: lane, totalLanes: 0 });
    }
    const totalLanes = lanes.length;
    result.forEach((value) => {
      value.totalLanes = totalLanes;
    });
    return result;
  };

  const getEventOverlapStyle = (entryId: string, laneLayout: Map<string, { laneIndex: number; totalLanes: number }>) => {
    const layout = laneLayout.get(entryId);
    if (!layout || layout.totalLanes <= 1) return { left: "2%", width: "96%" };
    const gap = 2;
    const width = (100 - gap * (layout.totalLanes + 1)) / layout.totalLanes;
    const left = gap + layout.laneIndex * (width + gap);
    return { left: `${left}%`, width: `${width}%` };
  };

  const getPalette = (entry: CalendarEntry) => {
    if (isEntryOverdue(entry)) {
      return {
        card: `border-l-red-400 ${getDueDateStatusClasses("overdue").card} text-red-950 dark:text-red-50`,
        inline: `border-l-red-400 ${getDueDateStatusClasses("overdue").card} text-red-950 dark:text-red-50`,
        dot: "bg-red-400",
        badge: getDueDateStatusClasses("overdue").badge,
      };
    }
    if (entry.kind === "task") return EVENT_COLOR_PALETTES[3];
    if (entry.kind === "kanban") return EVENT_COLOR_PALETTES[4];
    const key = `${entry.id}:${entry.title}:${entry.type || ""}`;
    const hash = Array.from(key).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return EVENT_COLOR_PALETTES[hash % EVENT_COLOR_PALETTES.length];
  };

  const getEventInlineClasses = (entry: CalendarEntry) => {
    const palette = getPalette(entry);
    return `border border-l-4 ${palette.inline}`;
  };

  const getEventCardClasses = (entry: CalendarEntry) => {
    const palette = getPalette(entry);
    return `border-l-4 ${palette.card}`;
  };

  const getEventDotClass = (entry: CalendarEntry) => getPalette(entry).dot;
  const getEventBadgeClasses = (entry: CalendarEntry) => getPalette(entry).badge;

  const getEntryMetaLine = (entry: CalendarEntry) => {
    const parts = [format(new Date(entry.startTime), "HH:mm")];
    if (isEntryOverdue(entry)) parts.push(getDueDateStatusLabel("overdue"));
    if (entry.statusLabel) parts.push(entry.statusLabel);
    if (entry.responsibleLabel) parts.push(entry.responsibleLabel);
    return parts.join(" • ");
  };

  const isEntryOverdue = (entry: CalendarEntry) => {
    if (entry.kind === "event") return false;

    if (entry.kind === "task") {
      const isComplete = entry.task.status === "done" || entry.task.status === "cancelled";
      return getDueDateStatus(entry.task.dueDate, { isComplete }) === "overdue";
    }

    const isCompleteLikeList =
      entry.task.listType === "closed" ||
      entry.task.listType === "archive" ||
      entry.task.listType === "trash";
    return getDueDateStatus(entry.task.dueDate, { isComplete: isCompleteLikeList }) === "overdue";
  };

  const handleEntryClick = (entry: CalendarEntry) => {
    setSelectedEntry(entry);
    setIsDetailOpen(true);
  };

  const getTaskScheduleLabel = (task: { startDate?: string | Date | null; dueDate?: string | Date | null }) => {
    if (task.startDate && task.dueDate) {
      return `Период: ${format(new Date(task.startDate), "dd.MM.yyyy HH:mm", { locale: ru })} - ${format(new Date(task.dueDate), "dd.MM.yyyy HH:mm", { locale: ru })}`;
    }
    const sourceDate = task.startDate || task.dueDate;
    if (!sourceDate) return null;
    const label = task.startDate ? "Старт" : "Срок";
    return `${label}: ${format(new Date(sourceDate), "dd.MM.yyyy HH:mm", { locale: ru })}`;
  };

  const renderCardMeta = (entry: CalendarEntry, day?: Date) => (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 mt-1 text-xs opacity-90">
      <div className="flex items-center">
        <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
        {getEntryMetaLine(entry)}
        {day && <span className="ml-1">· {format(day, "EEE d", { locale: ru })}</span>}
      </div>
      {entry.kind === "event" && entry.location && (
        <div className="flex items-center">
          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
          <span className="break-words">{entry.location}</span>
        </div>
      )}
      {entry.kind === "event" && entry.participants && entry.participants.length > 0 && (
        <div className="flex items-center">
          <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
          {entry.participants.length} участников
        </div>
      )}
      {(entry.kind === "task" || entry.kind === "kanban") && (
        <div className="flex items-center">
          <UserRound className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
          {entry.responsibleLabel || "Без исполнителя"}
        </div>
      )}
    </div>
  );

  if (isLoadingEvents || isLoadingTasks || isLoadingKanbanCards) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 sm:space-y-2 p-0 w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground truncate">Календарь</h2>
          <Button
            size="sm"
            className="h-8 rounded-lg text-xs shrink-0 bg-primary text-primary-foreground sm:order-3"
            onClick={() => {
              setSelectedEntry(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Событие</span>
          </Button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-border shrink-0" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}>←</Button>
          <span className="text-xs sm:text-sm font-medium text-foreground min-w-[90px] sm:min-w-[100px] text-center truncate">
            {format(selectedDate, "LLLL yyyy", { locale: ru })}
          </span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-border shrink-0" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}>→</Button>
        </div>
        <Button variant="outline" size="sm" className="h-8 rounded-lg border-border text-xs shrink-0" onClick={() => setSelectedDate(new Date())}>
          Сегодня
        </Button>
        <Button variant="outline" size="sm" className="h-8 rounded-lg border-border text-xs shrink-0 hidden sm:flex" onClick={() => {}} title="Настройки и экспорт">
          <Settings className="h-4 w-4 mr-1.5" />
          Настройки
        </Button>
        <div className="flex rounded-lg p-0.5 bg-muted/40 shrink-0 overflow-x-auto hide-scrollbar">
          <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" className={cn("h-7 text-[10px] sm:text-xs px-2 sm:px-2.5 rounded-md shrink-0", viewMode === "month" && "bg-background shadow-sm")} onClick={() => setViewMode("month")}>Месяц</Button>
          <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" className={cn("h-7 text-[10px] sm:text-xs px-2 sm:px-2.5 rounded-md shrink-0", viewMode === "week" && "bg-background shadow-sm")} onClick={() => setViewMode("week")}>Неделя</Button>
          <Button variant={viewMode === "3days" ? "default" : "ghost"} size="sm" className={cn("h-7 text-[10px] sm:text-xs px-2 sm:px-2.5 rounded-md shrink-0", viewMode === "3days" && "bg-background shadow-sm")} onClick={() => setViewMode("3days")}>3 дня</Button>
          <Button variant={viewMode === "day" ? "default" : "ghost"} size="sm" className={cn("h-7 text-[10px] sm:text-xs px-2 sm:px-2.5 rounded-md shrink-0", viewMode === "day" && "bg-background shadow-sm")} onClick={() => setViewMode("day")}>День</Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className={cn("h-7 text-[10px] sm:text-xs px-2 sm:px-2.5 rounded-md shrink-0", viewMode === "list" && "bg-background shadow-sm")} onClick={() => setViewMode("list")}>Список</Button>
        </div>
      </div>

      {viewMode === "month" ? (
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1 sm:gap-1.5 p-1.5 sm:p-2 bg-card rounded-xl border border-border w-full min-w-0">
            <div className="flex items-center gap-2 text-foreground shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="font-semibold text-base sm:text-lg truncate">{format(selectedDate, "LLLL yyyy", { locale: ru })}</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto min-w-0">
              <Button variant="outline" size="sm" className="border-border text-xs sm:text-sm flex-1 min-w-0 sm:flex-initial px-2 sm:px-3 rounded-xl" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}>← Пред</Button>
              <Button variant="outline" size="sm" className="border-border text-xs sm:text-sm flex-1 min-w-0 sm:flex-initial px-2 sm:px-3 rounded-xl" onClick={() => setSelectedDate(new Date())}>Сегодня</Button>
              <Button variant="outline" size="sm" className="border-border text-xs sm:text-sm flex-1 min-w-0 sm:flex-initial px-2 sm:px-3 rounded-xl" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}>След →</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card min-w-0">
            <div className="grid grid-cols-7 border-b border-border">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                <div key={day} className="p-1 sm:p-1.5 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {(() => {
                const monthStart = startOfMonth(selectedDate);
                const monthEnd = endOfMonth(selectedDate);
                const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

                return days.map((day) => {
                  const dayEntries = getEntriesForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[56px] sm:min-h-[72px] md:min-h-[84px] p-0.5 sm:p-1 border-b border-border",
                        !isCurrentMonth ? "bg-muted/20 opacity-70" : "bg-card",
                        isToday && "ring-2 ring-inset ring-primary"
                      )}
                    >
                      <div className={cn("text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1", isToday ? "text-primary" : isCurrentMonth ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500")}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5 sm:space-y-1 max-h-[68px] sm:max-h-[94px] overflow-y-auto hide-scrollbar">
                        {dayEntries.slice(0, 3).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className={cn("w-full text-left text-[10px] sm:text-xs px-2 py-1 rounded-r-xl rounded-l-md truncate shadow-sm cursor-pointer", getEventInlineClasses(entry))}
                            onClick={() => handleEntryClick(entry)}
                          >
                            {entry.title}
                            <span className="ml-1 opacity-80">· {getEntryMetaLine(entry)}</span>
                          </button>
                        ))}
                        {dayEntries.length > 3 && <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">+{dayEntries.length - 3} ещё</div>}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      ) : viewMode === "week" ? (
        <div ref={weekScrollRef} className="rounded-xl border border-border bg-card overflow-hidden min-w-0 max-h-[70vh] sm:max-h-[75vh] overflow-y-auto overflow-x-auto">
          <div className="grid min-w-0" style={{ gridTemplateColumns: "minmax(44px,56px) repeat(7, minmax(0,1fr))" }}>
            <div className="border-b border-r border-border py-1.5 sm:py-2 pl-1.5 sm:pl-2 text-[10px] sm:text-xs font-medium text-foreground">Н{weekNumber}</div>
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="text-center py-1.5 sm:py-2 px-0.5 border-b border-r border-border last:border-r-0 min-w-[2.5rem] sm:min-w-0">
                  <div className="text-[9px] sm:text-xs text-muted-foreground uppercase truncate">{format(day, "EEE", { locale: ru })}</div>
                  <div className={cn("text-xs sm:text-sm font-semibold rounded inline-block min-w-[1.25rem]", isToday && "bg-red-500 text-white px-1")}>{format(day, "d")}</div>
                </div>
              );
            })}
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((hour) => (
              <Fragment key={hour}>
                <div className="flex items-start justify-end pr-0.5 sm:pr-1 text-[10px] sm:text-xs text-muted-foreground border-b border-r border-border shrink-0" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}>
                  {format(setMinutes(setHours(new Date(), hour), 0), "HH:mm")}
                </div>
                {weekDays.map((day) => (
                  <div key={`${hour}-${day.toISOString()}`} className="border-b border-r border-border last:border-r-0 min-w-0" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }} />
                ))}
              </Fragment>
            ))}
          </div>
          <div className="relative pointer-events-none mt-0" style={{ marginTop: -(HOUR_END - HOUR_START) * ROW_HEIGHT }}>
            <div className="grid min-w-0 pointer-events-auto" style={{ gridTemplateColumns: "minmax(44px,56px) repeat(7, minmax(0,1fr))" }}>
              <div className="col-span-1" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT }} />
              <div className="col-span-7 relative" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT, minHeight: (HOUR_END - HOUR_START) * ROW_HEIGHT }}>
                {weekDays.map((day, dayIndex) =>
                  Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((hour) => {
                    const isSelected = slotSelectStart && slotSelectEnd && (() => {
                      const minD = Math.min(slotSelectStart.dayIndex, slotSelectEnd.dayIndex);
                      const maxD = Math.max(slotSelectStart.dayIndex, slotSelectEnd.dayIndex);
                      const minH = Math.min(slotSelectStart.hour, slotSelectEnd.hour);
                      const maxH = Math.max(slotSelectStart.hour, slotSelectEnd.hour);
                      return dayIndex >= minD && dayIndex <= maxD && hour >= minH && hour <= maxH;
                    })();
                    return (
                      <div
                        key={`slot-${dayIndex}-${hour}`}
                        data-day-index={dayIndex}
                        data-hour={hour}
                        className={cn("absolute left-0 cursor-cell border-b border-border/50 transition-colors duration-150", isSelected && "bg-primary/40 dark:bg-primary/35 ring-2 ring-inset ring-primary/60")}
                        style={{ left: `${(100 / 7) * dayIndex}%`, width: `${100 / 7}%`, top: (hour - HOUR_START) * ROW_HEIGHT, height: ROW_HEIGHT }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSlotSelectStart({ dayIndex, hour });
                          setSlotSelectEnd({ dayIndex, hour });
                        }}
                      />
                    );
                  })
                )}
                {showNowLine && nowColumnIndex >= 0 && (
                  <div className="absolute h-px bg-red-500 z-10 pointer-events-none" style={{ top: nowTop, left: `${(100 / nowColumnCount) * nowColumnIndex}%`, width: `${100 / nowColumnCount}%` }} />
                )}
                {weekDays.map((day, dayIndex) => {
                  const dayEntries = getEntriesForDate(day).filter((entry) => {
                    const start = new Date(entry.startTime);
                    const end = new Date(entry.endTime);
                    const hStart = start.getHours() + start.getMinutes() / 60;
                    const hEnd = end.getHours() + end.getMinutes() / 60;
                    return hEnd > HOUR_START && hStart < HOUR_END;
                  });
                  const laneLayout = getEventLaneLayout(dayEntries);
                  return (
                    <div key={day.toISOString()} className="absolute top-0 bottom-0 border-l border-border first:border-l-0 z-10" style={{ left: `${(100 / 7) * dayIndex}%`, width: `${100 / 7}%`, pointerEvents: "none" }}>
                      {dayEntries.map((entry) => {
                        const style = getEventBlockStyle(entry);
                        const overlapStyle = getEventOverlapStyle(entry.id, laneLayout);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={cn("absolute rounded-xl text-xs overflow-hidden cursor-pointer pointer-events-auto shadow-md hover:shadow-lg transition-all duration-200 backdrop-blur-sm border border-white/10 dark:border-white/5 text-left", getEventCardClasses(entry))}
                            style={{ ...style, ...overlapStyle, minHeight: 24 }}
                            onClick={() => handleEntryClick(entry)}
                          >
                            <div className="p-1.5 truncate font-medium leading-tight">{entry.title}</div>
                            <div className="px-1.5 text-[10px] opacity-90 truncate">{getEntryMetaLine(entry)}</div>
                            <div className="px-1.5 pb-1.5 text-[10px] opacity-90 truncate flex items-center gap-0.5">
                              {entry.kind === "event" ? <MapPin className="w-3 h-3 shrink-0" /> : <UserRound className="w-3 h-3 shrink-0" />}
                              {entry.kind === "event" ? entry.location || "Без локации" : entry.responsibleLabel || "Без исполнителя"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === "3days" ? (
        <div ref={threeDaysScrollRef} className="rounded-xl border border-border bg-card overflow-hidden min-w-0 max-h-[75vh] overflow-y-auto">
          <div className="grid min-w-0" style={{ gridTemplateColumns: "56px 1fr 1fr 1fr" }}>
            <div className="border-b border-r border-border py-2 pl-2 text-xs font-medium text-foreground">Неделя {getISOWeek(weekStart)}</div>
            {threeDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="text-center py-2 px-1 border-b border-l border-border">
                  <div className="text-[10px] sm:text-xs text-muted-foreground uppercase">{format(day, "EEE", { locale: ru })}</div>
                  <div className={cn("text-sm font-semibold rounded-md inline-block min-w-[1.5rem]", isToday && "bg-red-500 text-white px-1")}>{format(day, "d")}</div>
                </div>
              );
            })}
            <div className="relative col-start-1 row-start-2 flex flex-col border-r border-border shrink-0" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT, minHeight: (HOUR_END - HOUR_START) * ROW_HEIGHT }}>
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((hour) => (
                <div key={hour} className="flex items-start justify-end pr-1 text-xs text-muted-foreground shrink-0" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}>
                  {format(setMinutes(setHours(new Date(), hour), 0), "HH:mm")}
                </div>
              ))}
              {showNowLine3 && (
                <div className="absolute right-0 pr-1 -translate-y-1/2 text-xs font-medium text-red-500 z-10 pointer-events-none" style={{ top: nowTop }}>
                  {format(now, "HH:mm")}
                </div>
              )}
            </div>
            <div className="col-span-3 col-start-2 row-start-2 relative overflow-x-auto min-w-0" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT, minHeight: (HOUR_END - HOUR_START) * ROW_HEIGHT }}>
              <div className="absolute inset-0 grid grid-cols-3 min-w-[200px] sm:min-w-[280px] pointer-events-none">
                {threeDays.map((day) => (
                  <div key={day.toISOString()} className="relative border-r border-border/60 last:border-r-0">
                    {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                      <div key={i} className="border-b border-border/20" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }} />
                    ))}
                  </div>
                ))}
              </div>
              {showNowLine3 && nowColumnIndex >= 0 && (
                <div className="absolute h-px bg-red-500 z-10 pointer-events-none" style={{ top: nowTop, left: `${(100 / 3) * nowColumnIndex}%`, width: `${100 / 3}%` }} />
              )}
              {threeDays.map((day, dayIndex) => {
                const dayEntries = getEntriesForDate(day).filter((entry) => {
                  const start = new Date(entry.startTime);
                  const end = new Date(entry.endTime);
                  const hStart = start.getHours() + start.getMinutes() / 60;
                  const hEnd = end.getHours() + end.getMinutes() / 60;
                  return hEnd > HOUR_START && hStart < HOUR_END;
                });
                const laneLayout = getEventLaneLayout(dayEntries);
                return (
                  <div key={day.toISOString()} className="absolute top-0 bottom-0 border-l border-border first:border-l-0" style={{ left: `${(100 / 3) * dayIndex}%`, width: `${100 / 3}%` }}>
                    {dayEntries.map((entry) => {
                      const style = getEventBlockStyle(entry);
                      const overlapStyle = getEventOverlapStyle(entry.id, laneLayout);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className={cn("absolute rounded-xl text-xs overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-all duration-200 backdrop-blur-sm border border-white/10 dark:border-white/5 text-left", getEventCardClasses(entry))}
                          style={{ ...style, ...overlapStyle, minHeight: 24 }}
                          onClick={() => handleEntryClick(entry)}
                        >
                          <div className="p-1.5 truncate font-medium leading-tight">{entry.title}</div>
                          <div className="px-1.5 text-[10px] opacity-90 truncate">{getEntryMetaLine(entry)}</div>
                          <div className="px-1.5 pb-1.5 text-[10px] opacity-90 truncate flex items-center gap-0.5">
                            {entry.kind === "event" ? <MapPin className="w-3 h-3 shrink-0" /> : <UserRound className="w-3 h-3 shrink-0" />}
                            {entry.kind === "event" ? entry.location || "Без локации" : entry.responsibleLabel || "Без исполнителя"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden min-w-0">
          <div className="p-2 sm:p-3 border-b border-border">
            <div className="flex items-center gap-2 text-foreground">
              <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm sm:text-base">
                {format(weekStart, "d MMM", { locale: ru })} – {format(weekEnd, "d MMM yyyy", { locale: ru })}
              </span>
            </div>
          </div>
          <div className="p-2 sm:p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
            {(() => {
              const listEntries = weekDays.flatMap((day) => getEntriesForDate(day).map((entry) => ({ ...entry, _day: day })));
              listEntries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
              if (listEntries.length === 0) {
                return (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-muted-foreground text-sm">На эту неделю задачи и события не запланированы</p>
                  </div>
                );
              }
              return listEntries.map((entry) => (
                <Card key={entry.id} className={cn("rounded-xl border border-border shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-sm", getEventCardClasses(entry))} onClick={() => handleEntryClick(entry)}>
                  <CardHeader className="pb-1.5 p-2.5 sm:p-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-base break-words">{entry.title}</CardTitle>
                        {renderCardMeta(entry, entry._day)}
                      </div>
                      <Badge className={cn("shrink-0", getEventBadgeClasses(entry), "text-xs sm:text-sm")}>{entry.badgeText}</Badge>
                    </div>
                  </CardHeader>
                  {entry.description && (
                    <CardContent className="p-2.5 sm:p-3 pt-0">
                      <p className="text-xs opacity-90 break-words">{entry.description}</p>
                    </CardContent>
                  )}
                </Card>
              ));
            })()}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Card className="rounded-xl border border-border">
            <CardHeader className="p-2.5 sm:p-4">
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <div className="flex items-center gap-1.5 text-sm sm:text-base">
                  <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{format(selectedDate, "d MMMM yyyy, EEEE", { locale: ru })}</span>
                </div>
                <div className="flex flex-wrap gap-1 w-full sm:w-auto min-w-0">
                  <Button variant="outline" size="sm" className="flex-1 min-w-0 sm:flex-initial text-xs px-2 rounded-lg border-border" onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 86400000))}>← Вчера</Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-0 sm:flex-initial text-xs px-2 rounded-lg border-border" onClick={() => setSelectedDate(new Date())}>Сегодня</Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-0 sm:flex-initial text-xs px-2 rounded-lg border-border" onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 86400000))}>Завтра →</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2.5 sm:p-4 pt-0">
              <div className="space-y-1.5">
                {getEntriesForDate(selectedDate).length === 0 ? (
                  <div className="text-center py-6">
                    <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-muted-foreground text-sm">На этот день задачи и события не запланированы</p>
                  </div>
                ) : (
                  getEntriesForDate(selectedDate).map((entry) => (
                    <Card key={entry.id} className={cn("rounded-xl border border-border shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-sm", getEventCardClasses(entry))} onClick={() => handleEntryClick(entry)}>
                      <CardHeader className="pb-1.5 p-2.5 sm:p-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base break-words">{entry.title}</CardTitle>
                            {renderCardMeta(entry)}
                          </div>
                          <Badge className={cn("shrink-0", getEventBadgeClasses(entry), "text-xs sm:text-sm")}>{entry.badgeText}</Badge>
                        </div>
                      </CardHeader>
                      {entry.description && (
                        <CardContent className="p-2.5 sm:p-3 pt-0">
                          <p className="text-xs opacity-90 break-words">{entry.description}</p>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border bg-card p-0 overflow-hidden gap-0">
          {selectedEntry && (
            <div className="p-4 sm:p-5 space-y-4">
              {isTaskEntry(selectedEntry) || isKanbanEntry(selectedEntry) ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-3 h-3 rounded-full shrink-0 mt-1", getEventDotClass(selectedEntry))} />
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground leading-tight break-words pr-6">{selectedEntry.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={cn(getEventBadgeClasses(selectedEntry), "text-xs")}>{selectedEntry.badgeText}</Badge>
                        <Badge variant="secondary">{selectedEntry.statusLabel}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-muted-foreground">
                    {getTaskScheduleLabel(selectedEntry.task) && (
                      <div className="flex items-start gap-3">
                        <CalendarIcon className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span className="text-foreground">{getTaskScheduleLabel(selectedEntry.task)}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <UserRound className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                      <span className="text-foreground">{selectedEntry.responsibleLabel || "Без исполнителя"}</span>
                    </div>
                    {selectedEntry.task.priority && (
                      <div className="flex items-start gap-3">
                        <Flag className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span className="text-foreground">{TASK_PRIORITY_LABELS[selectedEntry.task.priority] || selectedEntry.task.priority}</span>
                      </div>
                    )}
                    {isTaskEntry(selectedEntry) && selectedEntry.task.category && (
                      <div className="flex items-start gap-3">
                        <FolderOpen className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span className="text-foreground">{selectedEntry.task.category}</span>
                      </div>
                    )}
                    {isKanbanEntry(selectedEntry) && selectedEntry.task.boardName && (
                      <div className="flex items-start gap-3">
                        <FolderOpen className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span className="text-foreground">{selectedEntry.task.boardName}</span>
                      </div>
                    )}
                    {selectedEntry.description && (
                      <div className="flex items-start gap-3">
                        <Users className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <p className="text-foreground break-words">{selectedEntry.description}</p>
                      </div>
                    )}
                    {isTaskEntry(selectedEntry) && Array.isArray(selectedEntry.task.subtasks) && selectedEntry.task.subtasks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-foreground font-medium">Подзадачи</p>
                        <div className="space-y-1.5">
                          {selectedEntry.task.subtasks.map((subtask) => (
                            <div key={subtask.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-foreground">
                              {subtask.completed ? "✓ " : ""}
                              {subtask.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isTaskEntry(selectedEntry) && Array.isArray(selectedEntry.task.links) && selectedEntry.task.links.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-foreground font-medium">Ссылки</p>
                        <div className="space-y-1.5">
                          {selectedEntry.task.links.map((link, index) => (
                            <a key={`${link.url || index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border px-3 py-2 text-primary hover:underline">
                              {link.title || link.url}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {isTaskEntry(selectedEntry) && Array.isArray(selectedEntry.task.attachments) && selectedEntry.task.attachments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-foreground font-medium">Вложения</p>
                        <div className="space-y-1.5">
                          {selectedEntry.task.attachments.map((file, index) => (
                            <div key={`${file.url || file.name || index}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-foreground">
                              <Paperclip className="w-4 h-4 text-primary shrink-0" />
                              <span className="truncate">{file.name || file.url || "Файл"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                      Закрыть
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-3 h-3 rounded-full shrink-0 mt-1", getEventDotClass(selectedEntry))} />
                    <h3 className="text-lg font-semibold text-foreground leading-tight break-words pr-6">{selectedEntry.title}</h3>
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <CalendarIcon className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                      <span className="text-foreground">
                        {format(new Date(selectedEntry.startTime), "EEEE, d MMMM", { locale: ru })} {format(new Date(selectedEntry.startTime), "HH:mm")}–{format(new Date(selectedEntry.endTime), "HH:mm")}
                      </span>
                    </div>
                    {selectedEntry.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span className="text-foreground">{selectedEntry.location}</span>
                      </div>
                    )}
                    {selectedEntry.description && (
                      <div className="flex items-start gap-3">
                        <Users className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <p className="text-foreground break-words">{selectedEntry.description}</p>
                      </div>
                    )}
                    {selectedEntry.participants && selectedEntry.participants.length > 0 && (
                      <div className="flex items-start gap-3">
                        <Users className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className="text-foreground font-medium text-sm">Участники</p>
                          <ul className="space-y-1">
                            {selectedEntry.participants.map((participant) => {
                              const currentUserId = AuthService.getCurrentUser()?.id;
                              const isMe = currentUserId && participant.userId === currentUserId;
                              const isInvited = participant.status === "invited";
                              return (
                                <li key={participant.id} className="flex items-center justify-between gap-2 text-sm">
                                  <span className="text-foreground truncate">{participant.userName ?? "?"}</span>
                                  <span className={cn("shrink-0 text-xs", participant.status === "accepted" && "text-green-600 dark:text-green-400", participant.status === "declined" && "text-rose-600 dark:text-rose-400", participant.status === "invited" && "text-muted-foreground")}>
                                    {participant.status === "accepted" && "Принято"}
                                    {participant.status === "declined" && "Отклонено"}
                                    {participant.status === "invited" && (isMe ? "Приглашение" : "Ожидает")}
                                  </span>
                                  {isMe && isInvited && (
                                    <span className="flex items-center gap-0.5 shrink-0">
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10" onClick={() => respondParticipantMutation.mutate({ eventId: selectedEntry.id, participantId: participant.id, status: "accepted" })} disabled={respondParticipantMutation.isPending}>
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10" onClick={() => respondParticipantMutation.mutate({ eventId: selectedEntry.id, participantId: participant.id, status: "declined" })} disabled={respondParticipantMutation.isPending}>
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Badge className={cn(getEventBadgeClasses(selectedEntry), "text-xs")}>{getEventTypeText(selectedEntry.type)}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setIsDetailOpen(false);
                        setIsFormOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                      Редактировать
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        if (confirm("Удалить это событие?")) {
                          deleteEventMutation.mutate(selectedEntry.id);
                        }
                      }}
                      disabled={deleteEventMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                      Закрыть
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EventForm
        key={draftSlot ? "draft-slot" : selectedEntry?.kind === "event" ? selectedEntry.id : "new"}
        isOpen={isFormOpen}
        onClose={() => {
          setDraftSlot(null);
          setIsFormOpen(false);
        }}
        event={draftSlot ? { startTime: draftSlot.startTime, endTime: draftSlot.endTime } : selectedEntry?.kind === "event" ? selectedEntry : undefined}
      />
    </div>
  );
}
