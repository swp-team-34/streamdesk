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
  available: "border-success/25 bg-success-muted text-success",
  occupied: "border-info/25 bg-info-muted text-info",
  reserved: "border-warning/25 bg-warning-muted text-warning",
  maintenance: "border-primary/25 bg-primary/10 text-primary",
  unavailable: "border-error/25 bg-error-muted text-error",
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
