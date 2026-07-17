import { useState, Fragment, useCallback, useEffect, useLayoutEffect, useRef, useMemo, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  UserRound,
} from "lucide-react";
import { EventForm } from "@/components/forms/event-form";
import { CalendarEntryDetailDialog } from "@/components/calendar/calendar-entry-detail-dialog";
import { CalendarSettingsDialog } from "@/components/calendar/calendar-settings-dialog";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  startOfMonth,
  endOfMonth,
  getISOWeek,
  addDays,
} from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  getCalendarEntryDensity,
  getCalendarEntryLaneLayout,
  getCalendarLaneStyle,
  getCalendarResizeHandleClassName,
} from "@/lib/calendar-layout";
import {
  combineDateWithTime,
  getDueDateStatus,
  getDueDateStatusClasses,
  getDueDateStatusLabel,
  moveDateRange,
  normalizeDateRange,
} from "@/lib/task-dates";
import {
  buildCalendarTimelineDays,
  CALENDAR_TIMELINE_BUFFER_DAYS,
  CALENDAR_TIMELINE_GUTTER_WIDTH,
  getCalendarTimelineDayWidth,
  getCalendarTimelineNextBufferDays,
  getCalendarTimelineScrollLeft,
  getCalendarTimelineSnapIndex,
  getCalendarTimelineVisibleDayCount,
  isCalendarTimelineNearBufferEdge,
  type CalendarTimelineViewMode,
} from "@/lib/calendar-timeline";
import {
  buildCalendarAllDayDraftSlot,
  CALENDAR_DATE_LONG_PRESS_MS,
  hasCalendarDatePressMoved,
} from "@/lib/calendar-all-day";
import {
  CALENDAR_SETTINGS_STORAGE_KEY,
  CALENDAR_SLOT_HEIGHT,
  CALENDAR_TIME_SLOTS,
  EVENT_COLOR_PALETTES,
  TASK_PRIORITY_LABELS,
  addMinutesToDate,
  buildCalendarEntries,
  entryOverlapsDate,
  getCalendarEntryKey,
  isAllDayEntry,
  loadCalendarSettings,
  normalizeHexColor,
  readEventColorMap,
  roundDateToStep,
  slotNumberToTime,
  type CalendarEntry,
  type CalendarEvent,
  type CalendarKanbanCard,
  type CalendarPointerMode,
  type CalendarPointerPreview,
  type CalendarSettings,
  type CalendarTask,
  type CalendarUser,
  type CalendarViewMode,
} from "@/lib/calendar-page-model";

export default function Calendar() {
  useWebSocket();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [draftSlot, setDraftSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>(() => loadCalendarSettings());
  const [calendarPointerPreview, setCalendarPointerPreview] = useState<CalendarPointerPreview | null>(null);
  const [slotSelectStart, setSlotSelectStart] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [slotSelectEnd, setSlotSelectEnd] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [expandedNonWorkingRanges, setExpandedNonWorkingRanges] = useState<{ before: boolean; after: boolean }>({ before: false, after: false });
  const [timelineBufferDays, setTimelineBufferDays] = useState(CALENDAR_TIMELINE_BUFFER_DAYS);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { toast } = useToast();
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollTimerRef = useRef<number | null>(null);
  const commitTimelineScrollRef = useRef<() => void>(() => undefined);
  const timelineRecenteringRef = useRef(false);
  const timelineLastScrollLeftRef = useRef(0);
  const timelineBufferDaysRef = useRef(CALENDAR_TIMELINE_BUFFER_DAYS);
  const timelinePendingBufferShiftRef = useRef(0);
  const timelinePendingRebaseOffsetRef = useRef<number | null>(null);
  const timelinePanRef = useRef<{
    pointerId: number;
    startX: number;
    scrollLeft: number;
  } | null>(null);
  const timelineDatePressRef = useRef<{
    pointerId: number;
    date: Date;
    startX: number;
    startY: number;
    moved: boolean;
    triggered: boolean;
    timerId: number | null;
  } | null>(null);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const calendarPointerActionRef = useRef<{
    mode: CalendarPointerMode;
    entry: CalendarEntry;
    startX: number;
    startY: number;
  } | null>(null);

  const openAllDayEventForm = useCallback((date: Date) => {
    setDraftSlot(buildCalendarAllDayDraftSlot(date));
    setSelectedEntry(null);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  }, []);

  const clearTimelineDatePressTimer = useCallback(() => {
    const press = timelineDatePressRef.current;
    if (press?.timerId != null) {
      window.clearTimeout(press.timerId);
      press.timerId = null;
    }
  }, []);

  const startTimelineDatePress = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    date: Date,
  ) => {
    if (!event.isPrimary || event.button !== 0) return;
    clearTimelineDatePressTimer();
    const press = {
      pointerId: event.pointerId,
      date: new Date(date),
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      triggered: false,
      timerId: null as number | null,
    };
    timelineDatePressRef.current = press;
    press.timerId = window.setTimeout(() => {
      if (timelineDatePressRef.current !== press || press.moved) return;
      press.triggered = true;
      openAllDayEventForm(press.date);
    }, CALENDAR_DATE_LONG_PRESS_MS);
  }, [clearTimelineDatePressTimer, openAllDayEventForm]);

  const updateTimelineDatePressMovement = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const press = timelineDatePressRef.current;
    if (!press || press.pointerId !== event.pointerId || press.moved) return;
    if (!hasCalendarDatePressMoved(
      { x: press.startX, y: press.startY },
      { x: event.clientX, y: event.clientY },
    )) return;
    press.moved = true;
    clearTimelineDatePressTimer();
  }, [clearTimelineDatePressTimer]);

  const finishTimelineDatePress = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    activate: boolean,
  ) => {
    const press = timelineDatePressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    clearTimelineDatePressTimer();
    timelineDatePressRef.current = null;
    if (activate && !press.moved && !press.triggered) {
      openAllDayEventForm(press.date);
    }
  }, [clearTimelineDatePressTimer, openAllDayEventForm]);

  useEffect(() => () => clearTimelineDatePressTimer(), [clearTimelineDatePressTimer]);

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
  const isTimelineView = viewMode === "week" || viewMode === "3days" || viewMode === "day";
  const timelineViewMode: CalendarTimelineViewMode = isTimelineView ? viewMode : "week";
  const timelineVisibleDayCount = getCalendarTimelineVisibleDayCount(
    timelineViewMode,
    calendarSettings.showWeekends,
  );
  const timelineDays = useMemo(
    () => buildCalendarTimelineDays({
      anchorDate: selectedDate,
      viewMode: timelineViewMode,
      showWeekends: calendarSettings.showWeekends,
      bufferDays: timelineBufferDays,
    }),
    [calendarSettings.showWeekends, selectedDate, timelineBufferDays, timelineViewMode],
  );
  const timelineVisibleDays = timelineDays.slice(
    timelineBufferDays,
    timelineBufferDays + timelineVisibleDayCount,
  );
  const timelineDayWidth = getCalendarTimelineDayWidth({
    viewportWidth: timelineViewportWidth,
    viewMode: timelineViewMode,
    showWeekends: calendarSettings.showWeekends,
  });
  const timelineContentWidth =
    CALENDAR_TIMELINE_GUTTER_WIDTH + timelineDays.length * timelineDayWidth;

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
    const slotDays = isTimelineView ? timelineDays : weekDays;
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
  }, [isTimelineView, slotSelectStart, slotSelectEnd, timelineDays, weekDays]);

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
      if (isTimelineView) scrollToCurrentHour(timelineScrollRef.current);
    }, 100);
    return () => clearTimeout(t);
  }, [ROW_HEIGHT, isTimelineView, viewMode, workdayStart]);

  useLayoutEffect(() => {
    if (!isTimelineView) return;
    const element = timelineScrollRef.current;
    if (!element) return;

    const updateViewportWidth = () => setTimelineViewportWidth(element.getBoundingClientRect().width);
    updateViewportWidth();
    const observer = new ResizeObserver(updateViewportWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isTimelineView, viewMode]);

  useLayoutEffect(() => {
    if (!isTimelineView || timelineViewportWidth <= 0) return;
    const element = timelineScrollRef.current;
    if (!element) return;

    timelineRecenteringRef.current = true;
    const pendingBufferShift = timelinePendingBufferShiftRef.current;
    if (pendingBufferShift > 0) {
      timelinePendingBufferShiftRef.current = 0;
      element.scrollLeft += pendingBufferShift * timelineDayWidth;
      timelineLastScrollLeftRef.current = element.scrollLeft;
      const frameId = window.requestAnimationFrame(() => {
        timelineRecenteringRef.current = false;
      });
      return () => {
        window.cancelAnimationFrame(frameId);
        timelineRecenteringRef.current = false;
      };
    }

    const pendingRebaseOffset = timelinePendingRebaseOffsetRef.current;
    if (pendingRebaseOffset != null) {
      timelinePendingRebaseOffsetRef.current = null;
      element.scrollLeft = getCalendarTimelineScrollLeft(
        timelineBufferDays,
        timelineDayWidth,
      ) + pendingRebaseOffset;
      timelineLastScrollLeftRef.current = element.scrollLeft;
      const frameId = window.requestAnimationFrame(() => {
        timelineRecenteringRef.current = false;
      });
      return () => {
        window.cancelAnimationFrame(frameId);
        timelineRecenteringRef.current = false;
      };
    }

    element.scrollLeft = getCalendarTimelineScrollLeft(
      timelineBufferDays,
      timelineDayWidth,
    );
    timelineLastScrollLeftRef.current = element.scrollLeft;
    const frameId = window.requestAnimationFrame(() => {
      timelineRecenteringRef.current = false;
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      timelineRecenteringRef.current = false;
    };
  }, [
    calendarSettings.showWeekends,
    isTimelineView,
    selectedDate,
    timelineBufferDays,
    timelineDayWidth,
    timelineViewportWidth,
    viewMode,
  ]);

  useEffect(() => () => {
    if (timelineScrollTimerRef.current != null) {
      window.clearTimeout(timelineScrollTimerRef.current);
    }
  }, []);

  const entries = useMemo(
    () => buildCalendarEntries({ events, tasks, kanbanCards, userNameById }),
    [events, kanbanCards, tasks, userNameById],
  );

  const entriesForDateCache = useMemo(() => new Map<string, CalendarEntry[]>(), [entries]);
  const getEntriesForDate = useCallback((date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const cachedEntries = entriesForDateCache.get(dateKey);
    if (cachedEntries) return cachedEntries;

    const matchingEntries = entries.filter((entry) => {
      if (!entry.startTime) return false;
      try {
        return isAllDayEntry(entry) ? entryOverlapsDate(entry, date) : isSameDay(new Date(entry.startTime), date);
      } catch {
        return false;
      }
    });
    entriesForDateCache.set(dateKey, matchingEntries);
    return matchingEntries;
  }, [entries, entriesForDateCache]);

  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const now = new Date();

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
    return getCalendarEntryLaneLayout(dayEntries, getCalendarEntryKey);
  };

  const getEventOverlapStyle = (entry: CalendarEntry, laneLayout: ReturnType<typeof getEventLaneLayout>) =>
    getCalendarLaneStyle(getCalendarEntryKey(entry), laneLayout);

  const getPalette = (entry: CalendarEntry) => {
    const urgency = getEntryDeadlineUrgency(entry);
    if (urgency === "overdue") {
      return {
        card: `border-l-error ${getDueDateStatusClasses("overdue").card} text-foreground`,
        inline: `border-l-error ${getDueDateStatusClasses("overdue").card} text-foreground`,
        dot: "bg-error",
        badge: getDueDateStatusClasses("overdue").badge,
      };
    }
    if (urgency === "soon") {
      return {
        card: `border-l-warning ${getDueDateStatusClasses("soon").card} text-foreground`,
        inline: `border-l-warning ${getDueDateStatusClasses("soon").card} text-foreground`,
        dot: "bg-warning",
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
  ) => {
    if (!calendarPointerPreview) return null;

    const start = new Date(calendarPointerPreview.startTime);
    const end = new Date(calendarPointerPreview.endTime);
    if (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() >= 23 && end.getMinutes() >= 45) return null;
    const dayIndex = days.findIndex((day) => isSameDay(day, start));
    if (dayIndex < 0) return null;

    const blockStyle = getEventBlockStyleFromRange(start, end);
    const horizontalStyle =
      columnCount === 1
        ? { left: "0.5rem", right: "0.5rem" }
        : {
            left: `calc(${(100 / columnCount) * dayIndex}% + 0.5rem)`,
            width: `calc(${100 / columnCount}% - 1rem)`,
          };

    return (
      <div
        className={cn(
          "pointer-events-none absolute z-30 rounded-control border border-primary/70 bg-primary/20 px-2 py-1 text-left text-xs text-foreground shadow-surface ring-2 ring-primary/25",
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
  ) => {
    if (
      !slotSelectStart ||
      !slotSelectEnd ||
      (slotSelectStart.dayIndex === slotSelectEnd.dayIndex && slotSelectStart.hour === slotSelectEnd.hour)
    ) {
      return null;
    }
    const range = getSlotSelectionRange(days);
    if (!range) return null;
    const dayIndex = days.findIndex((day) => isSameDay(day, range.start));
    if (dayIndex < 0) return null;
    const blockStyle = getEventBlockStyleFromRange(range.start, range.end);
    const horizontalStyle =
      columnCount === 1
        ? { left: "0.5rem", right: "0.5rem" }
        : {
            left: `calc(${(100 / columnCount) * dayIndex}% + 0.5rem)`,
            width: `calc(${100 / columnCount}% - 1rem)`,
          };

    return (
      <div
        className="pointer-events-none absolute z-20 rounded-control border border-primary/60 bg-primary/15 px-2 py-1 text-left text-xs text-foreground shadow-surface ring-2 ring-primary/20"
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

    let isComplete = false;
    if (entry.kind === "task") {
      const status = String(entry.task.status || "");
      isComplete = status === "done" || status === "completed" || status === "cancelled";
    } else {
      isComplete =
        entry.task.listType === "closed" ||
        entry.task.listType === "archive" ||
        entry.task.listType === "trash";
    }

    const status = getDueDateStatus(dueDateValue, { isComplete, now: currentTime });
    if (status === "overdue") return "overdue";
    if (status === "soon") return "soon";
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
    const hour = Number(slot.dataset.hour);
    const date = slot.dataset.date ? new Date(slot.dataset.date) : null;
    const day = date && !Number.isNaN(date.getTime())
      ? date
      : timelineDays[Number(slot.dataset.dayIndex)];
    if (!day || !Number.isFinite(hour)) return null;
    return combineDateWithTime(day, slotNumberToTime(hour));
  };

  const getAllDayDateFromPoint = (clientX: number, clientY: number) => {
    const slot = Array.from(document.querySelectorAll<HTMLElement>("[data-calendar-all-day]")).find((node) => {
      const rect = node.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!slot) return null;
    if (slot.dataset.date) {
      const date = new Date(slot.dataset.date);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return timelineDays[Number(slot.dataset.dayIndex)] || null;
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
      if (!nextRange) {
        toast({
          title: "Нельзя переместить сюда",
          description: "Отпустите карточку внутри дня или временного слота календаря.",
          variant: "destructive",
        });
        return;
      }
      updateCalendarEntryRangeMutation.mutate({ entry: action.entry, start: nextRange.start, end: nextRange.end });
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [calendarSettings.gridStep, timelineDays, updateCalendarEntryRangeMutation]);

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

  const parseCalendarBlockHeight = (height: string | number | undefined) => {
    if (typeof height === "number") return height;
    const parsed = Number.parseFloat(String(height || ""));
    return Number.isFinite(parsed) ? parsed : 56;
  };

  const getResizeHandleClass = (height: string | number | undefined, edge: "top" | "bottom") => cn(
    "absolute inset-x-0 z-20 bg-primary/25",
    edge === "top"
      ? "top-0 rounded-t-xl bg-gradient-to-b from-primary/30 to-transparent"
      : "bottom-0 rounded-b-xl bg-gradient-to-t from-primary/30 to-transparent",
    getCalendarResizeHandleClassName(parseCalendarBlockHeight(height)),
  );

  const renderTimedEntryContent = (entry: CalendarEntry, height: string | number | undefined, compact = false) => {
    const blockHeight = parseCalendarBlockHeight(height);
    const density = getCalendarEntryDensity(blockHeight);
    const detailLabel = entry.kind === "event"
      ? entry.location || "Без локации"
      : entry.responsibleLabel || "Без исполнителя";
    if (density !== "full") {
      return (
        <div className={cn(
          "flex h-full min-w-0 items-center overflow-hidden px-1.5",
          density === "tiny-title" ? "text-[10px]" : "text-xs",
        )}>
          <div className="min-w-0 truncate font-semibold leading-tight" title={entry.title}>
            {entry.title}
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex h-full min-w-0 flex-col overflow-hidden", compact ? "gap-0.5 p-1.5" : "gap-1 p-2")}>
        <div className="min-w-0 truncate text-xs font-semibold leading-tight" title={entry.title}>
          {entry.title}
        </div>
        <div className="flex min-w-0 items-center gap-1 truncate text-[10px] leading-tight opacity-90">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{getEntryMetaLine(entry)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1 truncate text-[10px] leading-tight opacity-90">
          {entry.kind === "event" ? <MapPin className="h-3 w-3 shrink-0" /> : <UserRound className="h-3 w-3 shrink-0" />}
          <span className="truncate">{detailLabel}</span>
        </div>
        {(entry.kind === "task" || entry.kind === "kanban") && (
          <div className="mt-auto flex min-w-0 items-center gap-1 overflow-hidden pt-0.5">
            {entry.task.priority && (
              <span className="max-w-full truncate rounded-full bg-surface-raised/70 px-1.5 py-0.5 text-[10px] leading-none">
                {TASK_PRIORITY_LABELS[entry.task.priority] || entry.task.priority}
              </span>
            )}
            {getEntryDeadlineUrgency(entry) !== "none" && (
              <span className="max-w-full truncate rounded-full bg-surface-raised/70 px-1.5 py-0.5 text-[10px] leading-none">
                {getDueDateStatusLabel(getEntryDeadlineUrgency(entry))}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMonthEntryContent = (entry: CalendarEntry) => (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", getEventDotClass(entry))} style={getEntryDotStyle(entry)} />
      <span className="min-w-0 flex-1 truncate font-medium">{entry.title}</span>
      <span className="hidden shrink-0 opacity-80 sm:inline">{format(new Date(entry.startTime), "HH:mm")}</span>
    </span>
  );

  const commitTimelineScroll = useCallback(() => {
    const element = timelineScrollRef.current;
    if (!element || timelineRecenteringRef.current) return;

    const targetIndex = getCalendarTimelineSnapIndex({
      scrollLeft: element.scrollLeft,
      dayWidth: timelineDayWidth,
      dayCount: timelineDays.length,
    });
    const targetDate = timelineDays[targetIndex];
    if (!targetDate) return;

    if (!isSameDay(targetDate, selectedDate)) {
      setSelectedDate(new Date(targetDate));
      return;
    }

    const targetScrollLeft = getCalendarTimelineScrollLeft(
      timelineBufferDays,
      timelineDayWidth,
    );
    timelineRecenteringRef.current = true;
    element.scrollLeft = targetScrollLeft;
    timelineLastScrollLeftRef.current = targetScrollLeft;
    window.requestAnimationFrame(() => {
      timelineRecenteringRef.current = false;
    });
  }, [selectedDate, timelineBufferDays, timelineDayWidth, timelineDays]);
  commitTimelineScrollRef.current = commitTimelineScroll;

  const extendTimelineBufferIfNeeded = useCallback(() => {
    const element = timelineScrollRef.current;
    if (!element || timelineRecenteringRef.current) return;

    const currentBufferDays = timelineBufferDaysRef.current;
    const viewportWidth = element.getBoundingClientRect().width;
    const isNearEdge = isCalendarTimelineNearBufferEdge({
      scrollLeft: element.scrollLeft,
      viewportWidth,
      dayWidth: timelineDayWidth,
      dayCount: timelineDays.length,
    });
    if (!isNearEdge) return;

    const nextBufferDays = getCalendarTimelineNextBufferDays({
      scrollLeft: element.scrollLeft,
      viewportWidth,
      dayWidth: timelineDayWidth,
      dayCount: timelineDays.length,
      bufferDays: currentBufferDays,
    });
    if (nextBufferDays > currentBufferDays) {
      timelineBufferDaysRef.current = nextBufferDays;
      timelinePendingBufferShiftRef.current += nextBufferDays - currentBufferDays;
      setTimelineBufferDays(nextBufferDays);
      return;
    }

    const firstVisibleIndex = Math.max(0, Math.min(
      timelineDays.length - 1,
      Math.floor(element.scrollLeft / timelineDayWidth),
    ));
    const nextAnchorDate = timelineDays[firstVisibleIndex];
    if (!nextAnchorDate || isSameDay(nextAnchorDate, selectedDate)) return;

    timelinePendingRebaseOffsetRef.current = element.scrollLeft - firstVisibleIndex * timelineDayWidth;
    timelineRecenteringRef.current = true;
    setSelectedDate(new Date(nextAnchorDate));
  }, [selectedDate, timelineDayWidth, timelineDays]);

  const handleTimelineScroll = useCallback(() => {
    if (timelineRecenteringRef.current) return;
    const element = timelineScrollRef.current;
    if (!element) return;
    const nextScrollLeft = element.scrollLeft;
    if (Math.abs(nextScrollLeft - timelineLastScrollLeftRef.current) < 0.5) return;
    timelineLastScrollLeftRef.current = nextScrollLeft;
    extendTimelineBufferIfNeeded();
    if (timelineScrollTimerRef.current != null) {
      window.clearTimeout(timelineScrollTimerRef.current);
    }
    timelineScrollTimerRef.current = window.setTimeout(() => {
      timelineScrollTimerRef.current = null;
      commitTimelineScrollRef.current();
    }, 240);
  }, [extendTimelineBufferIfNeeded]);

  const scrollTimelineByDays = useCallback((dayDelta: number) => {
    const element = timelineScrollRef.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({
      left: dayDelta * timelineDayWidth,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [timelineDayWidth]);

  const handleTimelineKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollTimelineByDays(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      scrollTimelineByDays(
        (event.key === "PageUp" ? -1 : 1) * timelineVisibleDayCount,
      );
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setSelectedDate(new Date());
    }
  }, [scrollTimelineByDays, timelineVisibleDayCount]);

  const handleTimelinePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (!target.closest("[data-calendar-horizontal-pan]")) return;
    const element = timelineScrollRef.current;
    if (!element) return;
    timelinePanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
    };
    element.setPointerCapture(event.pointerId);
  }, []);

  const handleTimelinePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    updateTimelineDatePressMovement(event);
    const pan = timelinePanRef.current;
    const element = timelineScrollRef.current;
    if (!pan || !element || pan.pointerId !== event.pointerId) return;
    element.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
  }, [updateTimelineDatePressMovement]);

  const handleTimelinePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    finishTimelineDatePress(event, true);
    const pan = timelinePanRef.current;
    const element = timelineScrollRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    timelinePanRef.current = null;
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    handleTimelineScroll();
  }, [finishTimelineDatePress, handleTimelineScroll]);

  const handleTimelinePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    finishTimelineDatePress(event, false);
    const pan = timelinePanRef.current;
    const element = timelineScrollRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    timelinePanRef.current = null;
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    handleTimelineScroll();
  }, [finishTimelineDatePress, handleTimelineScroll]);

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

  const openDayView = (date: Date) => {
    setSelectedDate(new Date(date));
    setViewMode("day");
  };

  const toolbarPeriodLabel = (() => {
    if (viewMode === "month") return format(selectedDate, "LLLL yyyy", { locale: ru });
    if (isTimelineView) {
      const start = timelineVisibleDays[0] || selectedDate;
      const end = timelineVisibleDays.at(-1) || start;
      if (isSameDay(start, end)) return format(start, "d MMM yyyy", { locale: ru });
      return `${format(start, "d MMM", { locale: ru })} – ${format(end, "d MMM yyyy", { locale: ru })}`;
    }
    return `${format(weekStart, "d MMM", { locale: ru })} – ${format(weekEnd, "d MMM yyyy", { locale: ru })}`;
  })();

  const renderAllDayZone = (days: Date[], scope: "week" | "3days" | "day") => {
    if (!calendarSettings.showAllDay) return null;
    const allDayEntriesByKey = new Map<string, CalendarEntry>();
    days.forEach((day) => {
      getEntriesForDate(day).forEach((entry) => {
        if (isAllDayEntry(entry)) allDayEntriesByKey.set(getCalendarEntryKey(entry), entry);
      });
    });
    const allDayEntries = Array.from(allDayEntriesByKey.values());
    const allDayPreview =
      calendarPointerPreview &&
      new Date(calendarPointerPreview.startTime).getHours() === 0 &&
      new Date(calendarPointerPreview.startTime).getMinutes() === 0 &&
      new Date(calendarPointerPreview.endTime).getHours() >= 23 &&
      new Date(calendarPointerPreview.endTime).getMinutes() >= 45
        ? calendarPointerPreview
        : null;
    const dayColumnTemplate = `repeat(${Math.max(1, days.length)}, minmax(0,1fr))`;
    const timelineColumnTemplate = `${CALENDAR_TIMELINE_GUTTER_WIDTH}px repeat(${Math.max(1, days.length)}, ${timelineDayWidth}px)`;
    if (allDayEntries.length === 0 && !allDayPreview) {
      return (
        <div className="grid border-b border-border/40 bg-surface-subtle" style={{ gridTemplateColumns: timelineColumnTemplate }}>
          <div className="sticky left-0 z-30 border-r border-border/40 bg-surface-subtle px-2 py-2 text-[11px] font-medium text-muted-foreground">Весь день</div>
          {days.map((day, dayIndex) => (
            <button
              key={day.toISOString()}
              type="button"
              data-calendar-all-day
              data-scope={scope}
              data-date={day.toISOString()}
              data-day-index={dayIndex}
              aria-label={`Создать событие на весь день ${format(day, "d MMMM yyyy", { locale: ru })}`}
              className="min-h-10 cursor-pointer border-r border-border/30 transition-colors hover:bg-primary/5 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary last:border-r-0"
              onClick={() => openAllDayEventForm(day)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="grid border-b border-border/40 bg-surface-subtle" style={{ gridTemplateColumns: timelineColumnTemplate }}>
        <div className="sticky left-0 z-30 border-r border-border/40 bg-surface-subtle px-2 py-2 text-[11px] font-medium text-muted-foreground">Весь день</div>
        <div
          className="relative max-h-28 min-h-10 overflow-y-auto p-1"
          style={{ gridColumn: `span ${Math.max(1, days.length)} / span ${Math.max(1, days.length)}` }}
        >
          <div className="absolute inset-1 grid gap-1" style={{ gridTemplateColumns: dayColumnTemplate }}>
            {days.map((day, dayIndex) => (
              <button
                key={day.toISOString()}
                type="button"
                data-calendar-all-day
                data-scope={scope}
                data-date={day.toISOString()}
                data-day-index={dayIndex}
                aria-label={`Создать событие на весь день ${format(day, "d MMMM yyyy", { locale: ru })}`}
                className="min-h-8 cursor-pointer rounded-control border border-dashed border-border/30 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                onClick={() => openAllDayEventForm(day)}
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
                key={getCalendarEntryKey(entry)}
                type="button"
                data-calendar-all-day-entry
                className={cn("relative z-10 min-w-0 cursor-grab rounded-control border border-border/40 px-2 py-1 text-left text-xs shadow-xs", getEventCardClasses(entry))}
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
                  className="pointer-events-none relative z-20 min-w-0 rounded-control border border-primary/70 bg-primary/20 px-2 py-1 text-left text-xs text-foreground shadow-surface ring-2 ring-primary/25"
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

  const renderCompressedHoursControl = (
    days: Date[],
    range: "before" | "after",
    gridTemplateColumns: string,
  ) => {
    const startsAt = range === "before" ? 0 : workdayEnd;
    const endsAt = range === "before" ? workdayStart : 24;
    if (endsAt <= startsAt) return null;
    const isExpanded = expandedNonWorkingRanges[range];
    if (isExpanded) return null;

    const entryCountByDay = days.map((day) =>
      getEntriesForDate(day).filter((entry) => {
        if (isAllDayEntry(entry)) return false;
        const start = new Date(entry.startTime);
        const hour = start.getHours() + start.getMinutes() / 60;
        return hour >= startsAt && hour < endsAt;
      }).length,
    );
    const entriesInRange = entryCountByDay.reduce((sum, count) => sum + count, 0);
    const startsAtLabel = `${String(startsAt).padStart(2, "0")}:00`;
    const endsAtLabel = `${String(endsAt).padStart(2, "0")}:00`;

    return (
      <button
        type="button"
        aria-expanded="false"
        aria-label={`Развернуть часы с ${startsAtLabel} до ${endsAtLabel}${entriesInRange > 0 ? `. Событий внутри: ${entriesInRange}` : ""}`}
        title={`Развернуть ${startsAtLabel}–${endsAtLabel}`}
        data-calendar-compressed-hours={range}
        className={cn(
          "group grid w-full cursor-pointer border-b border-border/35 bg-surface-subtle text-left text-[10px] text-muted-foreground transition-colors hover:bg-muted/55 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 sm:text-xs",
          "h-11",
        )}
        style={{ gridTemplateColumns }}
        onClick={() => setExpandedNonWorkingRanges((prev) => ({ ...prev, [range]: !prev[range] }))}
      >
        <span className="sticky left-0 z-20 block h-full border-r border-border/40 bg-surface-subtle group-hover:bg-muted/55">
          <span className="relative block h-full pr-1 text-right">
            <span className="absolute right-1 top-0.5">{startsAtLabel}</span>
            <span className="absolute bottom-0.5 right-1">{endsAtLabel}</span>
          </span>
        </span>
        {days.map((day, index) => (
          <span
            key={`${range}-${day.toISOString()}`}
            className="relative block h-full border-r border-border/25 last:border-r-0"
          >
            <span className="absolute inset-x-0 top-1/2 border-t border-border/25" />
            {entryCountByDay[index] > 0 && (
              <span className="absolute left-2 top-1.5 h-1 w-8 max-w-[calc(100%-1rem)] rounded-full bg-primary/45" />
            )}
          </span>
        ))}
      </button>
    );
  };

  const renderTimelineView = () => {
    const columnCount = Math.max(1, timelineDays.length);
    const timelineHeight = (HOUR_END - HOUR_START) * ROW_HEIGHT;
    const gridTemplateColumns = `${CALENDAR_TIMELINE_GUTTER_WIDTH}px repeat(${columnCount}, ${timelineDayWidth}px)`;
    const todayIndex = timelineDays.findIndex((day) => isSameDay(day, now));
    const showNowLine =
      todayIndex >= 0 &&
      now.getHours() >= HOUR_START &&
      now.getHours() < HOUR_END;
    const nowTop = showNowLine
      ? (now.getHours() - HOUR_START + now.getMinutes() / 60) * ROW_HEIGHT
      : 0;
    const timelineWeekNumber = getISOWeek(timelineVisibleDays[0] || selectedDate);
    const renderTimelineHourLabel = (hour: number) => (
      hour === HOUR_START && workdayStart > 0 && !expandedNonWorkingRanges.before
        ? null
        : `${String(hour).padStart(2, "0")}:00`
    );
    const getExpandedRangeForHour = (hour: number): "before" | "after" | null => {
      if (expandedNonWorkingRanges.before && hour < workdayStart) return "before";
      if (expandedNonWorkingRanges.after && hour >= workdayEnd) return "after";
      return null;
    };

    return (
      <div
        ref={timelineScrollRef}
        tabIndex={0}
        aria-label="Временная шкала календаря. Используйте стрелки для перехода по дням."
        className="max-h-[75vh] min-w-0 max-w-full overflow-auto rounded-surface border border-border/50 bg-surface-raised shadow-xs outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-primary/30"
        style={{
          scrollSnapType: "x proximity",
          overscrollBehaviorX: "contain",
          overflowAnchor: "none",
          touchAction: "pan-x pan-y",
        }}
        onScroll={handleTimelineScroll}
        onKeyDown={handleTimelineKeyDown}
        onPointerDown={handleTimelinePointerDown}
        onPointerMove={handleTimelinePointerMove}
        onPointerUp={handleTimelinePointerEnd}
        onPointerCancel={handleTimelinePointerCancel}
        onWheel={(event) => {
          if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          event.currentTarget.scrollLeft += event.deltaY;
        }}
      >
        <div className="min-w-max" style={{ width: timelineContentWidth }}>
          <div className="sticky top-0 z-50 border-b border-border/40 bg-surface-raised shadow-xs">
            <div className="grid bg-surface-raised" style={{ gridTemplateColumns }}>
              <div
                data-calendar-horizontal-pan
                className="sticky left-0 z-30 cursor-grab border-b border-r border-border/40 bg-surface-raised px-2 py-2 text-[10px] font-medium text-muted-foreground active:cursor-grabbing sm:text-xs"
              >
                Н{timelineWeekNumber}
              </div>
              {timelineDays.map((day) => {
                const isToday = isSameDay(day, now);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    data-calendar-horizontal-pan
                    aria-label={`Создать событие на весь день ${format(day, "d MMMM yyyy", { locale: ru })}`}
                    className="cursor-grab select-none border-b border-r border-border/40 bg-surface-raised px-1 py-2 text-center transition-colors hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary last:border-r-0 active:cursor-grabbing"
                    style={{
                      scrollSnapAlign: "start",
                      scrollMarginLeft: CALENDAR_TIMELINE_GUTTER_WIDTH,
                    }}
                    onPointerDown={(event) => startTimelineDatePress(event, day)}
                    onPointerUp={(event) => finishTimelineDatePress(event, true)}
                    onPointerCancel={(event) => finishTimelineDatePress(event, false)}
                    onClick={(event) => {
                      if (event.detail === 0) openAllDayEventForm(day);
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <div className="truncate text-[10px] uppercase text-muted-foreground sm:text-xs">
                      {format(day, "EEE", { locale: ru })}
                    </div>
                    <div className={cn(
                      "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full text-sm font-semibold",
                      isToday && "bg-primary px-1 text-primary-foreground",
                    )}>
                      {format(day, "d")}
                    </div>
                  </button>
                );
              })}
            </div>
            {renderAllDayZone(timelineDays, timelineViewMode)}
          </div>
          {renderCompressedHoursControl(timelineDays, "before", gridTemplateColumns)}
          <div className="grid" style={{ gridTemplateColumns }}>
            {Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index).map((hour) => (
              <Fragment key={hour}>
                <div
                  className="sticky left-0 z-20 flex items-start justify-end border-b border-r border-border/30 bg-surface-raised pr-1 text-[10px] text-muted-foreground sm:text-xs"
                  style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
                />
                {timelineDays.map((day) => (
                  <div
                    key={`${hour}-${day.toISOString()}`}
                    className="border-b border-r border-border/20 last:border-r-0"
                    style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
                  />
                ))}
              </Fragment>
            ))}
          </div>
          <div
            className="pointer-events-none relative"
            style={{ marginTop: -timelineHeight }}
          >
            <div className="grid pointer-events-auto" style={{ gridTemplateColumns }}>
              <div
                className="pointer-events-none sticky left-0 z-40 border-r border-border/40 bg-surface-raised"
                style={{ height: timelineHeight }}
              >
                {Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index).map((hour) => {
                  const expandedRange = getExpandedRangeForHour(hour);
                  const isRangeBoundary = expandedRange === "before"
                    ? hour === workdayStart - 1
                    : expandedRange === "after" && hour === workdayEnd;
                  const className = "relative flex w-full items-start justify-end border-b border-border/30 pr-1 text-[10px] text-muted-foreground sm:text-xs";
                  const style = { height: ROW_HEIGHT, minHeight: ROW_HEIGHT };

                  if (!expandedRange) {
                    return (
                      <div key={`timeline-hour-label-${hour}`} className={className} style={style}>
                        {renderTimelineHourLabel(hour)}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`timeline-hour-label-${hour}`}
                      type="button"
                      className={`${className} pointer-events-auto transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60`}
                      style={style}
                      aria-label={`Скрыть часы ${expandedRange === "before" ? `до ${String(workdayStart).padStart(2, "0")}:00` : `после ${String(workdayEnd).padStart(2, "0")}:00`}`}
                      onClick={() => setExpandedNonWorkingRanges((current) => ({
                        ...current,
                        [expandedRange]: false,
                      }))}
                    >
                      {renderTimelineHourLabel(hour)}
                      {isRangeBoundary && (
                        <span className={cn(
                          "absolute inset-x-1 border-t border-muted-foreground/50",
                          expandedRange === "before" ? "bottom-0" : "top-0",
                        )}>
                          <span className="absolute left-1/2 top-0 h-1.5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/60" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div
                className="relative"
                style={{
                  gridColumn: `span ${columnCount} / span ${columnCount}`,
                  height: timelineHeight,
                  minHeight: timelineHeight,
                }}
              >
                {timelineDays.map((day, dayIndex) =>
                  visibleTimeSlots.map((time) => {
                    const [hourPart, minutePart] = time.split(":").map(Number);
                    const slot = hourPart + minutePart / 60;
                    if (slot < HOUR_START || slot >= HOUR_END) return null;
                    return (
                      <div
                        key={`timeline-slot-${day.toISOString()}-${time}`}
                        data-calendar-slot
                        data-scope={timelineViewMode}
                        data-date={day.toISOString()}
                        data-day-index={dayIndex}
                        data-hour={slot}
                        className="absolute cursor-cell transition-colors duration-150 hover:bg-primary/10"
                        style={{
                          left: `${(100 / columnCount) * dayIndex}%`,
                          width: `${100 / columnCount}%`,
                          top: (slot - HOUR_START) * ROW_HEIGHT,
                          height: CALENDAR_SLOT_HEIGHT,
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSlotSelectStart({ dayIndex, hour: slot });
                          setSlotSelectEnd({ dayIndex, hour: slot });
                        }}
                      />
                    );
                  }),
                )}
                {showNowLine && (
                  <div
                    className="pointer-events-none absolute z-10 h-px bg-error"
                    style={{
                      top: nowTop,
                      left: `${(100 / columnCount) * todayIndex}%`,
                      width: `${100 / columnCount}%`,
                    }}
                  />
                )}
                {renderSlotSelectionPreview(timelineDays, columnCount)}
                {timelineDays.map((day, dayIndex) => {
                  const dayEntries = getEntriesForDate(day).filter((entry) => {
                    if (isAllDayEntry(entry)) return false;
                    const start = new Date(entry.startTime);
                    const end = new Date(entry.endTime);
                    const startHour = start.getHours() + start.getMinutes() / 60;
                    const endHour = end.getHours() + end.getMinutes() / 60;
                    return endHour > HOUR_START && startHour < HOUR_END;
                  });
                  const laneLayout = getEventLaneLayout(dayEntries);
                  return (
                    <div
                      key={day.toISOString()}
                      className="absolute inset-y-0 z-10 border-l border-border/30 first:border-l-0"
                      style={{
                        left: `${(100 / columnCount) * dayIndex}%`,
                        width: `${100 / columnCount}%`,
                        pointerEvents: "none",
                      }}
                    >
                      {dayEntries.map((entry) => {
                        const blockStyle = getEventBlockStyle(entry);
                        const overlapStyle = getEventOverlapStyle(entry, laneLayout);
                        return (
                          <button
                            key={getCalendarEntryKey(entry)}
                            type="button"
                            data-calendar-entry-block
                            className={cn(
                              "pointer-events-auto absolute cursor-grab overflow-hidden rounded-control border border-border/40 text-left text-xs shadow-xs transition hover:shadow-surface active:cursor-grabbing",
                              getEventCardClasses(entry),
                            )}
                            style={{
                              ...blockStyle,
                              ...overlapStyle,
                              minHeight: 24,
                              ...getEntryColorStyle(entry),
                            }}
                            onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "move")}
                          >
                            <span
                              aria-label="Изменить начало"
                              className={getResizeHandleClass(blockStyle.height, "top")}
                              onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-start")}
                            />
                            {renderTimedEntryContent(entry, blockStyle.height, true)}
                            <span
                              aria-label="Изменить длительность"
                              className={getResizeHandleClass(blockStyle.height, "bottom")}
                              onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "resize-end")}
                            />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {renderTimedPointerPreview(timelineDays, columnCount)}
              </div>
            </div>
          </div>
          {renderCompressedHoursControl(timelineDays, "after", gridTemplateColumns)}
        </div>
      </div>
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
    <div className="w-full min-w-0 max-w-full overflow-hidden px-2 py-3 sm:px-4 sm:py-4 lg:px-5">
      <CalendarToolbar
        periodLabel={toolbarPeriodLabel}
        selectedDate={selectedDate}
        viewMode={viewMode}
        onCreateEvent={() => {
          setDraftSlot(null);
          setSelectedEntry(null);
          setIsFormOpen(true);
        }}
        onShiftDate={shiftSelectedDate}
        onToday={() => setSelectedDate(new Date())}
        onOpenSettings={() => setSettingsOpen(true)}
        onDateSelect={(date) => setSelectedDate(new Date(date))}
        onViewModeChange={setViewMode}
      />

      {viewMode === "month" ? (
        <div className="min-w-0 overflow-hidden rounded-surface border border-border/50 bg-surface-raised shadow-xs">
            <div className="grid grid-cols-7 border-b border-border/40 bg-surface-subtle">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                <div key={day} className="p-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{day}</div>
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
                  const isPointerPreviewDay = calendarPointerPreview
                    ? isSameDay(new Date(calendarPointerPreview.startTime), day)
                    : false;
                  return (
                    <div
                      key={day.toISOString()}
                      data-calendar-all-day
                      data-scope="month"
                      data-date={day.toISOString()}
                      className={cn(
                        "min-h-[56px] cursor-pointer border-b border-r border-border/25 p-0.5 transition-colors hover:bg-muted/40 sm:min-h-[72px] sm:p-1 md:min-h-[84px] [&:nth-child(7n)]:border-r-0",
                        !isCurrentMonth ? "bg-surface-subtle/70 text-muted-foreground" : "bg-surface-raised",
                        isPointerPreviewDay && "bg-primary/10 ring-2 ring-inset ring-primary/50",
                      )}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("[data-calendar-entry-block]")) return;
                        openDayView(day);
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          "mb-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:mb-1 sm:text-sm",
                          isToday
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : isCurrentMonth
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                        aria-label={`Открыть ${format(day, "d MMMM yyyy", { locale: ru })}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDayView(day);
                        }}
                      >
                        {format(day, "d")}
                      </button>
                      <div className="space-y-0.5 sm:space-y-1 max-h-[68px] sm:max-h-[94px] overflow-y-auto hide-scrollbar">
                        {dayEntries.slice(0, 3).map((entry) => (
                          <button
                            key={getCalendarEntryKey(entry)}
                            type="button"
                            data-calendar-entry-block
                            className={cn("block w-full min-w-0 cursor-grab overflow-hidden rounded-control border border-border/30 px-1.5 py-1 text-left text-[10px] shadow-xs active:cursor-grabbing sm:text-xs", getEventInlineClasses(entry))}
                            style={getEntryColorStyle(entry, "inline")}
                            onPointerDown={(event) => startCalendarEntryPointerAction(event, entry, "all-day-move")}
                          >
                            {renderMonthEntryContent(entry)}
                          </button>
                        ))}
                        {dayEntries.length > 3 && (
                          <button
                            type="button"
                            className="rounded-control px-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-xs"
                            aria-label={`Показать ещё ${dayEntries.length - 3} событий за ${format(day, "d MMMM", { locale: ru })}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDayView(day);
                            }}
                          >
                            +{dayEntries.length - 3} ещё
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
        </div>
      ) : isTimelineView ? (
        renderTimelineView()
      ) : viewMode === "list" ? (
        <div className="min-w-0 overflow-hidden rounded-surface border border-border/50 bg-surface-raised shadow-xs">
          <div className="border-b border-border/40 bg-surface-subtle p-2 sm:p-3">
            <div className="flex items-center gap-2 text-foreground">
              <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium sm:text-base">
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
                <Card key={`${getCalendarEntryKey(entry)}:${entry._day.toISOString()}`} className={cn("cursor-pointer overflow-hidden rounded-control border border-border/40 shadow-xs transition hover:shadow-surface", getEventCardClasses(entry))} style={getEntryColorStyle(entry)} onClick={() => handleEntryClick(entry)}>
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
      ) : null}

      <CalendarEntryDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        entry={selectedEntry}
        currentTime={currentTime}
        getEventDotClass={getEventDotClass}
        getEntryDotStyle={getEntryDotStyle}
        getEventBadgeClasses={getEventBadgeClasses}
        getEntryColorStyle={getEntryColorStyle}
        onRespondParticipant={(response) => respondParticipantMutation.mutate(response)}
        isResponding={respondParticipantMutation.isPending}
        onEditEvent={() => {
          setIsDetailOpen(false);
          setIsFormOpen(true);
        }}
        onDeleteEvent={(eventId) => deleteEventMutation.mutate(eventId)}
        isDeleting={deleteEventMutation.isPending}
      />

      <CalendarSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={calendarSettings}
        onSettingsChange={setCalendarSettings}
      />

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
