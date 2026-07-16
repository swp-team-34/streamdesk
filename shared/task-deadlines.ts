export type TaskDeadlineValue = string | Date | null | undefined;
export type TaskDeadlineStatus = "none" | "upcoming" | "soon" | "overdue" | "complete";

export const DEFAULT_TASK_TIME_ZONE = "Europe/Moscow";
export const DEFAULT_TASK_DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function getTimeZoneParts(value: Date, timeZone: string) {
  const result: Record<string, number> = {};
  for (const part of getTimeZoneFormatter(timeZone).formatToParts(value)) {
    if (part.type === "literal") continue;
    result[part.type] = Number(part.value);
  }
  return result as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

function getTimeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = getTimeZoneParts(value, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const valueWithoutMilliseconds = Math.floor(value.getTime() / 1000) * 1000;
  return representedAsUtc - valueWithoutMilliseconds;
}

function zonedDateTimeToTimestamp(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  millisecond?: number;
  timeZone: string;
}) {
  const utcGuess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second ?? 0,
    input.millisecond ?? 0,
  );
  const firstPass = utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), input.timeZone);
  return utcGuess - getTimeZoneOffsetMs(new Date(firstPass), input.timeZone);
}

function hasValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function parseDateOnlyTimestamp(value: string, timeZone: string) {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (!hasValidDateParts(year, month, day)) return null;

  return zonedDateTimeToTimestamp({
    year,
    month,
    day,
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
    timeZone,
  });
}

function parseLocalDateTimeTimestamp(value: string, timeZone: string) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return null;
  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond = "0", rawMillisecond = "0"] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const second = Number(rawSecond);
  const millisecond = Number(rawMillisecond.padEnd(3, "0"));
  if (
    !hasValidDateParts(year, month, day) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return zonedDateTimeToTimestamp({
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
    timeZone,
  });
}

export function getTaskDeadlineTimestamp(
  value: TaskDeadlineValue,
  options: { timeZone?: string } = {},
) {
  if (!value) return null;
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const normalized = String(value).trim();
  if (!normalized) return null;
  const timeZone = options.timeZone || DEFAULT_TASK_TIME_ZONE;
  if (DATE_ONLY_PATTERN.test(normalized)) {
    return parseDateOnlyTimestamp(normalized, timeZone);
  }
  if (LOCAL_DATE_TIME_PATTERN.test(normalized)) {
    return parseLocalDateTimeTimestamp(normalized, timeZone);
  }

  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getTaskDeadlineStatus(
  value: TaskDeadlineValue,
  options: {
    isComplete?: boolean;
    now?: Date;
    timeZone?: string;
    soonWindowMs?: number;
  } = {},
): TaskDeadlineStatus {
  if (options.isComplete) return "complete";
  const dueTimestamp = getTaskDeadlineTimestamp(value, { timeZone: options.timeZone });
  if (dueTimestamp === null) return "none";

  const nowTimestamp = (options.now ?? new Date()).getTime();
  if (!Number.isFinite(nowTimestamp)) return "none";
  if (dueTimestamp < nowTimestamp) return "overdue";
  if (dueTimestamp <= nowTimestamp + (options.soonWindowMs ?? DEFAULT_TASK_DUE_SOON_WINDOW_MS)) {
    return "soon";
  }
  return "upcoming";
}

export function isTaskDeadlineOverdue(
  value: TaskDeadlineValue,
  options: {
    isComplete?: boolean;
    now?: Date;
    timeZone?: string;
  } = {},
) {
  return getTaskDeadlineStatus(value, options) === "overdue";
}
