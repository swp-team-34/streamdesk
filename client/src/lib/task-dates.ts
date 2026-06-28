export type DueDateStatus = "none" | "upcoming" | "soon" | "overdue" | "complete";

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
  options?: { isComplete?: boolean },
): DueDateStatus => {
  if (options?.isComplete) return "complete";
  if (!value) return "none";

  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return "none";

  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) return "overdue";
  if (diffHours <= 24) return "soon";
  return "upcoming";
};

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
        badge: "border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
        card: "border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/10",
      };
    case "overdue":
      return {
        badge: "border-red-200 bg-red-100 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
        card: "border-red-200/80 bg-red-50/50 dark:border-red-500/25 dark:bg-red-500/10",
      };
    case "soon":
      return {
        badge: "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
        card: "border-amber-200/80 bg-amber-50/50 dark:border-amber-500/25 dark:bg-amber-500/10",
      };
    case "upcoming":
      return {
        badge: "border-sky-200 bg-sky-100 text-sky-900 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200",
        card: "border-sky-200/80 bg-sky-50/40 dark:border-blue-400/25 dark:bg-blue-400/10",
      };
    default:
      return {
        badge: "border-border bg-muted text-muted-foreground",
        card: "",
      };
  }
};
