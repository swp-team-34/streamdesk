export type CalendarRouteView = "month" | "week" | "3days" | "day" | "list";

const CALENDAR_ROUTE_VIEWS = new Set<CalendarRouteView>(["month", "week", "3days", "day", "list"]);
const LOCAL_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidLocalDateKey(value: string) {
  const match = LOCAL_DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())
    && date.getFullYear() === year
    && date.getMonth() + 1 === month
    && date.getDate() === day;
}

function appendQuery(path: string, entries: Array<[string, string | null | undefined]>) {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    const normalized = String(value ?? "").trim();
    if (normalized) params.set(key, normalized);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function getKanbanCardHref(boardId: unknown, cardId: unknown) {
  return appendQuery("/tasks", [
    ["boardId", String(boardId ?? "")],
    ["cardId", String(cardId ?? "")],
  ]);
}

export function getProjectHref(projectId: unknown) {
  return appendQuery("/projects", [["projectId", String(projectId ?? "")]]);
}

export function getEquipmentHref(equipmentId: unknown) {
  return appendQuery("/equipment", [["equipmentId", String(equipmentId ?? "")]]);
}

export function getLocalDateKey(value: unknown) {
  if (typeof value === "string" && LOCAL_DATE_KEY_PATTERN.test(value)) {
    return isValidLocalDateKey(value) ? value : "";
  }
  const date = new Date(value as string | number | Date);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCalendarEventHref(eventId: unknown, startTime: unknown) {
  return appendQuery("/calendar", [
    ["date", getLocalDateKey(startTime)],
    ["view", "day"],
    ["eventId", String(eventId ?? "")],
  ]);
}

export function readCalendarRouteState(search: string) {
  const params = new URLSearchParams(search);
  const dateKey = params.get("date") || "";
  const parsedDate = isValidLocalDateKey(dateKey)
    ? new Date(`${dateKey}T12:00:00`)
    : null;
  const view = params.get("view") as CalendarRouteView | null;
  return {
    date: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : null,
    view: view && CALENDAR_ROUTE_VIEWS.has(view) ? view : null,
    eventId: params.get("eventId")?.trim() || null,
  };
}
