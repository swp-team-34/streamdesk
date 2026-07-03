export type TaskManagerWorkloadFilter =
  | "all"
  | "overdue"
  | "due-soon"
  | "no-deadline"
  | "unassigned"
  | "in-progress"
  | "completed";

type LocationField = {
  id: string;
  name?: string | null;
};

type WorkloadCard = {
  assigneeUserId?: string | null;
  dueDate?: string | Date | null;
  listType?: string | null;
};

const COMPLETE_LIST_TYPES = new Set(["closed", "archive", "trash"]);
const LOCATION_FIELD_MARKERS = ["location", "локац", "мест", "студ", "room", "zone"];

function stringifyCustomFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(stringifyCustomFieldValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.name || record.title || record.label || record.value || "").trim();
  }
  return String(value ?? "").trim();
}

function isCompleteListType(listType: unknown) {
  return COMPLETE_LIST_TYPES.has(String(listType || ""));
}

function getTime(value: unknown) {
  if (!value) return null;
  const time = new Date(value as string | Date).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getTaskManagerLocationValue(values: unknown, fields: LocationField[]) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return "";
  const record = values as Record<string, unknown>;

  for (const field of fields) {
    const markerText = `${field.id} ${field.name || ""}`.toLowerCase();
    if (!LOCATION_FIELD_MARKERS.some((marker) => markerText.includes(marker))) continue;

    const value = stringifyCustomFieldValue(record[field.id]);
    if (value) return value;
  }

  return "";
}

export function matchesTaskManagerWorkloadFilter(
  card: WorkloadCard,
  filter: TaskManagerWorkloadFilter,
  now = new Date(),
) {
  if (filter === "all") return true;

  const completed = isCompleteListType(card.listType);
  const dueTime = getTime(card.dueDate);
  const nowTime = now.getTime();

  if (filter === "completed") return completed;
  if (filter === "in-progress") return !completed && String(card.listType || "active") === "active";
  if (filter === "unassigned") return !completed && !String(card.assigneeUserId || "").trim();
  if (filter === "no-deadline") return !completed && dueTime === null;
  if (filter === "overdue") return !completed && dueTime !== null && dueTime < nowTime;
  if (filter === "due-soon") {
    return !completed && dueTime !== null && dueTime >= nowTime && dueTime <= nowTime + 24 * 60 * 60 * 1000;
  }

  return true;
}
