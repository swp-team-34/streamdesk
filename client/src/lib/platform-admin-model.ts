export type HeatPoint = {
  date: string;
  count: number;
  intensity: number;
};

export type CompanyActivity = {
  companyId: string;
  name: string;
  totalYear: number;
  totalMonth: number;
  activityHeatmap: HeatPoint[];
  recentSparkline: Array<{ weekStart: string; count: number }>;
  monthly: Array<{ month: string; label: string; count: number }>;
};

export type TelemetryData = {
  generatedAt: string;
  serverHost?: any;
  hostLoad?: any[];
  activityHeatmap: HeatPoint[];
  recentSparkline: Array<{ weekStart: string; count: number }>;
  hourlyLoad: any[];
  companyLoad: Array<{
    companyId: string;
    name: string;
    activity24h: number;
    avgCpu24h: number;
    avgMemory24h: number;
    systemsTotal: number;
    systemsOnline: number;
    openIncidents: number;
  }>;
  companyActivity?: CompanyActivity[];
  systemStatus: Array<{ name: string; value: number }>;
  incidentSeverity: Array<{ name: string; value: number }>;
  workspaceNeeds: Array<{ name: string; value: number }>;
  serviceUsage?: Array<{ name: string; value: number }>;
  opsAdvisor?: Array<{
    severity: string;
    title: string;
    message: string;
    recommendation: string;
    companyId?: string;
  }>;
  topSystems: Array<{
    id: string;
    name: string;
    companyName: string;
    status: string;
    cpuPercent: number | null;
    memoryPercent: number | null;
    diskPercent: number | null;
    networkMbps: number | null;
    lastPing: string | null;
  }>;
};

export const PLATFORM_COLORS = {
  violet: "#a78bfa",
  blue: "#60a5fa",
  cyan: "#22d3ee",
  green: "#34d399",
  amber: "#f59e0b",
  red: "#fb7185",
  slate: "#64748b",
};

export const PLATFORM_PIE_COLORS = [
  PLATFORM_COLORS.violet,
  PLATFORM_COLORS.blue,
  PLATFORM_COLORS.amber,
  PLATFORM_COLORS.red,
  PLATFORM_COLORS.cyan,
  PLATFORM_COLORS.green,
];

export const PLATFORM_MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export const PLATFORM_REFRESH_OPTIONS = [
  { value: 1000, label: "1 сек" },
  { value: 5000, label: "5 сек" },
  { value: 15000, label: "15 сек" },
  { value: 60000, label: "1 мин" },
  { value: 300000, label: "5 мин" },
];

export const PLATFORM_TABS = ["overview", "companies", "users", "ai", "incidents", "metrics"] as const;
export type PlatformTab = typeof PLATFORM_TABS[number];

export function normalizePlatformTab(value?: string | null): PlatformTab {
  return PLATFORM_TABS.includes(value as PlatformTab) ? value as PlatformTab : "overview";
}

export function readPlatformTabFromUrl(): PlatformTab {
  if (typeof window === "undefined") return "overview";
  return normalizePlatformTab(new URLSearchParams(window.location.search).get("tab"));
}

export function num(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function pct(value: unknown) {
  return `${Math.round(num(value))}%`;
}

export function formatBytes(value?: number | null) {
  const bytes = num(value);
  if (bytes <= 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 ? Math.round(size) : Math.round(size * 10) / 10} ${units[index]}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "нет данных";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "нет данных";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatUptime(seconds?: number | null) {
  const value = Math.max(0, num(seconds));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

export function statusLabel(value: string) {
  switch (value) {
    case "online": return "Онлайн";
    case "offline": return "Офлайн";
    case "maintenance": return "Обслуживание";
    case "open": return "Открыто";
    case "investigating": return "В работе";
    case "resolved": return "Выполнено";
    case "closed": return "Закрыто";
    case "active": return "Активна";
    case "suspended": return "Остановлена";
    default: return value || "неизвестно";
  }
}

export function severityLabel(value: string) {
  switch (value) {
    case "critical": return "Критично";
    case "high": return "Высокий";
    case "medium": return "Средний";
    case "low": return "Низкий";
    default: return value || "не указан";
  }
}

export function usageLabel(value: string) {
  switch (value) {
    case "heartbeat": return "Heartbeat";
    case "task_activity": return "Задачи";
    case "project_activity": return "Проекты";
    case "company_created": return "Компании";
    case "user_registered": return "Регистрации";
    case "incident": return "Инциденты";
    case "system_seen": return "Системы";
    case "streamdesk_host": return "Сервер";
    default: return value;
  }
}

export function createEmptyTelemetry(): TelemetryData {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 364);
  const activityHeatmap = Array.from({ length: 365 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { date: day.toISOString().slice(0, 10), count: 0, intensity: 0 };
  });
  const hourlyLoad = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now.getTime() - (23 - index) * 60 * 60 * 1000);
    return {
      label: date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      heartbeats: 0,
      activeSystems: 0,
      cpuPercent: 0,
      memoryPercent: 0,
      diskPercent: 0,
      networkMbps: 0,
    };
  });
  return {
    generatedAt: now.toISOString(),
    hostLoad: hourlyLoad.map((point) => ({
      label: point.label,
      cpuPercent: 0,
      memoryPercent: 0,
      diskPercent: 0,
      processHeapPercent: 0,
      processRssMb: 0,
      networkRxMbps: 0,
      networkTxMbps: 0,
      loadAvg1: 0,
    })),
    activityHeatmap,
    recentSparkline: [],
    hourlyLoad,
    companyLoad: [],
    systemStatus: [],
    incidentSeverity: [],
    workspaceNeeds: [],
    serviceUsage: [],
    opsAdvisor: [],
    topSystems: [],
    companyActivity: [],
  };
}

export function issueListForCompany(item: any, load?: any) {
  const issues: Array<{ level: "critical" | "warning" | "info"; text: string }> = [];
  const offline = num(item?.systems?.offline);
  const openIncidents = num(item?.incidents?.open ?? load?.openIncidents);
  const overdue = num(item?.tasks?.overdue);
  if (item?.company?.status && item.company.status !== "active") {
    issues.push({ level: "critical", text: `Статус компании: ${statusLabel(item.company.status)}` });
  }
  if (offline > 0) issues.push({ level: "warning", text: `Офлайн систем: ${offline}` });
  if (openIncidents > 0) issues.push({ level: "warning", text: `Открытых инцидентов: ${openIncidents}` });
  if (overdue > 0) issues.push({ level: "info", text: `Просроченных задач: ${overdue}` });
  if (!item?.workspace?.monitoringEnabled) issues.push({ level: "info", text: "Мониторинг компании выключен" });
  if (num(item?.systems?.total) === 0) issues.push({ level: "info", text: "Нет подключенных систем" });
  return issues;
}
