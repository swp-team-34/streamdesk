import { combineDateWithTime } from "@/lib/task-dates";

export const CALENDAR_DATE_LONG_PRESS_MS = 520;
export const CALENDAR_DATE_MOVE_THRESHOLD_PX = 8;

export type CalendarAllDayDraftSlot = {
  startTime: string;
  endTime: string;
};

export function buildCalendarAllDayDraftSlot(date: Date): CalendarAllDayDraftSlot {
  return {
    startTime: combineDateWithTime(date, "00:00").toISOString(),
    endTime: combineDateWithTime(date, "23:59").toISOString(),
  };
}

export function hasCalendarDatePressMoved(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = CALENDAR_DATE_MOVE_THRESHOLD_PX,
) {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}
