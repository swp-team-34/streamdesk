import type { Equipment } from "@shared/schema";

export type EstimateLine = {
  lineId: string;
  catalogId: string;
  equipmentIds: string[];
  name: string;
  type: string;
  model: string;
  quantity: number;
  availableQty: number;
  totalQty: number;
  unitPrice: number;
  baseTotal: number;
  shiftFactor: number;
  total: number;
  priceSource: string;
  availability: "in_stock" | "partial" | "unavailable";
  priceStatus: "priced" | "no_price";
  confidence: number;
  reason: string;
  locations: string[];
};

export type EstimateMissingLine = {
  name: string;
  type?: string;
  quantity: number;
  reason: string;
};

export type EstimateShiftSegment = {
  kind: "weekday_day" | "weekday_night" | "weekend_day" | "weekend_night";
  label: string;
  hours: number;
  shifts: number;
  coefficient: number;
  amountFactor: number;
};

export type EstimateShiftCalculation = {
  source: "manual" | "dates" | "ai_dates";
  startAt: string | null;
  endAt: string | null;
  actualHours: number;
  shiftHours: number;
  roundingStep: number;
  chargeableShifts: number;
  chargeFactor: number;
  segments: EstimateShiftSegment[];
  warnings: string[];
};

export type EstimateResult = {
  title: string;
  source: "ai" | "heuristic";
  summary: string;
  items: EstimateLine[];
  missing: EstimateMissingLine[];
  warnings: string[];
  totals: {
    subtotal: number;
    lines: number;
    quantity: number;
    missingPrices: number;
    availabilityIssues: number;
  };
  catalogStats?: {
    total: number;
    priced: number;
    equipmentTotal: number;
    availableTotal: number;
  };
  document?: {
    name: string;
    extractedChars: number;
  } | null;
  shiftCalculation?: EstimateShiftCalculation;
  aiSchedule?: {
    startAt: string | null;
    endAt: string | null;
    notes: string;
  } | null;
};

export type EstimateHistoryEntry = {
  id: string;
  title: string;
  savedAt: string;
  estimate: EstimateResult;
  deliveryDistanceKm: string;
};

export type CatalogItem = {
  id: string;
  equipmentIds: string[];
  name: string;
  type: string;
  model: string;
  unitPrice: number;
  priceSource: string;
  availableQty: number;
  totalQty: number;
  locations: string[];
};

export const ESTIMATE_HISTORY_KEY = "streamdesk_estimate_history_v1";

export function parseMoneyValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let cleaned = String(value ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/[^\d,.\-]/g, "");
  if (!cleaned) return 0;
  if (cleaned.includes(",") && !cleaned.includes(".")) cleaned = cleaned.replace(",", ".");
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (dotCount > 1) {
    const parts = cleaned.split(".");
    const decimal = parts.pop() || "";
    cleaned = `${parts.join("")}.${decimal}`;
  } else if (/^\d+\.\d{3}$/.test(cleaned)) {
    cleaned = cleaned.replace(".", "");
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^0-9a-zа-я]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function readEquipmentPrice(item: Equipment): { value: number; source: string } {
  const specifications = asRecord(item.specifications);
  const keys = [
    "estimatePrice",
    "estimate_price",
    "estimateUnitPrice",
    "unitPrice",
    "price",
    "cost",
    "цена",
    "цена за смену",
    "стоимость",
    "стоимость за смену",
    "сметная стоимость",
  ];

  for (const key of keys) {
    if (specifications[key] != null) {
      const value = parseMoneyValue(specifications[key]);
      if (value) return { value, source: key };
    }
  }

  for (const [key, value] of Object.entries(specifications)) {
    const normalizedKey = normalizeText(key);
    if (
      normalizedKey.includes("цен") ||
      normalizedKey.includes("стоим") ||
      normalizedKey.includes("прайс") ||
      normalizedKey.includes("price") ||
      normalizedKey.includes("cost")
    ) {
      const parsed = parseMoneyValue(value);
      if (parsed) return { value: parsed, source: key };
    }
  }

  return { value: 0, source: "" };
}

export function getTypeText(type: string) {
  switch (type) {
    case "camera": return "Камера";
    case "microphone": return "Микрофон";
    case "lighting": return "Свет";
    case "computer": return "Компьютер";
    case "audio": return "Аудио";
    case "video": return "Видео";
    case "network": return "Сеть";
    case "display": return "Экран";
    case "power": return "Питание";
    case "cable": return "Коммутация";
    case "labor": return "Персонал";
    case "transport": return "Доставка";
    default: return type || "Другое";
  }
}

function getEstimateGroup(type: string) {
  if (["audio", "microphone"].includes(type)) return { key: "audio", title: "Звук" };
  if (["video", "camera", "computer", "display"].includes(type)) return { key: "video", title: "Видео" };
  if (type === "lighting") return { key: "lighting", title: "Световое оборудование" };
  if (["network", "power", "cable"].includes(type)) return { key: "technical", title: "Коммутация, сеть и питание" };
  if (type === "labor") return { key: "labor", title: "Персонал" };
  if (type === "transport") return { key: "transport", title: "Доставка" };
  return { key: "other", title: "Дополнительно" };
}

export function groupEstimateItems(items: EstimateLine[]) {
  const order = ["audio", "video", "lighting", "technical", "labor", "transport", "other"];
  const groups = new Map<string, { key: string; title: string; items: EstimateLine[]; total: number }>();
  for (const item of items) {
    const group = getEstimateGroup(item.type);
    const existing = groups.get(group.key) || { ...group, items: [], total: 0 };
    existing.items.push(item);
    existing.total += Number(item.total) || 0;
    groups.set(group.key, existing);
  }
  return Array.from(groups.values())
    .map((group) => ({ ...group, total: Math.round(group.total * 100) / 100 }))
    .sort((left, right) => order.indexOf(left.key) - order.indexOf(right.key));
}

export function shouldExportToSchema(line: EstimateLine) {
  return !["labor", "transport", "cable", "power"].includes(line.type);
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(Number(value) || 0);
}

export function buildCatalog(equipment: Equipment[]): CatalogItem[] {
  const groups = new Map<string, Omit<CatalogItem, "id">>();

  for (const item of equipment) {
    const price = readEquipmentPrice(item);
    const key = normalizeText([item.type, item.name, item.model, price.value].join("|"));
    const existing = groups.get(key) || {
      equipmentIds: [],
      name: item.name,
      type: item.type,
      model: item.model || "",
      unitPrice: price.value,
      priceSource: price.source,
      availableQty: 0,
      totalQty: 0,
      locations: [],
    };

    existing.equipmentIds.push(item.id);
    existing.totalQty += 1;
    if (item.status === "available") existing.availableQty += 1;
    if (item.location && !existing.locations.includes(item.location)) existing.locations.push(item.location);
    if (!existing.unitPrice && price.value) {
      existing.unitPrice = price.value;
      existing.priceSource = price.source;
    }
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .sort((left, right) => `${left.type} ${left.name}`.localeCompare(`${right.type} ${right.name}`, "ru"))
    .map((item, index) => ({ ...item, id: `manual-${index + 1}` }));
}

export function recalculateTotals(items: EstimateLine[]): EstimateResult["totals"] {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    lines: items.length,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    missingPrices: items.filter((item) => !item.unitPrice).length,
    availabilityIssues: items.filter((item) => item.availability !== "in_stock").length,
  };
}

export function buildLineFromCatalog(item: CatalogItem, index: number, shiftFactor = 1): EstimateLine {
  const baseTotal = Math.round(item.unitPrice * 100) / 100;
  return {
    lineId: `manual-${item.id}-${Date.now()}-${index}`,
    catalogId: item.id,
    equipmentIds: item.equipmentIds,
    name: item.name,
    type: item.type,
    model: item.model,
    quantity: 1,
    availableQty: item.availableQty,
    totalQty: item.totalQty,
    unitPrice: item.unitPrice,
    baseTotal,
    shiftFactor,
    total: Math.round(baseTotal * shiftFactor * 100) / 100,
    priceSource: item.priceSource,
    availability: item.availableQty >= 1 ? "in_stock" : "unavailable",
    priceStatus: item.unitPrice > 0 ? "priced" : "no_price",
    confidence: 1,
    reason: "Добавлено вручную",
    locations: item.locations.slice(0, 5),
  };
}

export function calculateDelivery(items: EstimateLine[], distanceKmText: string) {
  const distanceKm = Math.max(0, Number(distanceKmText) || 0);
  const quantity = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  const vehicles = quantity > 0 ? Math.max(1, Math.ceil(quantity / 14)) : 0;
  const loadHours = vehicles ? Math.max(2, Math.ceil(quantity / 10)) : 0;
  const driveHours = vehicles ? Math.max(1, Math.ceil((distanceKm * 2) / 45)) : 0;
  const hours = vehicles ? loadHours + driveHours : 0;
  const basePerVehicle = 4500;
  const kmRate = 55;
  const hourlyRate = 1200;
  const total = vehicles
    ? Math.round((vehicles * basePerVehicle + vehicles * distanceKm * 2 * kmRate + hours * hourlyRate) * 100) / 100
    : 0;
  return { distanceKm, quantity, vehicles, hours, total };
}

export function inferPortsForEstimateLine(line: EstimateLine) {
  const text = normalizeText([line.type, line.name, line.model].join(" "));
  const portsIn: Array<{ id: string; name: string; type: "in"; portType?: string }> = [];
  const portsOut: Array<{ id: string; name: string; type: "out"; portType?: string }> = [];
  const addIn = (name: string, portType = name) => portsIn.push({ id: `in-${portsIn.length + 1}`, name, type: "in", portType });
  const addOut = (name: string, portType = name) => portsOut.push({ id: `out-${portsOut.length + 1}`, name, type: "out", portType });
  if (text.includes("atem") && text.includes("mini")) {
    ["HDMI IN 1", "HDMI IN 2", "HDMI IN 3", "HDMI IN 4", "LAN", "USB-C", "MIC 1", "MIC 2"].forEach((name) => addIn(name, name.includes("HDMI") ? "HDMI" : name.includes("MIC") ? "3.5mm" : name));
    addOut("HDMI OUT", "HDMI");
    addOut("USB-C OUT", "USB");
  } else if (text.includes("constellation") || text.includes("television studio")) {
    Array.from({ length: 8 }, (_, index) => addIn(`SDI IN ${index + 1}`, "SDI"));
    Array.from({ length: 8 }, (_, index) => addOut(`SDI OUT ${index + 1}`, "SDI"));
    addIn("REF IN", "BNC");
    addIn("LAN", "LAN");
    addOut("MADI OUT", "MADI");
  } else if (text.includes("atem") || text.includes("switcher")) {
    Array.from({ length: 8 }, (_, index) => addIn(`SDI IN ${index + 1}`, "SDI"));
    Array.from({ length: 4 }, (_, index) => addOut(`SDI OUT ${index + 1}`, "SDI"));
    addIn("LAN", "LAN");
  } else if (text.includes("novastar") || text.includes("vx1000") || text.includes("процессор")) {
    addIn("HDMI IN", "HDMI");
    addIn("DVI IN", "DVI");
    addIn("SDI IN", "SDI");
    Array.from({ length: 4 }, (_, index) => addOut(`EtherCON OUT ${index + 1}`, "LAN"));
    addIn("LAN CONTROL", "LAN");
  } else if (text.includes("resolume") || text.includes("vmix") || text.includes("медиасервер") || text.includes("ноутбук")) {
    addIn("LAN", "LAN");
    addOut("HDMI OUT", "HDMI");
    addOut("SDI OUT", "SDI");
    addOut("NDI OUT", "LAN");
  } else if (line.type === "camera" || text.includes("camera")) {
    if (text.includes("sdi") || text.includes("broadcast") || text.includes("studio") || text.includes("ursa") || text.includes("bmpcc")) addOut("SDI OUT", "SDI");
    if (portsOut.length === 0 || text.includes("hdmi") || text.includes("sony") || text.includes("canon")) addOut("HDMI OUT", "HDMI");
    addIn("DC IN", "DC");
    addIn("LAN/CONTROL", "LAN");
  } else if (line.type === "network" || text.includes("router") || text.includes("switch")) {
    Array.from({ length: text.includes("24") ? 24 : text.includes("16") ? 16 : 8 }, (_, index) => addIn(`LAN${index + 1}`, "LAN"));
    Array.from({ length: text.includes("24") ? 24 : text.includes("16") ? 16 : 8 }, (_, index) => addOut(`LAN OUT ${index + 1}`, "LAN"));
  } else if (line.type === "audio" || text.includes("mixer") || text.includes("микшер") || text.includes("пульт")) {
    const inputs = text.includes("x32") || text.includes("wing") ? 32 : text.includes("dlive") || text.includes("midas") ? 48 : 8;
    Array.from({ length: Math.min(inputs, 16) }, (_, index) => addIn(`XLR IN ${index + 1}`, "XLR"));
    Array.from({ length: 6 }, (_, index) => addOut(`XLR OUT ${index + 1}`, "XLR"));
    addIn("AES50 A", "AES50");
    addOut("AES50 A", "AES50");
    addIn("LAN", "LAN");
  } else if (line.type === "microphone" || text.includes("mic")) {
    if (text.includes("радио") || text.includes("wireless") || text.includes("shure") || text.includes("sennheiser")) {
      addOut("XLR OUT", "XLR");
      addOut("Jack OUT", "TRS");
      addIn("ANT A/B", "RF");
    } else {
      addOut("XLR OUT", "XLR");
    }
  } else if (line.type === "display") {
    addIn("HDMI", "HDMI");
    addIn("SDI", "SDI");
    addIn("LAN", "LAN");
  } else if (line.type === "lighting") {
    addIn("DMX IN", "DMX");
    addOut("DMX THRU", "DMX");
    if (text.includes("artnet") || text.includes("landmx")) {
      addIn("LAN/ArtNet", "LAN");
      Array.from({ length: 4 }, (_, index) => addOut(`DMX OUT ${index + 1}`, "DMX"));
    }
  } else {
    addIn("LAN", "LAN");
    addOut("HDMI", "HDMI");
  }
  return { portsIn, portsOut };
}

export function isSignalHub(line: EstimateLine, signal: "audio" | "video" | "lighting" | "network") {
  const text = normalizeText([line.type, line.name, line.model].join(" "));
  if (signal === "audio") return line.type === "audio" && /(mixer|mix|x32|wing|midas|allen|пульт|микшер|консоль)/i.test(text);
  if (signal === "video") return line.type === "video" && /(atem|switcher|микшер|коммутатор|процессор|vx|novastar|matrix)/i.test(text);
  if (signal === "lighting") return line.type === "lighting" && /(console|command|wing|пульт|контроллер|dmx|artnet|splitter|сплиттер)/i.test(text);
  if (signal === "network") return line.type === "network" || /(router|switch|роутер|коммутатор|lan|сеть)/i.test(text);
  return false;
}

export function getPortId(
  ports: Array<{ id: string; portType?: string; name: string }>,
  wanted: string,
  used: Set<string>,
) {
  const direct = ports.find((port) =>
    !used.has(port.id) && normalizeText(port.portType || port.name).includes(normalizeText(wanted))
  );
  const fallback = direct || ports.find((port) => !used.has(port.id)) || ports[0];
  if (fallback) used.add(fallback.id);
  return fallback?.id || "";
}

export function getConsideredModel(line: EstimateLine) {
  const explicit = [line.model, line.name].map((value) => String(value || "").trim()).filter(Boolean).join(" / ");
  if (explicit) return explicit;
  return getTypeText(line.type);
}

export function loadEstimateHistory(): EstimateHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ESTIMATE_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function persistEstimateHistory(entries: EstimateHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ESTIMATE_HISTORY_KEY, JSON.stringify(entries.slice(0, 40)));
}
