import {
  getTaskDeadlineStatus,
  type TaskDeadlineStatus,
} from "@shared/task-deadlines";

export type DueDateStatus = TaskDeadlineStatus;

const DUE_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const toDateTimeLocalValue = (value?: string | Date | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
};

export const buildQuarterHourOptions = () => {
  const options: string[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }

  return options;
};

export const combineDateWithTime = (date: Date, time: string) => {
  const [rawHour, rawMinute] = time.split(":");
  const next = new Date(date);
  next.setHours(Number(rawHour) || 0, Number(rawMinute) || 0, 0, 0);
  return next;
};

export const roundDateToQuarterHour = (value: Date) => {
  const next = new Date(value);
  const roundedMinutes = Math.floor(next.getMinutes() / 15) * 15;
  next.setMinutes(roundedMinutes, 0, 0);
  return next;
};

export const addMinutes = (value: Date, minutes: number) => (
  new Date(value.getTime() + minutes * 60 * 1000)
);

export const getRangeDurationMinutes = (range: { start: Date; end: Date }, fallbackMinutes = 60) => {
  const duration = Math.round((range.end.getTime() - range.start.getTime()) / (60 * 1000));
  return duration > 0 ? duration : fallbackMinutes;
};

export const normalizeDateRange = (start: Date, end: Date, defaultDurationMinutes = 60) => {
  const normalizedStart = new Date(start);
  const normalizedEnd = end.getTime() > start.getTime()
    ? new Date(end)
    : addMinutes(normalizedStart, defaultDurationMinutes);

  return { start: normalizedStart, end: normalizedEnd };
};

export const moveDateRange = (range: { start: Date; end: Date }, nextStart: Date) => {
  const duration = getRangeDurationMinutes(range);
  const start = roundDateToQuarterHour(nextStart);
  return { start, end: addMinutes(start, duration) };
};

export const resizeDateRangeEnd = (start: Date, requestedEnd: Date, minDurationMinutes = 15) => {
  const roundedEnd = roundDateToQuarterHour(requestedEnd);
  const minEnd = addMinutes(start, minDurationMinutes);
  return {
    start: new Date(start),
    end: roundedEnd.getTime() > minEnd.getTime() ? roundedEnd : minEnd,
  };
};

export const formatDueDateLabel = (value?: string | Date | null) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return DUE_DATE_FORMATTER.format(date);
};

export const getDueDateStatus = (
  value?: string | Date | null,
  options?: { isComplete?: boolean; now?: Date; timeZone?: string },
): DueDateStatus => getTaskDeadlineStatus(value, options);

export const getDueDateStatusLabel = (status: DueDateStatus) => {
  switch (status) {
    case "complete":
      return "Завершено";
    case "overdue":
      return "Просрочено";
    case "soon":
      return "Скоро срок";
    case "upcoming":
      return "Запланировано";
    default:
      return "Без срока";
  }
};

export const getDueDateStatusClasses = (status: DueDateStatus) => {
  switch (status) {
    case "complete":
      return {
        badge: "border-success/20 bg-success-muted text-success",
        card: "border-success/25",
      };
    case "overdue":
      return {
        badge: "border-error/20 bg-error-muted text-error",
        card: "border-error/25",
      };
    case "soon":
      return {
        badge: "border-warning/20 bg-warning-muted text-warning",
        card: "border-warning/25",
      };
    case "upcoming":
      return {
        badge: "border-info/20 bg-info-muted text-info",
        card: "border-info/25",
      };
    default:
      return {
        badge: "border-border bg-muted text-muted-foreground",
        card: "",
      };
  }
};
