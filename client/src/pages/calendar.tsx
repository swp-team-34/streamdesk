import { useState, Fragment, useCallback, useEffect, useRef, useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  buildQuarterHourOptions,
  combineDateWithTime,
  formatDueDateLabel,
  getDueDateStatus,
  getDueDateStatusClasses,
  getDueDateStatusLabel,
  moveDateRange,
  normalizeDateRange,
} from "@/lib/task-dates";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  location?: string | null;
  participants?: Array<{ id: string; userId: string; userName?: string; status?: string }>;
  type?: string;
  color?: string | null;
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
  listColor?: string | null;
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

type CalendarPointerPreview = {
  entry: CalendarEntry;
  startTime: string;
  endTime: string;
  mode: CalendarPointerMode;
};

type CalendarPointerMode = "move" | "resize-start" | "resize-end" | "all-day-move" | "all-day-resize-start" | "all-day-resize-end";

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
const CALENDAR_TIME_SLOTS = buildQuarterHourOptions();
const CALENDAR_SLOT_HEIGHT = 12;
const CALENDAR_SETTINGS_STORAGE_KEY = "streamdesk_calendar_settings_v1";

type CalendarSettings = {
  workdayStart: number;
  workdayEnd: number;
  gridStep: 15 | 30 | 60;
  showWeekends: boolean;
  showAllDay: boolean;
  compactMode: boolean;
  timezoneLabel: string;
};

const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  workdayStart: 0,
  workdayEnd: 24,
  gridStep: 15,
  showWeekends: true,
  showAllDay: true,
  compactMode: false,
  timezoneLabel: "Moscow, GMT+3",
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
const EVENT_COLOR_STORAGE_KEY = "streamdesk_event_colors_v1";

const readEventColorMap = () => {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EVENT_COLOR_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
};

const normalizeHexColor = (value?: string | null) => {
  const normalized = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : null;
};

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

function slotNumberToTime(slot: number) {
  const hour = Math.floor(slot);
  const minute = Math.round((slot - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function roundDateToStep(value: Date, stepMinutes: number) {
  const next = new Date(value);
  const step = Math.max(1, stepMinutes);
  const roundedMinutes = Math.floor(next.getMinutes() / step) * step;
  next.setMinutes(roundedMinutes, 0, 0);
  return next;
}

function addMinutesToDate(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

function loadCalendarSettings(): CalendarSettings {
  if (typeof window === "undefined") return DEFAULT_CALENDAR_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CALENDAR_SETTINGS_STORAGE_KEY) || "{}");
    return {
      ...DEFAULT_CALENDAR_SETTINGS,
      ...parsed,
      workdayStart: Number.isFinite(Number(parsed.workdayStart)) ? Number(parsed.workdayStart) : DEFAULT_CALENDAR_SETTINGS.workdayStart,
      workdayEnd: Number.isFinite(Number(parsed.workdayEnd)) ? Number(parsed.workdayEnd) : DEFAULT_CALENDAR_SETTINGS.workdayEnd,
      gridStep: [15, 30, 60].includes(Number(parsed.gridStep)) ? Number(parsed.gridStep) as 15 | 30 | 60 : DEFAULT_CALENDAR_SETTINGS.gridStep,
    };
  } catch {
    return DEFAULT_CALENDAR_SETTINGS;
  }
}

const isAllDayEntry = (entry: CalendarEntry) => {
  const start = new Date(entry.startTime);
  const end = new Date(entry.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const durationHours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
  return durationHours >= 23 || (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() >= 23 &&
    end.getMinutes() >= 45
  );
};

const entryOverlapsDate = (entry: CalendarEntry, date: Date) => {
  const start = new Date(entry.startTime);
  const end = new Date(entry.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return start.getTime() <= dayEnd.getTime() && end.getTime() >= dayStart.getTime();
};

export default function Calendar() {
  useWebSocket();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [draftSlot, setDraftSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "day" | "month" | "3days" | "list">("week");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>(() => loadCalendarSettings());
  const [calendarPointerPreview, setCalendarPointerPreview] = useState<CalendarPointerPreview | null>(null);
  const [slotSelectStart, setSlotSelectStart] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [slotSelectEnd, setSlotSelectEnd] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [expandedNonWorkingRanges, setExpandedNonWorkingRanges] = useState<{ before: boolean; after: boolean }>({ before: false, after: false });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { toast } = useToast();
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const threeDaysScrollRef = useRef<HTMLDivElement>(null);
  const calendarPointerActionRef = useRef<{
    mode: CalendarPointerMode;
    entry: CalendarEntry;
    startX: number;
    startY: number;
  } | null>(null);

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
  const storedEventColors = useMemo(() => readEventColorMap(), [events]);

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
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter((day) => calendarSettings.showWeekends || day.getDay() !== 0 && day.getDay() !== 6);
  const workdayStart = Math.max(0, Math.min(23, calendarSettings.workdayStart));
  const workdayEnd = Math.max(workdayStart + 1, Math.min(24, calendarSettings.workdayEnd));
  const HOUR_START = expandedNonWorkingRanges.before ? 0 : workdayStart;
  const HOUR_END = expandedNonWorkingRanges.after ? 24 : workdayEnd;
  const ROW_HEIGHT = calendarSettings.compactMode ? 40 : 48;
  const visibleTimeSlots = useMemo(
    () => CALENDAR_TIME_SLOTS.filter((time) => Number(time.slice(3, 5)) % calendarSettings.gridStep === 0),
    [calendarSettings.gridStep],
  );
  const threeDays = eachDayOfInterval({ start: selectedDate, end: addDays(selectedDate, 2) }).filter((day) => calendarSettings.showWeekends || day.getDay() !== 0 && day.getDay() !== 6);
  const weekColumnCount = Math.max(1, weekDays.length);
  const threeDayColumnCount = Math.max(1, threeDays.length);
  const todayColumnIndexWeek = weekDays.findIndex((d) => isSameDay(d, new Date()));
  const todayColumnIndex3 = threeDays.findIndex((d) => isSameDay(d, new Date()));

  useEffect(() => {
    window.localStorage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, JSON.stringify(calendarSettings));
  }, [calendarSettings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleSlotMouseUp = useCallback(() => {
    if (!slotSelectStart) return;
    const end = slotSelectEnd || slotSelectStart;
    const slotDays = viewMode === "3days" ? threeDays : viewMode === "day" ? [selectedDate] : weekDays;
    const dayStart = slotDays[slotSelectStart.dayIndex];
    const dayEnd = slotDays[end.dayIndex];
    const rangeStart = combineDateWithTime(dayStart, slotNumberToTime(slotSelectStart.hour));
    const rangeEnd = combineDateWithTime(dayEnd, slotNumberToTime(end.hour));
    const [startTime, selectedEndTime] = rangeStart.getTime() <= rangeEnd.getTime()
      ? [rangeStart, rangeEnd]
      : [rangeEnd, rangeStart];
    let endTime = selectedEndTime;
    if (slotSelectStart.dayIndex === end.dayIndex && slotSelectStart.hour === end.hour) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    } else {
      endTime = new Date(endTime.getTime() + 15 * 60 * 1000);
    }
    setDraftSlot({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });
    setSelectedEntry(null);
    setIsFormOpen(true);
    setSlotSelectStart(null);
    setSlotSelectEnd(null);
  }, [selectedDate, slotSelectStart, slotSelectEnd, threeDays, viewMode, weekDays]);

  useEffect(() => {
    if (!slotSelectStart) return;
    const onUp = () => handleSlotMouseUp();
    const onMove = (e: MouseEvent) => {
      const slot = getSlotElementFromPoint(e.clientX, e.clientY);
      if (!slot) return;
      const dayIdx = slot.getAttribute("data-day-index");
      const hourStr = slot.getAttribute("data-hour");
      if (dayIdx == null || hourStr == null) return;
      setSlotSelectEnd({ dayIndex: parseInt(dayIdx, 10), hour: parseFloat(hourStr) });
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

  const updateCalendarEntryRangeMutation = useMutation({
    mutationFn: async ({ entry, start, end }: { entry: CalendarEntry; start: Date; end: Date }) => {
      if (entry.kind === "event") {
        const response = await apiRequest("PUT", `/api/events/${entry.id}`, {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        });
        return response.json();
      }

      if (entry.kind === "kanban") {
        const response = await apiRequest("PUT", `/api/kanban/boards/${entry.task.boardId}/cards/${entry.task.id}`, {
          startDate: start.toISOString(),
          dueDate: end.toISOString(),
        });
        return response.json();
      }

      const response = await apiRequest("PUT", `/api/tasks/${entry.task.id}`, {
        startDate: start.toISOString(),
        dueDate: end.toISOString(),
      });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      toast({
        title: "Сохранено",
        description: variables.entry.kind === "event" ? "Событие обновлено" : "Карточка обновлена",
      });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить время", variant: "destructive" });
    },
  });

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
        return isAllDayEntry(entry) ? entryOverlapsDate(entry, date) : isSameDay(new Date(entry.startTime), date);
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
  const nowColumnCount = viewMode === "week" ? weekColumnCount : threeDayColumnCount;

  const getEventBlockStyleFromRange = (start: Date, end: Date) => {
    const startMinutes = start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
    const endMinutes = end.getHours() * 60 + end.getMinutes() - HOUR_START * 60;
    const top = Math.max(0, (startMinutes / 60) * ROW_HEIGHT);
    const height = Math.min((Math.max(0, endMinutes - startMinutes) / 60) * ROW_HEIGHT, (HOUR_END - HOUR_START) * ROW_HEIGHT - top);
    return { top: `${top}px`, height: `${Math.max(height, 24)}px` };
  };

  const getEventBlockStyle = (entry: CalendarEntry) =>
    getEventBlockStyleFromRange(new Date(entry.startTime), new Date(entry.endTime));

  const getEventLaneLayout = (dayEntries: CalendarEntry[]) => {
    const sorted = [...dayEntries].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const result = new Map<string, { laneIndex: number; totalLanes: number }>();

    const flushGroup = (group: CalendarEntry[]) => {
      const lanes: number[] = [];
      for (const entry of group) {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        const startM = start.getHours() * 60 + start.getMinutes();
        const endM = Math.max(startM + 15, end.getHours() * 60 + end.getMinutes());
        let lane = 0;
        for (; lane < lanes.length; lane++) {
          if (lanes[lane] <= startM) break;
        }
        if (lane === lanes.length) lanes.push(0);
        lanes[lane] = endM;
        result.set(entry.id, { laneIndex: lane, totalLanes: 0 });
      }
      const totalLanes = Math.max(1, lanes.length);
      group.forEach((entry) => {
        const layout = result.get(entry.id);
        if (layout) layout.totalLanes = totalLanes;
      });
    };

    let group: CalendarEntry[] = [];
    let groupEnd = -Infinity;
    for (const entry of sorted) {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      const startM = start.getHours() * 60 + start.getMinutes();
      const endM = Math.max(startM + 15, end.getHours() * 60 + end.getMinutes());
      if (group.length > 0 && startM >= groupEnd) {
        flushGroup(group);
        group = [];
        groupEnd = -Infinity;
      }
      group.push(entry);
      groupEnd = Math.max(groupEnd, endM);
    }
    if (group.length > 0) flushGroup(group);

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
    const urgency = getEntryDeadlineUrgency(entry);
    if (urgency === "overdue") {
      return {
        card: `border-l-red-400 ${getDueDateStatusClasses("overdue").card} text-red-950 dark:text-red-50`,
        inline: `border-l-red-400 ${getDueDateStatusClasses("overdue").card} text-red-950 dark:text-red-50`,
        dot: "bg-red-400",
        badge: getDueDateStatusClasses("overdue").badge,
      };
    }
    if (urgency === "soon") {
      return {
        card: `border-l-amber-400 ${getDueDateStatusClasses("soon").card} text-amber-950 dark:text-amber-50`,
        inline: `border-l-amber-400 ${getDueDateStatusClasses("soon").card} text-amber-950 dark:text-amber-50`,
        dot: "bg-amber-400",
        badge: getDueDateStatusClasses("soon").badge,
      };
    }
    if (entry.kind === "task") return EVENT_COLOR_PALETTES[3];
    if (entry.kind === "kanban") return EVENT_COLOR_PALETTES[4];
    const key = `${entry.id}:${entry.title}:${entry.type || ""}`;
    const hash = Array.from(key).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return EVENT_COLOR_PALETTES[hash % EVENT_COLOR_PALETTES.length];
  };

  const getManualEntryColor = (entry: CalendarEntry) => {
    if (getEntryDeadlineUrgency(entry) !== "none") return null;
    if (entry.kind === "kanban") return normalizeHexColor(entry.task.listColor);
    if (entry.kind === "event") return normalizeHexColor(entry.color) || normalizeHexColor(storedEventColors[entry.id]);
    return null;
  };

  const getEntryColorStyle = (entry: CalendarEntry, strength: "card" | "inline" | "badge" = "card"): CSSProperties | undefined => {
    const color = getManualEntryColor(entry);
    if (!color) return undefined;
    const mix = strength === "badge" ? 26 : strength === "inline" ? 20 : 22;
    return {
      borderColor: `color-mix(in srgb, ${color} 58%, hsl(var(--app-border)))`,
      borderLeftColor: color,
      background: `color-mix(in srgb, ${color} ${mix}%, var(--card))`,
      color: "var(--foreground)",
    };
  };

  const getEntryDotStyle = (entry: CalendarEntry): CSSProperties | undefined => {
    const color = getManualEntryColor(entry);
    return color ? { backgroundColor: color } : undefined;
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
    const urgency = getEntryDeadlineUrgency(entry);
    if (urgency !== "none") parts.push(getDueDateStatusLabel(urgency));
    if (entry.statusLabel) parts.push(entry.statusLabel);
    if (entry.responsibleLabel) parts.push(entry.responsibleLabel);
    return parts.join(" • ");
  };

  const renderTimedPointerPreview = (
    days: Date[],
    columnCount: number,
    scope: "week" | "3days" | "day",
  ) => {
    if (!calendarPointerPreview) return null;

    const start = new Date(calendarPointerPreview.startTime);
    const end = new Date(calendarPointerPreview.endTime);
    if (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() >= 23 && end.getMinutes() >= 45) return null;
    const dayIndex = days.findIndex((day) => isSameDay(day, start));
    if (dayIndex < 0) return null;

    const blockStyle = getEventBlockStyleFromRange(start, end);
    const horizontalStyle =
      scope === "day"
        ? { left: "0.5rem", right: "0.5rem" }
        : {
            left: `calc(${(100 / columnCount) * dayIndex}% + 0.5rem)`,
            width: `calc(${100 / columnCount}% - 1rem)`,
          };

    return (
      <div
        className={cn(
          "pointer-events-none absolute z-30 rounded-xl border border-primary/70 bg-primary/20 px-2 py-1 text-left text-xs text-foreground shadow-lg ring-2 ring-primary/25 backdrop-blur",
                  (calendarPointerPreview.mode === "resize-start" || calendarPointerPreview.mode === "resize-end") && "border-dashed",
        )}
        style={{ ...blockStyle, ...horizontalStyle, minHeight: 28 }}
      >
        <div className="truncate font-semibold">{calendarPointerPreview.entry.title}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {format(start, "HH:mm")} - {format(end, "HH:mm")}
        </div>
      </div>
    );
  };

  const getSlotSelectionRange = (days: Date[]) => {
    if (!slotSelectStart) return null;
    const end = slotSelectEnd || slotSelectStart;
    const dayStart = days[slotSelectStart.dayIndex];
    const dayEnd = days[end.dayIndex];
    if (!dayStart || !dayEnd) return null;
    const rangeStart = combineDateWithTime(dayStart, slotNumberToTime(slotSelectStart.hour));
    const rangeEnd = combineDateWithTime(dayEnd, slotNumberToTime(end.hour));
    const [start, selectedEnd] =
      rangeStart.getTime() <= rangeEnd.getTime() ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    const isSingleSlot = slotSelectStart.dayIndex === end.dayIndex && slotSelectStart.hour === end.hour;
    return {
      start,
      end: new Date(selectedEnd.getTime() + (isSingleSlot ? 60 : 15) * 60 * 1000),
    };
  };

  const renderSlotSelectionPreview = (
    days: Date[],
    columnCount: number,
    scope: "week" | "3days" | "day",
  ) => {
    const range = getSlotSelectionRange(days);
    if (!range) return null;
    const dayIndex = days.findIndex((day) => isSameDay(day, range.start));
    if (dayIndex < 0) return null;
    const blockStyle = getEventBlockStyleFromRange(range.start, range.end);
    const horizontalStyle =
      scope === "day"
        ? { left: "0.5rem", right: "0.5rem" }
        : {
            left: `calc(${(100 / columnCount) * dayIndex}% + 0.5rem)`,
            width: `calc(${100 / columnCount}% - 1rem)`,
          };

    return (
      <div
        className="pointer-events-none absolute z-20 rounded-xl border border-primary/60 bg-primary/15 px-2 py-1 text-left text-xs text-foreground shadow-lg ring-2 ring-primary/20 backdrop-blur"
        style={{ ...blockStyle, ...horizontalStyle, minHeight: 28 }}
      >
        <div className="truncate font-semibold">Новое событие</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {format(range.start, "HH:mm")} - {format(range.end, "HH:mm")}
        </div>
      </div>
    );
  };

  const getEntryDeadlineUrgency = (entry: CalendarEntry): "overdue" | "soon" | "none" => {
    if (entry.kind === "event") return "none";

    const dueDateValue = entry.task.dueDate;
    if (!dueDateValue) return "none";
    const dueDate = new Date(dueDateValue);
    if (Number.isNaN(dueDate.getTime())) return "none";

    if (entry.kind === "task") {
      const status = String(entry.task.status || "");
      if (status === "done" || status === "completed" || status === "cancelled") return "none";
    } else {
      const isCompleteLikeList =
        entry.task.listType === "closed" ||
        entry.task.listType === "archive" ||
        entry.task.listType === "trash";
      if (isCompleteLikeList) return "none";
    }

    const diffMs = dueDate.getTime() - currentTime.getTime();
    if (diffMs < 0) return "overdue";
    if (diffMs <= 24 * 60 * 60 * 1000) return "soon";
    return "none";
  };

  const handleEntryClick = (entry: CalendarEntry) => {
    setSelectedEntry(entry);
    setIsDetailOpen(true);
  };

  const getPiercedElementFromPoint = (clientX: number, clientY: number, selectors: string[]) => {
    const hidden: Array<{ node: HTMLElement; pointerEvents: string }> = [];
    let element = document.elementFromPoint(clientX, clientY);

    try {
      while (element) {
        const blocker = selectors
          .map((selector) => element?.closest<HTMLElement>(selector))
          .find((node): node is HTMLElement => Boolean(node));
        if (!blocker) break;
        hidden.push({ node: blocker, pointerEvents: blocker.style.pointerEvents });
        blocker.style.pointerEvents = "none";
        element = document.elementFromPoint(clientX, clientY);
      }
      return element;
    } finally {
      hidden.forEach(({ node, pointerEvents }) => {
        node.style.pointerEvents = pointerEvents;
      });
    }
  };

  const getSlotElementFromPoint = (clientX: number, clientY: number) => {
    const element = getPiercedElementFromPoint(clientX, clientY, ["[data-calendar-entry-block]"]);
    const slot = element?.closest<HTMLElement>("[data-calendar-slot]");
    if (slot) return slot;

    return Array.from(document.querySelectorAll<HTMLElement>("[data-calendar-slot]")).find((node) => {
      const rect = node.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }) || null;
  };

  const getSlotDateTimeFromPoint = (clientX: number, clientY: number) => {
    const slot = getSlotElementFromPoint(clientX, clientY);
    if (!slot) return null;
    const dayIndex = Number(slot.dataset.dayIndex);
    const hour = Number(slot.dataset.hour);
    const scope = slot.dataset.scope;
    const days = scope === "3days" ? threeDays : scope === "day" ? [selectedDate] : weekDays;
    const day = days[dayIndex];
    if (!day || !Number.isFinite(hour)) return null;
    return combineDateWithTime(day, slotNumberToTime(hour));
  };

  const getAllDayDateFromPoint = (clientX: number, clientY: number) => {
    const slot = Array.from(document.querySelectorAll<HTMLElement>("[data-calendar-all-day]")).find((node) => {
      const rect = node.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!slot) return null;
    const dayIndex = Number(slot.dataset.dayIndex);
    const scope = slot.dataset.scope;
    const days = scope === "3days" ? threeDays : scope === "day" ? [selectedDate] : weekDays;
    return days[dayIndex] || null;
  };

  const normalizeTimedResizeRange = (
    entry: CalendarEntry,
    targetDateTime: Date,
    edge: "start" | "end",
  ) => {
    const start = roundDateToStep(new Date(entry.startTime), calendarSettings.gridStep);
    const end = roundDateToStep(new Date(entry.endTime), calendarSettings.gridStep);
    const target = roundDateToStep(targetDateTime, calendarSettings.gridStep);
    const minMinutes = Math.max(15, calendarSettings.gridStep);
    const minMs = minMinutes * 60 * 1000;

    if (edge === "start") {
      if (target.getTime() <= end.getTime() - minMs) {
        return { start: target, end };
      }
      if (target.getTime() > end.getTime()) {
        const nextEnd = target.getTime() - end.getTime() >= minMs ? target : addMinutesToDate(end, minMinutes);
        return { start: end, end: nextEnd };
      }
      return { start: addMinutesToDate(end, -minMinutes), end };
    }

    if (target.getTime() >= start.getTime() + minMs) {
      return { start, end: target };
    }
    if (target.getTime() < start.getTime()) {
      const nextStart = start.getTime() - target.getTime() >= minMs ? target : addMinutesToDate(start, -minMinutes);
      return { start: nextStart, end: start };
    }
    return { start, end: addMinutesToDate(start, minMinutes) };
  };

  const startCalendarEntryPointerAction = (
    event: ReactPointerEvent,
    entry: CalendarEntry,
    mode: CalendarPointerMode,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    calendarPointerActionRef.current = {
      mode,
      entry,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  useEffect(() => {
    const buildPreview = (action: NonNullable<typeof calendarPointerActionRef.current>, clientX: number, clientY: number) => {
      if (action.mode === "all-day-move") {
        const targetDate = getAllDayDateFromPoint(clientX, clientY);
        if (!targetDate) {
          const targetDateTime = getSlotDateTimeFromPoint(clientX, clientY);
          if (!targetDateTime) return null;
          return {
            start: targetDateTime,
            end: new Date(targetDateTime.getTime() + 60 * 60 * 1000),
          };
        }
        const current = normalizeDateRange(new Date(action.entry.startTime), new Date(action.entry.endTime), 60);
        const duration = current.end.getTime() - current.start.getTime();
        const nextStart = combineDateWithTime(targetDate, "00:00");
        const nextEnd = new Date(nextStart.getTime() + duration);
        return { start: nextStart, end: nextEnd };
      }

      if (action.mode === "all-day-resize-start" || action.mode === "all-day-resize-end") {
        const targetDate = getAllDayDateFromPoint(clientX, clientY);
        if (!targetDate) return null;

        const currentStart = combineDateWithTime(new Date(action.entry.startTime), "00:00");
        const currentEnd = combineDateWithTime(new Date(action.entry.endTime), "23:59");
        const targetStart = combineDateWithTime(targetDate, "00:00");
        const targetEnd = combineDateWithTime(targetDate, "23:59");

        if (action.mode === "all-day-resize-start") {
          if (targetStart.getTime() <= currentEnd.getTime()) {
            return { start: targetStart, end: currentEnd };
          }
          return { start: combineDateWithTime(currentEnd, "00:00"), end: targetEnd };
        }

        if (targetEnd.getTime() >= currentStart.getTime()) {
          return { start: currentStart, end: targetEnd };
        }
        return { start: targetStart, end: combineDateWithTime(currentStart, "23:59") };
      }

      const targetDateTime = getSlotDateTimeFromPoint(clientX, clientY);
      if (!targetDateTime) {
        if (action.mode !== "move") return null;
        const targetDate = getAllDayDateFromPoint(clientX, clientY);
        if (!targetDate) return null;
        return {
          start: combineDateWithTime(targetDate, "00:00"),
          end: combineDateWithTime(targetDate, "23:59"),
        };
      }

      if (action.mode === "resize-start" || action.mode === "resize-end") {
        return normalizeTimedResizeRange(
          action.entry,
          targetDateTime,
          action.mode === "resize-start" ? "start" : "end",
        );
      }

      return moveDateRange(
        { start: new Date(action.entry.startTime), end: new Date(action.entry.endTime) },
        targetDateTime,
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      const action = calendarPointerActionRef.current;
      if (!action) return;

      const distance = Math.hypot(event.clientX - action.startX, event.clientY - action.startY);
      if (distance < 4) return;

      const preview = buildPreview(action, event.clientX, event.clientY);
      if (!preview) {
        setCalendarPointerPreview(null);
        return;
      }

      setCalendarPointerPreview({
        entry: action.entry,
        mode: action.mode,
        startTime: preview.start.toISOString(),
        endTime: preview.end.toISOString(),
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const action = calendarPointerActionRef.current;
      if (!action) return;
      calendarPointerActionRef.current = null;
      setCalendarPointerPreview(null);

      const distance = Math.hypot(event.clientX - action.startX, event.clientY - action.startY);
      if (distance < 4) {
        handleEntryClick(action.entry);
        return;
      }

      const nextRange = buildPreview(action, event.clientX, event.clientY);
      if (!nextRange) return;
      updateCalendarEntryRangeMutation.mutate({ entry: action.entry, start: nextRange.start, end: nextRange.end });
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [calendarSettings.gridStep, selectedDate, threeDays, updateCalendarEntryRangeMutation, weekDays]);

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

  const shiftSelectedDate = (direction: -1 | 1) => {
    const current = selectedDate;
    if (viewMode === "month") {
      setSelectedDate(new Date(current.getFullYear(), current.getMonth() + direction, 1));
      return;
    }
    if (viewMode === "3days") {
      setSelectedDate(addDays(current, direction * 3));
      return;
    }
    if (viewMode === "day") {
      setSelectedDate(addDays(current, direction));
      return;
    }
    setSelectedDate(addDays(current, direction * 7));
  };

  const toolbarPeriodLabel = (() => {
    if (viewMode === "month") return format(selectedDate, "LLLL yyyy", { locale: ru });
    if (viewMode === "day") return format(selectedDate, "d MMM yyyy", { locale: ru });
    if (viewMode === "3days") {
      const end = addDays(selectedDate, 2);
      return `${format(selectedDate, "d MMM", { locale: ru })} – ${format(end, "d MMM yyyy", { locale: ru })}`;
    }
    return `${format(weekStart, "d MMM", { locale: ru })} – ${format(weekEnd, "d MMM yyyy", { locale: ru })}`;
  })();

  const renderAllDayZone = (days: Date[], scope: "week" | "3days" | "day") => {
    if (!calendarSettings.showAllDay) return null;
    const allDayEntries = entries.filter((entry) => isAllDayEntry(entry) && days.some((day) => entryOverlapsDate(entry, day)));
    const allDayPreview =
      calendarPointerPreview &&
      new Date(calendarPointerPreview.startTime).getHours() === 0 &&
      new Date(calendarPointerPreview.startTime).getMinutes() === 0 &&
      new Date(calendarPointerPreview.endTime).getHours() >= 23 &&
      new Date(calendarPointerPreview.endTime).getMinutes() >= 45
        ? calendarPointerPreview
        : null;
    const dayColumnTemplate = `repeat(${Math.max(1, days.length)}, minmax(0,1fr))`;
    if (allDayEntries.length === 0 && !allDayPreview) {
      return (
        <div className="grid border-b border-border/30 bg-muted/20" style={{ gridTemplateColumns: `56px repeat(${Math.max(1, days.length)}, minmax(0,1fr))` }}>
          <div className="border-r border-border/35 px-2 py-2 text-[11px] font-medium text-muted-foreground">Весь день</div>
          {days.map((day, dayIndex) => (
            <div
              key={day.toISOString()}
              data-calendar-all-day
              data-scope={scope}
              data-day-index={dayIndex}
              className="min-h-10 border-r border-border/35 last:border-r-0"
            />
          ))}
        </div>
      );
    }

    return (
      <div className="grid border-b border-border/30 bg-muted/20" style={{ gridTemplateColumns: `56px repeat(${Math.max(1, days.length)}, minmax(0,1fr))` }}>
        <div className="border-r border-border/35 px-2 py-2 text-[11px] font-medium text-muted-foreground">Весь день</div>
        <div
          className="relative max-h-28 min-h-10 overflow-y-auto p-1"
          style={{ gridColumn: `span ${Math.max(1, days.length)} / span ${Math.max(1, days.length)}` }}
        >
          <div className="absolute inset-1 grid gap-1" style={{ gridTemplateColumns: dayColumnTemplate }}>
            {days.map((day, dayIndex) => (
              <div
                key={day.toISOString()}
                data-calendar-all-day
                data-scope={scope}
                data-day-index={dayIndex}
                className="min-h-8 rounded-lg border border-dashed border-border/25"
              />
            ))}
          </div>
          <div
            className="relative grid gap-1"
            style={{ gridTemplateColumns: dayColumnTemplate, gridAutoRows: "minmax(2rem, auto)" }}
          >
            {allDayEntries.map((entry, index) => {
            const visibleIndexes = days.map((day, dayIndex) => entryOverlapsDate(entry, day) ? dayIndex : -1).filter((value) => value >= 0);
            const first = visibleIndexes[0] ?? 0;
            const last = visibleIndexes.at(-1) ?? first;
            return (
              <button
                key={entry.id}
                type="button"
                data-calendar-all-day-entry
                className={cn("relative z-10 min-w-0 cursor-grab rounded-lg border border-border/40 px-2 py-1 text-left text-xs shadow-sm", getEventCardClasses(entry))}
                style={{ gridColumn: `${first + 1} / span ${Math.max(1, last - first + 1)}`, gridRow: index + 1, ...getEntryColorStyle(entry) }}
                onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "all-day-move")}
              >
                <span
                  aria-label="Изменить начало"
                  className="absolute inset-y-0 left-0 z-20 w-6 cursor-ew-resize rounded-l-lg bg-primary/20 opacity-0 transition-opacity hover:opacity-100"
                  onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "all-day-resize-start")}
                />
                <span className="block truncate font-medium">{entry.title}</span>
                <span
                  aria-label="Изменить окончание"
                  className="absolute inset-y-0 right-0 z-20 w-6 cursor-ew-resize rounded-r-lg bg-primary/20 opacity-0 transition-opacity hover:opacity-100"
                  onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "all-day-resize-end")}
                />
              </button>
            );
            })}
            {allDayPreview && (() => {
              const start = new Date(allDayPreview.startTime);
              const end = new Date(allDayPreview.endTime);
              const visibleIndexes = days
                .map((day, dayIndex) => {
                  const dayStart = combineDateWithTime(day, "00:00").getTime();
                  const dayEnd = combineDateWithTime(day, "23:59").getTime();
                  return start.getTime() <= dayEnd && end.getTime() >= dayStart ? dayIndex : -1;
                })
                .filter((value) => value >= 0);
              const first = visibleIndexes[0] ?? 0;
              const last = visibleIndexes.at(-1) ?? first;
              return (
                <div
                  className="pointer-events-none relative z-20 min-w-0 rounded-lg border border-primary/70 bg-primary/20 px-2 py-1 text-left text-xs text-foreground shadow-lg ring-2 ring-primary/25"
                  style={{ gridColumn: `${first + 1} / span ${Math.max(1, last - first + 1)}`, gridRow: allDayEntries.length + 1 }}
                >
                  <span className="block truncate font-semibold">{allDayPreview.entry.title}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderCompressedHoursControl = (days: Date[], range: "before" | "after") => {
    const startsAt = range === "before" ? 0 : workdayEnd;
    const endsAt = range === "before" ? workdayStart : 24;
    if (endsAt <= startsAt) return null;
    const isExpanded = expandedNonWorkingRanges[range];

    const entriesInRange = days.flatMap((day) =>
      getEntriesForDate(day).filter((entry) => {
        if (isAllDayEntry(entry)) return false;
        const start = new Date(entry.startTime);
        const hour = start.getHours() + start.getMinutes() / 60;
        return hour >= startsAt && hour < endsAt;
      }),
    );

    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-b border-border/20 bg-muted/20 px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted/35"
        onClick={() => setExpandedNonWorkingRanges((prev) => ({ ...prev, [range]: !prev[range] }))}
      >
        <span>
          {String(startsAt).padStart(2, "0")}:00 - {String(endsAt).padStart(2, "0")}:00 {isExpanded ? "раскрыто" : "сжато"}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5">
          {isExpanded ? "Свернуть" : entriesInRange.length > 0 ? `${entriesInRange.length} внутри` : "Раскрыть"}
        </span>
      </button>
    );
  };

  if (isLoadingEvents || isLoadingTasks || isLoadingKanbanCards) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden px-2 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full min-w-0">
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
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-border/35 shrink-0" onClick={() => shiftSelectedDate(-1)}>←</Button>
          <span className="text-xs sm:text-sm font-medium text-foreground min-w-[90px] sm:min-w-[100px] text-center truncate">
            {toolbarPeriodLabel}
          </span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-border/35 shrink-0" onClick={() => shiftSelectedDate(1)}>→</Button>
        </div>
        <Button variant="outline" size="sm" className="h-8 rounded-lg border-border/35 text-xs shrink-0" onClick={() => setSelectedDate(new Date())}>
          Сегодня
        </Button>
        <Button variant="outline" size="sm" className="h-8 rounded-lg border-border/35 text-xs shrink-0 hidden sm:flex" onClick={() => setSettingsOpen(true)} title="Настройки календаря">
          <Settings className="h-4 w-4 mr-1.5" />
          Настройки
        </Button>
        <div className="flex rounded-lg p-0.5 bg-muted/40 shrink-0 overflow-x-auto hide-scrollbar">
          {(["month", "week", "3days", "day", "list"] as const).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 text-[10px] sm:text-xs px-2 sm:px-2.5 rounded-md shrink-0 border border-transparent",
                viewMode === mode && "bg-primary text-primary-foreground border-primary/60 shadow-sm"
              )}
              onClick={() => setViewMode(mode)}
            >
              {mode === "month" && "Месяц"}
              {mode === "week" && "Неделя"}
              {mode === "3days" && "3 дня"}
              {mode === "day" && "День"}
              {mode === "list" && "Список"}
            </Button>
          ))}
        </div>
      </div>

      {viewMode === "month" ? (
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1 sm:gap-1.5 p-2 sm:p-3 bg-card rounded-xl border border-border/40 w-full min-w-0">
            <div className="flex items-center gap-2 text-foreground shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="font-semibold text-base sm:text-lg truncate">{format(selectedDate, "LLLL yyyy", { locale: ru })}</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto min-w-0">
              <Button variant="outline" size="sm" className="border-border/35 text-xs sm:text-sm flex-1 min-w-0 sm:flex-initial px-2 sm:px-3 rounded-xl" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}>← Пред</Button>
              <Button variant="outline" size="sm" className="border-border/35 text-xs sm:text-sm flex-1 min-w-0 sm:flex-initial px-2 sm:px-3 rounded-xl" onClick={() => setSelectedDate(new Date())}>Сегодня</Button>
              <Button variant="outline" size="sm" className="border-border/35 text-xs sm:text-sm flex-1 min-w-0 sm:flex-initial px-2 sm:px-3 rounded-xl" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}>След →</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/35 overflow-hidden bg-card min-w-0">
            <div className="grid grid-cols-7 border-b border-border/30">
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
                        "min-h-[56px] sm:min-h-[72px] md:min-h-[84px] p-0.5 sm:p-1 border-b border-border/30",
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
                            style={getEntryColorStyle(entry, "inline")}
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
        <div ref={weekScrollRef} className="rounded-xl border border-border/30 bg-card overflow-hidden min-w-0 max-h-[70vh] sm:max-h-[75vh] overflow-y-auto overflow-x-auto">
          {renderAllDayZone(weekDays, "week")}
          {renderCompressedHoursControl(weekDays, "before")}
          <div className="grid min-w-0" style={{ gridTemplateColumns: `minmax(44px,56px) repeat(${weekColumnCount}, minmax(0,1fr))` }}>
            <div className="border-b border-r border-border/35 py-1.5 sm:py-2 pl-1.5 sm:pl-2 text-[10px] sm:text-xs font-medium text-foreground">Н{weekNumber}</div>
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="text-center py-1.5 sm:py-2 px-0.5 border-b border-r border-border/35 last:border-r-0 min-w-[2.5rem] sm:min-w-0">
                  <div className="text-[9px] sm:text-xs text-muted-foreground uppercase truncate">{format(day, "EEE", { locale: ru })}</div>
                  <div className={cn("text-xs sm:text-sm font-semibold rounded inline-block min-w-[1.25rem]", isToday && "bg-red-500 text-white px-1")}>{format(day, "d")}</div>
                </div>
              );
            })}
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((hour) => (
              <Fragment key={hour}>
                <div className="flex items-start justify-end pr-0.5 sm:pr-1 text-[10px] sm:text-xs text-muted-foreground border-b border-r border-border/35 shrink-0" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}>
                  {`${String(hour).padStart(2, "0")}:00`}
                </div>
                {weekDays.map((day) => (
                  <div key={`${hour}-${day.toISOString()}`} className="border-b border-r border-border/35 last:border-r-0 min-w-0" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }} />
                ))}
              </Fragment>
            ))}
          </div>
          <div className="relative pointer-events-none mt-0" style={{ marginTop: -(HOUR_END - HOUR_START) * ROW_HEIGHT }}>
            <div className="grid min-w-0 pointer-events-auto" style={{ gridTemplateColumns: `minmax(44px,56px) repeat(${weekColumnCount}, minmax(0,1fr))` }}>
              <div className="col-span-1" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT }} />
              <div className="relative" style={{ gridColumn: `span ${weekColumnCount} / span ${weekColumnCount}`, height: (HOUR_END - HOUR_START) * ROW_HEIGHT, minHeight: (HOUR_END - HOUR_START) * ROW_HEIGHT }}>
                {weekDays.map((day, dayIndex) =>
                  visibleTimeSlots.map((time) => {
                    const [hourPart, minutePart] = time.split(":").map(Number);
                    const slot = hourPart + minutePart / 60;
                    if (slot < HOUR_START || slot >= HOUR_END) return null;
                    const isSelected = slotSelectStart && slotSelectEnd && (() => {
                      const minD = Math.min(slotSelectStart.dayIndex, slotSelectEnd.dayIndex);
                      const maxD = Math.max(slotSelectStart.dayIndex, slotSelectEnd.dayIndex);
                      const minH = Math.min(slotSelectStart.hour, slotSelectEnd.hour);
                      const maxH = Math.max(slotSelectStart.hour, slotSelectEnd.hour);
                      return dayIndex >= minD && dayIndex <= maxD && slot >= minH && slot <= maxH;
                    })();
                    return (
                      <div
                        key={`slot-${dayIndex}-${time}`}
                        data-calendar-slot
                        data-scope="week"
                        data-day-index={dayIndex}
                        data-hour={slot}
                        className={cn("absolute left-0 cursor-cell transition-colors duration-150 hover:bg-primary/10", isSelected && "bg-primary/40 ring-2 ring-inset ring-primary/60")}
                        style={{ left: `${(100 / weekColumnCount) * dayIndex}%`, width: `${100 / weekColumnCount}%`, top: (slot - HOUR_START) * ROW_HEIGHT, height: CALENDAR_SLOT_HEIGHT }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSlotSelectStart({ dayIndex, hour: slot });
                          setSlotSelectEnd({ dayIndex, hour: slot });
                        }}
                      />
                    );
                  })
                )}
                {showNowLine && nowColumnIndex >= 0 && (
                  <div className="absolute h-px bg-red-500 z-10 pointer-events-none" style={{ top: nowTop, left: `${(100 / nowColumnCount) * nowColumnIndex}%`, width: `${100 / nowColumnCount}%` }} />
                )}
                {renderSlotSelectionPreview(weekDays, weekColumnCount, "week")}
                {weekDays.map((day, dayIndex) => {
                  const dayEntries = getEntriesForDate(day).filter((entry) => {
                    if (isAllDayEntry(entry)) return false;
                    const start = new Date(entry.startTime);
                    const end = new Date(entry.endTime);
                    const hStart = start.getHours() + start.getMinutes() / 60;
                    const hEnd = end.getHours() + end.getMinutes() / 60;
                    return hEnd > HOUR_START && hStart < HOUR_END;
                  });
                  const laneLayout = getEventLaneLayout(dayEntries);
                  return (
                    <div key={day.toISOString()} className="absolute top-0 bottom-0 border-l border-border/30 first:border-l-0 z-10" style={{ left: `${(100 / weekColumnCount) * dayIndex}%`, width: `${100 / weekColumnCount}%`, pointerEvents: "none" }}>
                      {dayEntries.map((entry) => {
                        const style = getEventBlockStyle(entry);
                        const overlapStyle = getEventOverlapStyle(entry.id, laneLayout);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            data-calendar-entry-block
                            className={cn("absolute rounded-xl text-xs overflow-hidden cursor-grab active:cursor-grabbing pointer-events-auto shadow-md hover:shadow-lg transition-all duration-200 backdrop-blur-sm border border-border/30 text-left", getEventCardClasses(entry))}
                            style={{ ...style, ...overlapStyle, minHeight: 24, ...getEntryColorStyle(entry) }}
                            onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "move")}
                          >
                            <span
                              aria-label="Изменить начало"
                              className="absolute inset-x-0 top-0 h-7 cursor-ns-resize rounded-t-xl bg-gradient-to-b from-primary/30 to-transparent opacity-20 transition-opacity hover:opacity-100"
                              onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-start")}
                            />
                            <div className="p-1.5 truncate font-medium leading-tight">{entry.title}</div>
                            <div className="px-1.5 text-[10px] opacity-90 truncate">{getEntryMetaLine(entry)}</div>
                            <div className="px-1.5 pb-1.5 text-[10px] opacity-90 truncate flex items-center gap-0.5">
                              {entry.kind === "event" ? <MapPin className="w-3 h-3 shrink-0" /> : <UserRound className="w-3 h-3 shrink-0" />}
                              {entry.kind === "event" ? entry.location || "Без локации" : entry.responsibleLabel || "Без исполнителя"}
                            </div>
                            <span
                              aria-label="Изменить длительность"
                              className="absolute inset-x-0 bottom-0 h-7 cursor-ns-resize rounded-b-xl bg-gradient-to-t from-primary/30 to-transparent opacity-20 transition-opacity hover:opacity-100"
                              onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-end")}
                            />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {renderTimedPointerPreview(weekDays, weekColumnCount, "week")}
              </div>
            </div>
          </div>
          {renderCompressedHoursControl(weekDays, "after")}
        </div>
      ) : viewMode === "3days" ? (
        <div ref={threeDaysScrollRef} className="rounded-xl border border-border/30 bg-card overflow-hidden min-w-0 max-h-[75vh] overflow-y-auto">
          {renderAllDayZone(threeDays, "3days")}
          {renderCompressedHoursControl(threeDays, "before")}
          <div className="grid min-w-0" style={{ gridTemplateColumns: "56px 1fr 1fr 1fr" }}>
            <div className="border-b border-r border-border/35 py-2 pl-2 text-xs font-medium text-foreground">Неделя {getISOWeek(weekStart)}</div>
            {threeDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="text-center py-2 px-1 border-b border-l border-border/30">
                  <div className="text-[10px] sm:text-xs text-muted-foreground uppercase">{format(day, "EEE", { locale: ru })}</div>
                  <div className={cn("text-sm font-semibold rounded-md inline-block min-w-[1.5rem]", isToday && "bg-red-500 text-white px-1")}>{format(day, "d")}</div>
                </div>
              );
            })}
            <div className="relative col-start-1 row-start-2 flex flex-col border-r border-border/35 shrink-0" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT, minHeight: (HOUR_END - HOUR_START) * ROW_HEIGHT }}>
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((hour) => (
                <div key={hour} className="flex items-start justify-end pr-1 text-xs text-muted-foreground shrink-0" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}>
                  {`${String(hour).padStart(2, "0")}:00`}
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
                  <div key={day.toISOString()} className="relative border-r border-border/30 last:border-r-0">
                    {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                      <div key={i} className="border-b border-border/20" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }} />
                    ))}
                  </div>
                ))}
              </div>
              {showNowLine3 && nowColumnIndex >= 0 && (
                <div className="absolute h-px bg-red-500 z-10 pointer-events-none" style={{ top: nowTop, left: `${(100 / threeDayColumnCount) * nowColumnIndex}%`, width: `${100 / threeDayColumnCount}%` }} />
              )}
              {threeDays.map((day, dayIndex) =>
                visibleTimeSlots.map((time) => {
                  const [hourPart, minutePart] = time.split(":").map(Number);
                  const slot = hourPart + minutePart / 60;
                  if (slot < HOUR_START || slot >= HOUR_END) return null;
                  const isSelected = slotSelectStart && slotSelectEnd && (() => {
                    const minD = Math.min(slotSelectStart.dayIndex, slotSelectEnd.dayIndex);
                    const maxD = Math.max(slotSelectStart.dayIndex, slotSelectEnd.dayIndex);
                    const minH = Math.min(slotSelectStart.hour, slotSelectEnd.hour);
                    const maxH = Math.max(slotSelectStart.hour, slotSelectEnd.hour);
                    return dayIndex >= minD && dayIndex <= maxD && slot >= minH && slot <= maxH;
                  })();
                  return (
                    <div
                      key={`three-slot-${day.toISOString()}-${time}`}
                      data-calendar-slot
                      data-scope="3days"
                      data-day-index={dayIndex}
                      data-hour={slot}
                      className={cn("absolute cursor-cell transition-colors duration-150 hover:bg-primary/10", isSelected && "bg-primary/40 ring-2 ring-inset ring-primary/60")}
                      style={{ left: `${(100 / threeDayColumnCount) * dayIndex}%`, width: `${100 / threeDayColumnCount}%`, top: (slot - HOUR_START) * ROW_HEIGHT, height: CALENDAR_SLOT_HEIGHT }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSlotSelectStart({ dayIndex, hour: slot });
                        setSlotSelectEnd({ dayIndex, hour: slot });
                      }}
                    />
                  );
                })
              )}
              {renderSlotSelectionPreview(threeDays, threeDayColumnCount, "3days")}
              {threeDays.map((day, dayIndex) => {
                const dayEntries = getEntriesForDate(day).filter((entry) => {
                  if (isAllDayEntry(entry)) return false;
                  const start = new Date(entry.startTime);
                  const end = new Date(entry.endTime);
                  const hStart = start.getHours() + start.getMinutes() / 60;
                  const hEnd = end.getHours() + end.getMinutes() / 60;
                  return hEnd > HOUR_START && hStart < HOUR_END;
                });
                const laneLayout = getEventLaneLayout(dayEntries);
                return (
                  <div key={day.toISOString()} className="absolute top-0 bottom-0 border-l border-border/30 first:border-l-0" style={{ left: `${(100 / threeDayColumnCount) * dayIndex}%`, width: `${100 / threeDayColumnCount}%`, pointerEvents: "none" }}>
                    {dayEntries.map((entry) => {
                      const style = getEventBlockStyle(entry);
                      const overlapStyle = getEventOverlapStyle(entry.id, laneLayout);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          data-calendar-entry-block
                          className={cn("absolute rounded-xl text-xs overflow-hidden cursor-grab active:cursor-grabbing pointer-events-auto shadow-md hover:shadow-lg transition-all duration-200 backdrop-blur-sm border border-border/30 text-left", getEventCardClasses(entry))}
                          style={{ ...style, ...overlapStyle, minHeight: 24, ...getEntryColorStyle(entry) }}
                          onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "move")}
                        >
                          <span
                            aria-label="Изменить начало"
                            className="absolute inset-x-0 top-0 h-7 cursor-ns-resize rounded-t-xl bg-gradient-to-b from-primary/30 to-transparent opacity-20 transition-opacity hover:opacity-100"
                            onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-start")}
                          />
                          <div className="p-1.5 truncate font-medium leading-tight">{entry.title}</div>
                          <div className="px-1.5 text-[10px] opacity-90 truncate">{getEntryMetaLine(entry)}</div>
                          <div className="px-1.5 pb-1.5 text-[10px] opacity-90 truncate flex items-center gap-0.5">
                            {entry.kind === "event" ? <MapPin className="w-3 h-3 shrink-0" /> : <UserRound className="w-3 h-3 shrink-0" />}
                            {entry.kind === "event" ? entry.location || "Без локации" : entry.responsibleLabel || "Без исполнителя"}
                          </div>
                          <span
                            aria-label="Изменить длительность"
                            className="absolute inset-x-0 bottom-0 h-7 cursor-ns-resize rounded-b-xl bg-gradient-to-t from-primary/30 to-transparent opacity-20 transition-opacity hover:opacity-100"
                            onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-end")}
                          />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {renderTimedPointerPreview(threeDays, threeDayColumnCount, "3days")}
            </div>
          </div>
          {renderCompressedHoursControl(threeDays, "after")}
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-xl border border-border/30 bg-card overflow-hidden min-w-0">
          <div className="p-2 sm:p-3 border-b border-border/30">
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
                <Card key={entry.id} className={cn("rounded-xl border border-border/50 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-sm", getEventCardClasses(entry))} style={getEntryColorStyle(entry)} onClick={() => handleEntryClick(entry)}>
                  <CardHeader className="pb-1.5 p-2.5 sm:p-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-base break-words">{entry.title}</CardTitle>
                        {renderCardMeta(entry, entry._day)}
                      </div>
                      <Badge className={cn("shrink-0", getEventBadgeClasses(entry), "text-xs sm:text-sm")} style={getEntryColorStyle(entry, "badge")}>{entry.badgeText}</Badge>
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
          <Card className="rounded-xl border border-border/35">
            <CardHeader className="p-2.5 sm:p-4">
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <div className="flex items-center gap-1.5 text-sm sm:text-base">
                  <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{format(selectedDate, "d MMMM yyyy, EEEE", { locale: ru })}</span>
                </div>
                <div className="flex flex-wrap gap-1 w-full sm:w-auto min-w-0">
                  <Button variant="outline" size="sm" className="flex-1 min-w-0 sm:flex-initial text-xs px-2 rounded-lg border-border/35" onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 86400000))}>← Вчера</Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-0 sm:flex-initial text-xs px-2 rounded-lg border-border/35" onClick={() => setSelectedDate(new Date())}>Сегодня</Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-0 sm:flex-initial text-xs px-2 rounded-lg border-border/35" onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 86400000))}>Завтра →</Button>
                </div>
              </CardTitle>
            </CardHeader>
            {renderAllDayZone([selectedDate], "day")}
            {renderCompressedHoursControl([selectedDate], "before")}
            <CardContent className="p-0">
              <div className="grid max-h-[75vh] overflow-y-auto" style={{ gridTemplateColumns: "56px minmax(0,1fr)" }}>
                <div className="relative border-r border-border/35" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT }}>
                  {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((hour) => (
                    <div key={hour} className="flex items-start justify-end pr-1 text-xs text-muted-foreground" style={{ height: ROW_HEIGHT }}>
                      {`${String(hour).padStart(2, "0")}:00`}
                    </div>
                  ))}
                </div>
                <div className="relative" style={{ height: (HOUR_END - HOUR_START) * ROW_HEIGHT }}>
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                      <div key={i} className="border-b border-border/30" style={{ height: ROW_HEIGHT }} />
                    ))}
                  </div>
                  {visibleTimeSlots.map((time) => {
                    const [hourPart, minutePart] = time.split(":").map(Number);
                    const slot = hourPart + minutePart / 60;
                    if (slot < HOUR_START || slot >= HOUR_END) return null;
                    const isSelected = slotSelectStart && slotSelectEnd && slotSelectStart.dayIndex === 0 && slotSelectEnd.dayIndex === 0 && slot >= Math.min(slotSelectStart.hour, slotSelectEnd.hour) && slot <= Math.max(slotSelectStart.hour, slotSelectEnd.hour);
                    return (
                      <div
                        key={`day-slot-${time}`}
                        data-calendar-slot
                        data-scope="day"
                        data-day-index={0}
                        data-hour={slot}
                        className={cn("absolute left-0 w-full cursor-cell transition-colors duration-150 hover:bg-primary/10", isSelected && "bg-primary/40 ring-2 ring-inset ring-primary/60")}
                        style={{ top: (slot - HOUR_START) * ROW_HEIGHT, height: CALENDAR_SLOT_HEIGHT }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSlotSelectStart({ dayIndex: 0, hour: slot });
                          setSlotSelectEnd({ dayIndex: 0, hour: slot });
                        }}
                      />
                    );
                  })}
                  {renderSlotSelectionPreview([selectedDate], 1, "day")}
                  {(() => {
                    const dayEntries = getEntriesForDate(selectedDate).filter((entry) => !isAllDayEntry(entry));
                    const laneLayout = getEventLaneLayout(dayEntries);
                    return dayEntries.map((entry) => {
                      const style = getEventBlockStyle(entry);
                      const overlapStyle = getEventOverlapStyle(entry.id, laneLayout);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          data-calendar-entry-block
                          className={cn("absolute cursor-grab active:cursor-grabbing rounded-xl border border-border/40 p-2 text-left text-xs shadow-md transition hover:shadow-lg", getEventCardClasses(entry))}
                          style={{ top: style.top, height: style.height, minHeight: 28, ...overlapStyle, ...getEntryColorStyle(entry) }}
                          onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "move")}
                        >
                          <span
                            aria-label="Изменить начало"
                            className="absolute inset-x-0 top-0 h-7 cursor-ns-resize rounded-t-xl bg-gradient-to-b from-primary/30 to-transparent opacity-20 transition-opacity hover:opacity-100"
                            onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-start")}
                          />
                          <div className="truncate font-medium">{entry.title}</div>
                          <div className="truncate text-[10px] opacity-90">{getEntryMetaLine(entry)}</div>
                          <div className="truncate text-[10px] opacity-90">
                            {entry.kind === "event" ? entry.location || "Без локации" : entry.responsibleLabel || "Без исполнителя"}
                          </div>
                          <span
                            aria-label="Изменить длительность"
                            className="absolute inset-x-0 bottom-0 h-7 cursor-ns-resize rounded-b-xl bg-gradient-to-t from-primary/30 to-transparent opacity-20 transition-opacity hover:opacity-100"
                            onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-end")}
                          />
                        </button>
                      );
                    });
                  })()}
                  {renderTimedPointerPreview([selectedDate], 1, "day")}
                </div>
              </div>
            </CardContent>
            {renderCompressedHoursControl([selectedDate], "after")}
          </Card>
        </div>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card p-0 overflow-hidden gap-0">
          {selectedEntry && (
            <div className="p-4 sm:p-5 space-y-4">
              {isTaskEntry(selectedEntry) || isKanbanEntry(selectedEntry) ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-3 h-3 rounded-full shrink-0 mt-1", getEventDotClass(selectedEntry))} style={getEntryDotStyle(selectedEntry)} />
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground leading-tight break-words pr-6">{selectedEntry.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={cn(getEventBadgeClasses(selectedEntry), "text-xs")} style={getEntryColorStyle(selectedEntry, "badge")}>{selectedEntry.badgeText}</Badge>
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
                    {isKanbanEntry(selectedEntry) && (
                      <>
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                          <span className="text-foreground">
                            Старт: {formatDueDateLabel(selectedEntry.task.startDate) || "Не задан"}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                          <span className="text-foreground">
                            Срок: {formatDueDateLabel(selectedEntry.task.dueDate) || "Не задан"}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Flag className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                          <span className="text-foreground">
                            Статус срока: {getDueDateStatusLabel(getDueDateStatus(selectedEntry.task.dueDate, { isComplete: selectedEntry.task.listType === "closed" || selectedEntry.task.listType === "archive" || selectedEntry.task.listType === "trash" }))}
                          </span>
                        </div>
                      </>
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
                            <div key={subtask.id} className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-foreground">
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
                            <a key={`${link.url || index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border/50 px-3 py-2 text-primary hover:underline">
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
                            <div key={`${file.url || file.name || index}`} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-foreground">
                              <Paperclip className="w-4 h-4 text-primary shrink-0" />
                              <span className="truncate">{file.name || file.url || "Файл"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border/35">
                    {isKanbanEntry(selectedEntry) && (
                      <Button
                        size="sm"
                        onClick={() => {
                          window.location.href = `/tasks?boardId=${encodeURIComponent(selectedEntry.task.boardId)}&cardId=${encodeURIComponent(selectedEntry.task.id)}`;
                        }}
                      >
                        Открыть карточку
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                      Закрыть
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-3 h-3 rounded-full shrink-0 mt-1", getEventDotClass(selectedEntry))} style={getEntryDotStyle(selectedEntry)} />
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
                      <Badge className={cn(getEventBadgeClasses(selectedEntry), "text-xs")} style={getEntryColorStyle(selectedEntry, "badge")}>{getEventTypeText(selectedEntry.type)}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border/35">
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle>Настройки календаря</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Начало рабочего дня</span>
                <select
                  className="h-10 rounded-xl border border-border/50 bg-background px-3 text-foreground"
                  value={calendarSettings.workdayStart}
                  onChange={(event) => setCalendarSettings((prev) => ({ ...prev, workdayStart: Number(event.target.value) }))}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Конец рабочего дня</span>
                <select
                  className="h-10 rounded-xl border border-border/50 bg-background px-3 text-foreground"
                  value={calendarSettings.workdayEnd}
                  onChange={(event) => setCalendarSettings((prev) => ({ ...prev, workdayEnd: Number(event.target.value) }))}
                >
                  {Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => (
                    <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Шаг сетки</span>
              <select
                className="h-10 rounded-xl border border-border/50 bg-background px-3 text-foreground"
                value={calendarSettings.gridStep}
                onChange={(event) => setCalendarSettings((prev) => ({ ...prev, gridStep: Number(event.target.value) as 15 | 30 | 60 }))}
              >
                <option value={15}>15 минут</option>
                <option value={30}>30 минут</option>
                <option value={60}>60 минут</option>
              </select>
            </label>

            <div className="grid gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
              {[
                ["showWeekends", "Показывать выходные"],
                ["showAllDay", "Показывать all-day зону"],
                ["compactMode", "Компактный режим"],
              ].map(([key, title]) => (
                <label key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span>{title}</span>
                  <Checkbox
                    checked={Boolean(calendarSettings[key as keyof CalendarSettings])}
                    onCheckedChange={(checked) => setCalendarSettings((prev) => ({ ...prev, [key]: checked === true }))}
                  />
                </label>
              ))}
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Timezone label</span>
              <input
                className="h-10 rounded-xl border border-border/50 bg-background px-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
                value={calendarSettings.timezoneLabel}
                onChange={(event) => setCalendarSettings((prev) => ({ ...prev, timezoneLabel: event.target.value }))}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalendarSettings(DEFAULT_CALENDAR_SETTINGS)}>Сбросить</Button>
            <Button onClick={() => setSettingsOpen(false)}>Готово</Button>
          </DialogFooter>
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
