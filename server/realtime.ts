import crypto from "crypto";

export type RealtimeChannelScope = "company" | "project" | "kanban-card" | "location" | "equipment";

export type ParsedRealtimeChannel = {
  channel: string;
  scope: RealtimeChannelScope;
  recordId: string;
  topic: "comments" | "topics" | null;
};

export type DiscussionRealtimeEvent = {
  type: "discussion_event";
  channel: string;
  eventId: string;
  action: "created" | "replied" | "updated" | "deleted" | "status";
  recordId: string;
  version: string;
  occurredAt: string;
};

const CHANNEL_PATTERN = /^(company|project|kanban-card|location|equipment):([A-Za-z0-9_-]{1,160})(?::(comments|topics))?$/;

export function parseRealtimeChannel(value: unknown): ParsedRealtimeChannel | null {
  const channel = String(value || "").trim();
  const match = CHANNEL_PATTERN.exec(channel);
  if (!match) return null;

  const scope = match[1] as RealtimeChannelScope;
  const recordId = match[2];
  const topic = (match[3] || null) as ParsedRealtimeChannel["topic"];
  const expectedTopic = scope === "location" ? "topics" : scope === "company" ? null : "comments";
  if (topic !== expectedTopic) return null;

  return { channel, scope, recordId, topic };
}

export function normalizeRealtimeChannels(value: unknown, limit = 50): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean))).slice(0, limit);
}

export function createDiscussionRealtimeEvent(input: {
  channel: string;
  action: DiscussionRealtimeEvent["action"];
  recordId: string;
  version?: string | Date | null;
}): DiscussionRealtimeEvent {
  const occurredAt = new Date().toISOString();
  const parsedVersion = input.version instanceof Date
    ? input.version.toISOString()
    : String(input.version || occurredAt);

  return {
    type: "discussion_event",
    channel: input.channel,
    eventId: crypto.randomUUID(),
    action: input.action,
    recordId: input.recordId,
    version: parsedVersion,
    occurredAt,
  };
}
