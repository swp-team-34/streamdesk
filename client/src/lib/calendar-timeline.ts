import { addDays } from "date-fns";

export type CalendarTimelineViewMode = "week" | "3days" | "day";

export const CALENDAR_TIMELINE_GUTTER_WIDTH = 56;
export const CALENDAR_TIMELINE_BUFFER_DAYS = 28;
export const CALENDAR_TIMELINE_BUFFER_INCREMENT_DAYS = 21;
export const CALENDAR_TIMELINE_MAX_BUFFER_DAYS = 49;
export const CALENDAR_TIMELINE_PREFETCH_THRESHOLD_DAYS = 14;

const MIN_DAY_WIDTH: Record<CalendarTimelineViewMode, number> = {
  day: 240,
  "3days": 144,
  week: 96,
};

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const shouldShowDate = (
  date: Date,
  viewMode: CalendarTimelineViewMode,
  showWeekends: boolean,
) => viewMode === "day" || showWeekends || !isWeekend(date);

export const getCalendarTimelineVisibleDayCount = (
  viewMode: CalendarTimelineViewMode,
  showWeekends: boolean,
) => {
  if (viewMode === "day") return 1;
  if (viewMode === "3days") return 3;
  return showWeekends ? 7 : 5;
};

export const buildCalendarTimelineDays = ({
  anchorDate,
  viewMode,
  showWeekends,
  bufferDays = CALENDAR_TIMELINE_BUFFER_DAYS,
}: {
  anchorDate: Date;
  viewMode: CalendarTimelineViewMode;
  showWeekends: boolean;
  bufferDays?: number;
}) => {
  const visibleDayCount = getCalendarTimelineVisibleDayCount(viewMode, showWeekends);
  const normalizedAnchor = new Date(anchorDate);
  normalizedAnchor.setHours(12, 0, 0, 0);

  while (!shouldShowDate(normalizedAnchor, viewMode, showWeekends)) {
    normalizedAnchor.setDate(normalizedAnchor.getDate() + 1);
  }

  const before: Date[] = [];
  let cursor = normalizedAnchor;
  while (before.length < bufferDays) {
    cursor = addDays(cursor, -1);
    if (shouldShowDate(cursor, viewMode, showWeekends)) before.unshift(cursor);
  }

  const after: Date[] = [normalizedAnchor];
  cursor = normalizedAnchor;
  while (after.length < visibleDayCount + bufferDays) {
    cursor = addDays(cursor, 1);
    if (shouldShowDate(cursor, viewMode, showWeekends)) after.push(cursor);
  }

  return before.concat(after);
};

export const getCalendarTimelineDayWidth = ({
  viewportWidth,
  viewMode,
  showWeekends,
  gutterWidth = CALENDAR_TIMELINE_GUTTER_WIDTH,
}: {
  viewportWidth: number;
  viewMode: CalendarTimelineViewMode;
  showWeekends: boolean;
  gutterWidth?: number;
}) => {
  const visibleDayCount = getCalendarTimelineVisibleDayCount(viewMode, showWeekends);
  const availableWidth = Math.max(0, viewportWidth - gutterWidth);
  return Math.max(MIN_DAY_WIDTH[viewMode], availableWidth / visibleDayCount);
};

export const getCalendarTimelineSnapIndex = ({
  scrollLeft,
  dayWidth,
  dayCount,
}: {
  scrollLeft: number;
  dayWidth: number;
  dayCount: number;
}) => {
  if (dayCount <= 0 || dayWidth <= 0) return 0;
  return Math.max(0, Math.min(dayCount - 1, Math.round(scrollLeft / dayWidth)));
};

export const getCalendarTimelineScrollLeft = (dayIndex: number, dayWidth: number) =>
  Math.max(0, dayIndex) * Math.max(0, dayWidth);

export const isCalendarTimelineNearBufferEdge = ({
  scrollLeft,
  viewportWidth,
  dayWidth,
  dayCount,
  gutterWidth = CALENDAR_TIMELINE_GUTTER_WIDTH,
  thresholdDays = CALENDAR_TIMELINE_PREFETCH_THRESHOLD_DAYS,
}: {
  scrollLeft: number;
  viewportWidth: number;
  dayWidth: number;
  dayCount: number;
  gutterWidth?: number;
  thresholdDays?: number;
}) => {
  if (dayWidth <= 0 || dayCount <= 0) return false;
  const visibleDaysWidth = Math.max(0, viewportWidth - gutterWidth);
  const firstVisibleDay = Math.max(0, scrollLeft / dayWidth);
  const lastVisibleDay = Math.min(
    dayCount - 1,
    (scrollLeft + visibleDaysWidth) / dayWidth,
  );
  const remainingBefore = firstVisibleDay;
  const remainingAfter = Math.max(0, dayCount - 1 - lastVisibleDay);
  return remainingBefore <= thresholdDays || remainingAfter <= thresholdDays;
};

export const getCalendarTimelineNextBufferDays = ({
  scrollLeft,
  viewportWidth,
  dayWidth,
  dayCount,
  bufferDays,
  gutterWidth = CALENDAR_TIMELINE_GUTTER_WIDTH,
  thresholdDays = CALENDAR_TIMELINE_PREFETCH_THRESHOLD_DAYS,
  incrementDays = CALENDAR_TIMELINE_BUFFER_INCREMENT_DAYS,
  maxBufferDays = CALENDAR_TIMELINE_MAX_BUFFER_DAYS,
}: {
  scrollLeft: number;
  viewportWidth: number;
  dayWidth: number;
  dayCount: number;
  bufferDays: number;
  gutterWidth?: number;
  thresholdDays?: number;
  incrementDays?: number;
  maxBufferDays?: number;
}) => {
  if (bufferDays >= maxBufferDays || !isCalendarTimelineNearBufferEdge({
    scrollLeft,
    viewportWidth,
    dayWidth,
    dayCount,
    gutterWidth,
    thresholdDays,
  })) return bufferDays;
  return Math.min(maxBufferDays, bufferDays + incrementDays);
};
