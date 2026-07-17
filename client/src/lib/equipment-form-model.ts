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

const ESTIMATE_SPECIFICATION_KEYS = new Set(["estimatePrice", "estimateCurrency"]);

export interface EquipmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenParentBundle?: (equipment: any) => void;
  parentBundleExists?: boolean;
  equipment?: any;
  mode?: "full" | "take_return";
  companyManager?: boolean;
  companyId?: string;
  categories?: Array<{
    id: string;
    name: string;
    parentId?: string | null;
    archivedAt?: string | null;
  }>;
  storageLocations?: Array<{
    id: string;
    name: string;
    path?: string | null;
    type?: string | null;
    parentId?: string | null;
    archivedAt?: string | null;
  }>;
  locations?: Array<{
    id: string;
    name: string;
    companyId?: string | null;
    archivedAt?: string | null;
  }>;
  projects?: Array<{
    id: string;
    name: string;
    companyId?: string | null;
    status?: string | null;
  }>;
  kanbanCards?: Array<{
    id: string;
    title: string;
    boardName?: string | null;
    listName?: string | null;
    projectId?: string | null;
    boardProjectId?: string | null;
    companyId?: string | null;
  }>;
}

export function isInternalEquipmentSpecificationKey(key: string) {
  return INTERNAL_SPECIFICATION_KEYS.has(key.trim());
}

export function isHiddenEquipmentSpecificationKey(key: string) {
  return isInternalEquipmentSpecificationKey(key) || ESTIMATE_SPECIFICATION_KEYS.has(key.trim());
}

export function asEquipmentRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function getEquipmentEstimatePrice(specifications: unknown) {
  const record = asEquipmentRecord(specifications);
  const candidates = [
    "estimatePrice",
    "estimate_price",
    "estimateUnitPrice",
    "unitPrice",
    "price",
    "cost",
    "Цена",
    "Цена для сметы",
    "Стоимость",
    "Стоимость для сметы",
    "Сметная стоимость",
  ];
  for (const key of candidates) {
    const value = record[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function getEquipmentOperabilityStatus(equipment: any) {
  const explicit = String(equipment?.operabilityStatus || "").trim();
  if (explicit) return explicit;
  if (equipment?.status === "broken") return "broken";
  if (equipment?.status === "maintenance") return "on_repair";
  return "working";
}

export function readCurrentEquipmentUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("streamstudio_user") || "{}");
  } catch {
    return null;
  }
}

export function serializeEquipmentSpecifications(specifications: unknown) {
  if (!specifications || typeof specifications !== "object" || Array.isArray(specifications)) return "";

  return Object.entries(specifications as Record<string, unknown>)
    .filter(([key]) => !isHiddenEquipmentSpecificationKey(String(key ?? "")))
    .map(([key, value]) => {
      const normalizedKey = String(key ?? "").trim();
      const normalizedValue = value && typeof value === "object"
        ? JSON.stringify(value)
        : String(value ?? "").trim();
      return normalizedKey && normalizedValue ? `${normalizedKey}: ${normalizedValue}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function parseEquipmentSpecifications(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, line, index) => {
      const separatorMatch = line.match(/\s[:=]\s|\s[-–—]\s|[:=]/);
      const separatorIndex = separatorMatch?.index ?? -1;
      if (separatorIndex === -1) {
        result[`Характеристика ${index + 1}`] = line;
        return result;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + (separatorMatch?.[0]?.length ?? 1)).trim();
      if (key && value) result[key] = value;
      return result;
    }, {});
}

export function normalizeEquipmentInventoryPart(value: unknown, fallback: string) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9А-ЯЁ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  return normalized || fallback;
}

export function getEquipmentInventoryPrefix(type: unknown) {
  const normalized = String(type || "").trim().toLowerCase();
  if (/camera|камера/.test(normalized)) return "cam";
  if (/microphone|mic|микрофон/.test(normalized)) return "mic";
  if (/lighting|light|свет/.test(normalized)) return "lgt";
  if (/computer|комп/.test(normalized)) return "pc";
  if (/server|сервер/.test(normalized)) return "srv";
  if (/display|monitor|экран|монитор/.test(normalized)) return "dsp";
  if (/audio|звук/.test(normalized)) return "aud";
  if (/video|видео/.test(normalized)) return "vid";
  if (/network|lan|сеть/.test(normalized)) return "net";
  return "eqp";
}
