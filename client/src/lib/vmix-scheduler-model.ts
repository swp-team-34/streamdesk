import { differenceInMinutes, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export interface VmixEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  status: "scheduled" | "live" | "completed" | "error";
  actions: string[];
  input?: string;
  preset?: string;
  channel?: string;
  vmixHost?: string | null;
  vmixPort?: number | null;
  executedAt?: string;
  errorMessage?: string | null;
}

export interface VmixConnection {
  connected: boolean;
  host: string;
  port: number;
  inputs: Array<{ number: number; title: string; state: string }>;
  preview: number;
  program: number;
  recording: boolean;
  streaming: boolean;
}

export type VmixTargetMode = "agent" | "direct";

export const asVmixRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

export function selectVmixAgents(systems: any[]) {
  return systems.filter((system) => {
    const specifications = asVmixRecord(system.specifications);
    const agent = asVmixRecord(specifications.agent);
    const vmix = asVmixRecord(specifications.vmix);
    const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities : [];
    return agent.deviceType === "vmix" || capabilities.includes("vmix-scheduler") || vmix.enabled;
  });
}

export function findSelectedVmixAgent(agents: any[], selectedAgentKey: string) {
  return agents.find((system) => {
    const specifications = asVmixRecord(system.specifications);
    const agent = asVmixRecord(specifications.agent);
    return String(agent.agentKey || specifications.agentKey || "") === selectedAgentKey;
  }) || agents[0];
}

export function getVmixAgentState(agent: any, selectedAgentKey = "") {
  const specifications = asVmixRecord(agent?.specifications);
  const agentInfo = asVmixRecord(specifications.agent);
  const vmix = asVmixRecord(specifications.vmix);
  const effectiveAgentKey = String(agentInfo.agentKey || specifications.agentKey || selectedAgentKey || "");
  const connection: VmixConnection | undefined = agent ? {
    connected: Boolean(vmix.connected),
    host: agent?.name || "vMix agent",
    port: 0,
    inputs: Array.isArray(vmix.inputs) ? vmix.inputs : [],
    preview: Number(vmix.preview || 0),
    program: Number(vmix.active || vmix.program || 0),
    recording: Boolean(vmix.recording),
    streaming: Boolean(vmix.streaming),
  } : undefined;

  return { specifications, agentInfo, vmix, effectiveAgentKey, connection };
}

export function buildVmixEventActions(input: string, selectedActions: string[]) {
  const actions = [...selectedActions];
  if (input) {
    actions.push(`PreviewInput${input}`);
    if (!actions.includes("Cut") && !actions.includes("Fade")) actions.push("Cut");
  }
  return actions;
}

export function getVmixEventStatusClass(status: string) {
  switch (status) {
    case "live":
      return "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50";
    case "scheduled":
      return "bg-blue-500 text-white dark:bg-blue-600";
    case "completed":
      return "bg-emerald-500 text-white dark:bg-emerald-600";
    case "error":
      return "bg-red-500 text-white dark:bg-red-600";
    default:
      return "bg-slate-500 text-white dark:bg-slate-600";
  }
}

export function getVmixEventStatusLabel(status: string) {
  switch (status) {
    case "live": return "В эфире";
    case "scheduled": return "Запланировано";
    case "completed": return "Завершено";
    case "error": return "Ошибка";
    default: return status;
  }
}

export function formatVmixEventDate(dateValue: string, now = new Date()) {
  try {
    const date = parseISO(dateValue);
    if (date.toDateString() === now.toDateString()) {
      return `Сегодня, ${format(date, "HH:mm")}`;
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Завтра, ${format(date, "HH:mm")}`;
    }
    return format(date, "d MMM, HH:mm", { locale: ru });
  } catch {
    return dateValue;
  }
}

export function getTimeUntilVmixEvent(dateValue: string, now = new Date()) {
  try {
    const difference = differenceInMinutes(parseISO(dateValue), now);
    if (difference < 0) return null;
    if (difference < 60) return `${difference} мин`;
    return `${Math.floor(difference / 60)}ч ${difference % 60}м`;
  } catch {
    return null;
  }
}

export function selectUpcomingVmixEvents(events: VmixEvent[], now = new Date(), limit = 5) {
  return events.filter((event) => {
    try {
      const startTime = parseISO(event.startTime).getTime();
      return !Number.isFinite(startTime) || startTime >= now.getTime() || event.status === "live";
    } catch {
      return true;
    }
  }).slice(0, limit);
}
