import { buildQuarterHourOptions } from "@/lib/task-dates";

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  location?: string | null;
  participants?: Array<{ id: string; userId: string; userName?: string; status?: string }>;
  type?: string;
  status?: string | null;
  color?: string | null;
};

export type CalendarTask = {
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

export type CalendarKanbanCard = {
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

export type CalendarUser = {
  id: string;
  name?: string | null;
  username?: string | null;
};

export type EventEntry = CalendarEvent & {
  kind: "event";
  badgeText: string;
  statusLabel: null;
  responsibleLabel: null;
};

export type TaskEntry = {
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

export type KanbanEntry = {
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

export type CalendarEntry = EventEntry | TaskEntry | KanbanEntry;

export type CalendarViewMode = "week" | "day" | "month" | "3days" | "list";

export type CalendarPointerMode =
  | "move"
  | "resize-start"
  | "resize-end"
  | "all-day-move"
  | "all-day-resize-start"
  | "all-day-resize-end";

export type CalendarPointerPreview = {
  entry: CalendarEntry;
  startTime: string;
  endTime: string;
  mode: CalendarPointerMode;
};

export type CalendarSettings = {
  workdayStart: number;
  workdayEnd: number;
  gridStep: 15 | 30 | 60;
  showWeekends: boolean;
  showAllDay: boolean;
  compactMode: boolean;
  timezoneLabel: string;
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  not_ready: "Бэклог",
  todo: "К выполнению",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово",
  cancelled: "Отменено",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

export const CALENDAR_TIME_SLOTS = buildQuarterHourOptions();
export const CALENDAR_SLOT_HEIGHT = 12;
export const CALENDAR_SETTINGS_STORAGE_KEY = "streamdesk_calendar_settings_v1";
export const EVENT_COLOR_STORAGE_KEY = "streamdesk_event_colors_v1";

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  workdayStart: 0,
  workdayEnd: 24,
  gridStep: 15,
  showWeekends: true,
  showAllDay: true,
  compactMode: false,
  timezoneLabel: "Moscow, GMT+3",
};

export const EVENT_COLOR_PALETTES = [
  {
    card: "border-l-chart-4 border-chart-4/30 bg-chart-4/10 text-foreground",
    inline: "border-l-chart-4 border-chart-4/30 bg-chart-4/15 text-foreground",
    dot: "bg-chart-4",
    badge: "border-chart-4/30 bg-chart-4/15 text-foreground",
  },
  {
    card: "border-l-chart-5 border-chart-5/30 bg-chart-5/10 text-foreground",
    inline: "border-l-chart-5 border-chart-5/30 bg-chart-5/15 text-foreground",
    dot: "bg-chart-5",
    badge: "border-chart-5/30 bg-chart-5/15 text-foreground",
  },
  {
    card: "border-l-chart-2 border-chart-2/30 bg-chart-2/10 text-foreground",
    inline: "border-l-chart-2 border-chart-2/30 bg-chart-2/15 text-foreground",
    dot: "bg-chart-2",
    badge: "border-chart-2/30 bg-chart-2/15 text-foreground",
  },
  {
    card: "border-l-chart-3 border-chart-3/30 bg-chart-3/10 text-foreground",
    inline: "border-l-chart-3 border-chart-3/30 bg-chart-3/15 text-foreground",
    dot: "bg-chart-3",
    badge: "border-chart-3/30 bg-chart-3/15 text-foreground",
  },
  {
    card: "border-l-chart-1 border-chart-1/30 bg-chart-1/10 text-foreground",
    inline: "border-l-chart-1 border-chart-1/30 bg-chart-1/15 text-foreground",
    dot: "bg-chart-1",
    badge: "border-chart-1/30 bg-chart-1/15 text-foreground",
  },
] as const;

export function readEventColorMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EVENT_COLOR_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function normalizeHexColor(value?: string | null) {
  const normalized = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : null;
}

export function getEventTypeText(type?: string) {
  switch (type) {
    case "task": return "Задача";
    case "kanban": return "Карточка";
    case "stream": return "Стрим";
    case "meeting": return "Встреча";
    case "production": return "Производство";
    case "maintenance": return "Обслуживание";
    case "recording": return "Запись";
    default: return type || "Событие";
  }
}

export function isTaskEntry(entry: CalendarEntry | null): entry is TaskEntry {
  return !!entry && entry.kind === "task";
}

export function isKanbanEntry(entry: CalendarEntry | null): entry is KanbanEntry {
  return !!entry && entry.kind === "kanban";
}

export function getCalendarEntryKey(entry: Pick<CalendarEntry, "kind" | "id">) {
  return `${entry.kind}:${entry.id}`;
}

export function slotNumberToTime(slot: number) {
  const hour = Math.floor(slot);
  const minute = Math.round((slot - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function roundDateToStep(value: Date, stepMinutes: number) {
  const next = new Date(value);
  const step = Math.max(1, stepMinutes);
  const roundedMinutes = Math.floor(next.getMinutes() / step) * step;
  next.setMinutes(roundedMinutes, 0, 0);
  return next;
}

export function addMinutesToDate(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

export function loadCalendarSettings(): CalendarSettings {
  if (typeof window === "undefined") return DEFAULT_CALENDAR_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CALENDAR_SETTINGS_STORAGE_KEY) || "{}");
    return {
      ...DEFAULT_CALENDAR_SETTINGS,
      ...parsed,
      workdayStart: Number.isFinite(Number(parsed.workdayStart))
        ? Number(parsed.workdayStart)
        : DEFAULT_CALENDAR_SETTINGS.workdayStart,
      workdayEnd: Number.isFinite(Number(parsed.workdayEnd))
        ? Number(parsed.workdayEnd)
        : DEFAULT_CALENDAR_SETTINGS.workdayEnd,
      gridStep: [15, 30, 60].includes(Number(parsed.gridStep))
        ? Number(parsed.gridStep) as 15 | 30 | 60
        : DEFAULT_CALENDAR_SETTINGS.gridStep,
    };
  } catch {
    return DEFAULT_CALENDAR_SETTINGS;
  }
}

export function isAllDayEntry(entry: CalendarEntry) {
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
}

export function entryOverlapsDate(entry: CalendarEntry, date: Date) {
  const start = new Date(entry.startTime);
  const end = new Date(entry.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return start.getTime() <= dayEnd.getTime() && end.getTime() >= dayStart.getTime();
}

export function buildCalendarEntries({ events, tasks, kanbanCards, userNameById }: {
  events: CalendarEvent[];
  tasks: CalendarTask[];
  kanbanCards: CalendarKanbanCard[];
  userNameById: ReadonlyMap<string, string>;
}): CalendarEntry[] {
  const taskTitles = new Set(tasks.map((task) => String(task?.title || "").trim()).filter(Boolean));
  const isLegacyTaskDeadlineEvent = (event: CalendarEvent) => {
    const title = String(event?.title || "").trim();
    if (!title.startsWith("Дедлайн: ")) return false;
    const taskTitle = title.slice("Дедлайн: ".length).trim();
    if (!taskTitle || !taskTitles.has(taskTitle)) return false;
    const description = String(event.description || "");
    return (
      event.type === "meeting" &&
      event.status === "scheduled" &&
      event.location === "Офис" &&
      (!description || description === `Задача: ${taskTitle}` || description.includes(taskTitle))
    );
  };

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
        responsibleLabel: card.assigneeUserId
          ? userNameById.get(String(card.assigneeUserId)) || "Назначен"
          : null,
        task: card,
      };
    });

  const eventEntries: EventEntry[] = events
    .filter((event) => !isLegacyTaskDeadlineEvent(event))
    .map((event) => ({
      ...event,
      kind: "event",
      badgeText: getEventTypeText(event.type),
      statusLabel: null,
      responsibleLabel: null,
    }));

  return [...eventEntries, ...taskEntries, ...kanbanEntries];
}
