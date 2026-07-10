export const RECORDING_PLACE_STATUSES = [
  "available",
  "occupied",
  "reserved",
  "maintenance",
  "unavailable",
] as const;

export type RecordingPlaceStatus = typeof RECORDING_PLACE_STATUSES[number];

export const RECORDING_PLACE_STATUS_LABELS: Record<RecordingPlaceStatus, string> = {
  available: "Свободно",
  occupied: "Занято",
  reserved: "Зарезервировано",
  maintenance: "Обслуживание",
  unavailable: "Недоступно",
};

export const RECORDING_PLACE_STATUS_TONES: Record<RecordingPlaceStatus, string> = {
  available: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  occupied: "border-blue-500/40 bg-blue-500/10 text-blue-200",
  reserved: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  maintenance: "border-purple-500/40 bg-purple-500/10 text-purple-200",
  unavailable: "border-red-500/40 bg-red-500/10 text-red-200",
};

export const ALL_RECORDING_PLACE_STATUSES = "all";

export type RecordingPlaceStatusFilter = RecordingPlaceStatus | typeof ALL_RECORDING_PLACE_STATUSES;

export function normalizeRecordingPlaceStatus(value: unknown): RecordingPlaceStatus {
  return RECORDING_PLACE_STATUSES.includes(value as RecordingPlaceStatus)
    ? (value as RecordingPlaceStatus)
    : "available";
}

export function isPlanningLimited(status: unknown): boolean {
  return normalizeRecordingPlaceStatus(status) !== "available";
}

export function filterRecordingPlacesByStatus<T extends { status?: unknown }>(
  locations: T[],
  filter: RecordingPlaceStatusFilter,
): T[] {
  if (filter === ALL_RECORDING_PLACE_STATUSES) return locations;
  return locations.filter((location) => normalizeRecordingPlaceStatus(location.status) === filter);
}
