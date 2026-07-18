import type { Equipment } from "@shared/schema";

const INTERNAL_SPECIFICATION_KEYS = new Set([
  "agent",
  "agentKey",
  "checkout",
  "checkoutHistory",
  "companyId",
  "createdBy",
  "createdByUserId",
  "noteAudit",
  "notesHistory",
  "equipmentComments",
  "isSuperPosition",
  "bundleType",
  "bundleComponentIds",
  "bundleComponents",
  "assembledAt",
  "assembledByUserId",
  "assembledByName",
  "parentBundleId",
  "parentBundleName",
  "parentBundleCreatedAt",
  "bundleExtractionHistory",
  "kitExtractionHistory",
  "hardware",
  "metrics",
  "metricsHistory",
  "workspace",
  "localIps",
  "syncedAt",
  "systemId",
  "source",
  "deviceType",
]);

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function toLocalDateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatEquipmentDateTime(value: string | undefined) {
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

export function formatEquipmentReturnDateTime(dateValue: string, timeValue?: string) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T${timeValue || "23:59"}`);
  if (Number.isNaN(date.getTime())) return [dateValue, timeValue].filter(Boolean).join(" ");
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSpecificationValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return String(record.name || record.caption || record.model || record.description || "").trim();
        }
        return String(item ?? "").trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, itemValue]) => {
        if (itemValue && typeof itemValue === "object") return "";
        return `${key}: ${String(itemValue ?? "").trim()}`;
      })
      .filter(Boolean)
      .join(", ");
  }
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function getSpecificationEntries(specifications: unknown): Array<[string, string]> {
  if (!specifications || typeof specifications !== "object" || Array.isArray(specifications)) {
    return [];
  }

  return Object.entries(specifications as Record<string, unknown>)
    .filter(([key]) => !INTERNAL_SPECIFICATION_KEYS.has(String(key ?? "").trim()))
    .map(([key, value]) => [String(key).trim(), formatSpecificationValue(value)] as [string, string])
    .filter(([key, value]) => key && value);
}

export function getEquipmentPhotos(item: Equipment | null | undefined): string[] {
  return Array.isArray(item?.photos)
    ? (item.photos as unknown[])
        .map((photo) => String(photo || "").trim())
        .filter(Boolean)
        .filter((photo) => !photo.startsWith("blob:"))
        .map((photo) => {
          const normalized = photo.replace(/\\/g, "/");
          if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith("/")) return normalized;
          if (normalized.includes("uploads/")) return `/${normalized.replace(/^\/+/, "")}`;
          return `/uploads/${normalized.replace(/^\/+/, "")}`;
        })
    : [];
}

export function getEquipmentStorageLocation(item: Equipment | null | undefined) {
  return String((item as any)?.warehouseStorageLocation?.path || item?.storageLocation || "").trim();
}

export function getEquipmentCategoryLabel(item: Equipment | null | undefined) {
  const categoryName = String((item as any)?.category?.name || "").trim();
  if (categoryName) return categoryName;
  switch (String(item?.type || "")) {
    case "microphone": return "Микрофон";
    case "camera": return "Камера";
    case "lighting": return "Освещение";
    case "computer": return "Компьютер";
    case "audio": return "Аудиооборудование";
    case "video": return "Видеооборудование";
    default: return String(item?.type || "").trim() || "Другое";
  }
}

export function getEquipmentResponsiblePerson(item: Equipment | null | undefined) {
  return String(item?.responsiblePerson || "").trim();
}

export function getEquipmentResponsibleContact(item: Equipment | null | undefined) {
  return String(item?.responsibleContact || "").trim();
}

export function getEquipmentCompanyId(item: Equipment | null | undefined) {
  return String(asRecord(item?.specifications).companyId || "").trim();
}

export function getEquipmentActivitySummary(item: Equipment | null | undefined) {
  const summary = asRecord((item as any)?.activitySummary);
  return {
    commentCount: Number(summary.commentCount || 0),
    attachmentCount: Number(summary.attachmentCount || 0),
    latestAt: summary.latestAt ? String(summary.latestAt) : "",
    latestAuthorName: summary.latestAuthorName ? String(summary.latestAuthorName) : "",
  };
}

export function getEquipmentPhysicalDestination(item: Equipment | null | undefined) {
  const destination = asRecord((item as any)?.physicalDestination);
  return {
    locationId: String(destination.locationId || (item as any)?.locationId || "").trim(),
    locationName: String(destination.locationName || "").trim(),
    manualLocation: String(destination.manualLocation || (item as any)?.manualLocation || "").trim(),
    displayName: String(destination.displayName || item?.location || "").trim(),
    archived: destination.archived === true,
    legacyLocation: String(destination.legacyLocation || "").trim(),
  };
}

export function getEquipmentContextLinks(item: Equipment | null | undefined): any[] {
  const workContext = asRecord((item as any)?.workContext);
  return Array.isArray(workContext.links) ? workContext.links : [];
}

export function getEquipmentOperabilityStatus(item: Equipment | null | undefined) {
  const explicit = String(item?.operabilityStatus || "").trim();
  if (explicit) return explicit;
  if (item?.status === "broken") return "broken";
  if (item?.status === "maintenance") return "on_repair";
  return "working";
}

export function isEquipmentOperable(item: Equipment | null | undefined) {
  return getEquipmentOperabilityStatus(item) === "working";
}

export function getInoperableEquipmentMessage(item: Equipment | null | undefined) {
  return getEquipmentOperabilityStatus(item) === "broken"
    ? "Оборудование помечено как неисправное и недоступно для выдачи."
    : "Оборудование находится в ремонте и недоступно для выдачи.";
}

export function getEquipmentStatusClass(status: string) {
  switch (status) {
    case "available": return "border-success/20 bg-success-muted text-success";
    case "in-use": return "border-info/20 bg-info-muted text-info";
    case "maintenance": return "border-warning/20 bg-warning-muted text-warning";
    case "broken": return "border-error/20 bg-error-muted text-error";
    default: return "border-border/40 bg-muted text-muted-foreground";
  }
}

export function getEquipmentStatusLabel(status: string) {
  switch (status) {
    case "available": return "Доступно";
    case "in-use": return "Используется";
    case "maintenance": return "Обслуживание";
    case "broken": return "Сломано";
    default: return status;
  }
}

export function getEquipmentOperabilityClass(status: string) {
  switch (status) {
    case "working": return "border-success/20 bg-success-muted text-success";
    case "broken": return "border-error/20 bg-error-muted text-error";
    case "on_repair": return "border-warning/20 bg-warning-muted text-warning";
    default: return "border-border/40 bg-muted text-muted-foreground";
  }
}

export function getEquipmentOperabilityLabel(status: string) {
  switch (status) {
    case "working": return "Исправно";
    case "broken": return "Неисправно";
    case "on_repair": return "В ремонте";
    default: return status || "Исправно";
  }
}
