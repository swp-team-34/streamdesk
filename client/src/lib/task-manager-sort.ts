export type TaskManagerSortBy = "position" | "deadline" | "priority" | "createdAt" | "updatedAt" | "title";
export type TaskManagerSortDirection = "asc" | "desc";

export interface TaskManagerSortableCard {
  id: string;
  listId: string;
  title?: string | null;
  priority?: "low" | "medium" | "high" | "urgent" | string | null;
  position?: number | null;
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface TaskManagerSortableList {
  id: string;
  type?: "active" | "closed" | "archive" | "trash" | string | null;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const getTimeValue = (value?: string | Date | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
};

const getDeadlineBucket = (
  card: TaskManagerSortableCard,
  listsById: Map<string, TaskManagerSortableList>,
  now: Date,
) => {
  const list = listsById.get(card.listId);
  const isCompleteLikeList = list?.type === "closed" || list?.type === "archive" || list?.type === "trash";
  const dueTime = getTimeValue(card.dueDate);
  if (!Number.isFinite(dueTime) || isCompleteLikeList) return 2;
  return dueTime < now.getTime() ? 0 : 1;
};

const compareText = (left?: string | null, right?: string | null) =>
  String(left || "").localeCompare(String(right || ""), "ru", { numeric: true, sensitivity: "base" });

const compareNumber = (left: number, right: number) => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const compareByDeadline = (
  left: TaskManagerSortableCard,
  right: TaskManagerSortableCard,
  listsById: Map<string, TaskManagerSortableList>,
  now: Date,
) => {
  const leftBucket = getDeadlineBucket(left, listsById, now);
  const rightBucket = getDeadlineBucket(right, listsById, now);
  if (leftBucket !== rightBucket) return leftBucket - rightBucket;

  const leftDue = getTimeValue(left.dueDate);
  const rightDue = getTimeValue(right.dueDate);
  if (leftDue !== rightDue) return compareNumber(leftDue, rightDue);

  const leftPriority = PRIORITY_WEIGHT[String(left.priority || "medium")] ?? PRIORITY_WEIGHT.medium;
  const rightPriority = PRIORITY_WEIGHT[String(right.priority || "medium")] ?? PRIORITY_WEIGHT.medium;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  const leftCreated = getTimeValue(left.createdAt);
  const rightCreated = getTimeValue(right.createdAt);
  if (leftCreated !== rightCreated) return compareNumber(leftCreated, rightCreated);

  return compareText(left.title, right.title);
};

export function compareTaskManagerCards(
  left: TaskManagerSortableCard,
  right: TaskManagerSortableCard,
  options: {
    sortBy: TaskManagerSortBy;
    sortDirection: TaskManagerSortDirection;
    listsById: Map<string, TaskManagerSortableList>;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  let comparison = 0;

  switch (options.sortBy) {
    case "deadline":
      return compareByDeadline(left, right, options.listsById, now);
    case "priority":
      comparison =
        (PRIORITY_WEIGHT[String(left.priority || "medium")] ?? PRIORITY_WEIGHT.medium) -
        (PRIORITY_WEIGHT[String(right.priority || "medium")] ?? PRIORITY_WEIGHT.medium);
      break;
    case "createdAt":
      comparison = compareNumber(getTimeValue(left.createdAt), getTimeValue(right.createdAt));
      break;
    case "updatedAt":
      comparison = compareNumber(getTimeValue(left.updatedAt), getTimeValue(right.updatedAt));
      break;
    case "title":
      comparison = compareText(left.title, right.title);
      break;
    case "position":
    default:
      comparison = Number(left.position ?? 0) - Number(right.position ?? 0);
      break;
  }

  if (comparison === 0) {
    comparison = compareByDeadline(left, right, options.listsById, now);
  }
  if (comparison === 0) {
    comparison = compareText(left.title, right.title);
  }

  return options.sortDirection === "asc" ? comparison : -comparison;
}
