import type { LocationTopic } from "@/components/location-topics-workspace";
import {
  ALL_RECORDING_PLACE_STATUSES,
  type RecordingPlaceStatus,
} from "@/lib/recording-place-status";

export type LocationAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadedByName?: string | null;
  createdAt?: string | null;
};

export type Location = {
  id: string;
  companyId?: string | null;
  name: string;
  description?: string | null;
  type?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: RecordingPlaceStatus | null;
  attachments?: LocationAttachment[] | null;
  archivedAt?: string | null;
  archivedByName?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  createdAt?: string | null;
  activeLinks?: LocationActiveLinks;
  linkedWork?: {
    cards: Array<{
      id: string;
      title: string;
      boardId: string;
      boardName: string;
      projectId?: string | null;
      listName: string;
      listType: string;
      status: "active" | "completed";
    }>;
    projects: Array<{
      id: string;
      name: string;
      status: string;
      completed: boolean;
      source: "direct" | "cards" | "direct_and_cards";
    }>;
  };
};

export type LocationForm = {
  companyId: string;
  name: string;
  type: string;
  address: string;
  description: string;
  notes: string;
  status: RecordingPlaceStatus;
};

export type LocationActiveLinks = {
  activeKanbanCards: number;
  activeProjects: number;
  unresolvedDiscussions: number;
  total: number;
};

export type ArchivePreview = {
  locationId: string;
  activeLinks: LocationActiveLinks;
};

export type LocationArchiveFilter = "active" | "archived" | "all";
export type LocationSort = "name" | "status" | "newest" | "updated";

export const EMPTY_LOCATION: LocationForm = {
  companyId: "",
  name: "",
  type: "recording",
  address: "",
  description: "",
  notes: "",
  status: "available",
};

export function formatLocationDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLocationFileSize(value?: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function getActiveLocationIssueCounts(issues: LocationTopic[]) {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    if (issue.type === "issue" && issue.status === "active") {
      counts.set(issue.locationId, (counts.get(issue.locationId) ?? 0) + 1);
    }
  }
  return counts;
}

export function getVisibleLocations({
  locations,
  archiveFilter,
  statusFilter,
  search,
  sort,
}: {
  locations: Location[];
  archiveFilter: LocationArchiveFilter;
  statusFilter: string;
  search: string;
  sort: LocationSort;
}) {
  const needle = search.trim().toLocaleLowerCase("ru-RU");

  return locations
    .filter((location) =>
      archiveFilter === "all" ||
      (archiveFilter === "archived" ? Boolean(location.archivedAt) : !location.archivedAt),
    )
    .filter((location) =>
      statusFilter === ALL_RECORDING_PLACE_STATUSES || location.status === statusFilter,
    )
    .filter((location) => !needle || [
      location.name,
      location.type,
      location.address,
      location.description,
      location.notes,
    ].some((value) => String(value || "").toLocaleLowerCase("ru-RU").includes(needle)))
    .sort((left, right) => sort === "status"
      ? String(left.status || "available").localeCompare(String(right.status || "available"), "ru") ||
        left.name.localeCompare(right.name, "ru")
      : sort === "newest"
        ? new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
        : sort === "updated"
          ? new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
          : left.name.localeCompare(right.name, "ru"));
}
