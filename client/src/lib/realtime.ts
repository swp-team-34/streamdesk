export type RealtimeMessage = {
  type: string;
  channel?: string;
  eventId?: string;
  recordId?: string;
  version?: string;
  action?: string;
  results?: Array<{ channel: string; authorized: boolean }>;
  data?: unknown;
  [key: string]: unknown;
};

type RealtimeListener = (message: RealtimeMessage) => void;
type RealtimeStatusListener = (connected: boolean) => void;

export function getRealtimeReconnectDelay(attempt: number): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(1000 * (2 ** safeAttempt), 15_000);
}

export class BoundedRealtimeEventIds {
  private readonly ids = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly limit = 500) {}

  accept(eventId: unknown): boolean {
    const id = String(eventId || "").trim();
    if (!id) return true;
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    this.order.push(id);
    while (this.order.length > this.limit) {
      const oldest = this.order.shift();
      if (oldest) this.ids.delete(oldest);
    }
    return true;
  }

  get size() {
    return this.ids.size;
  }
}

export function shouldRefetchDiscussion(message: RealtimeMessage, channel: string): boolean {
  return message.type === "realtime_reconnected" ||
    (message.type === "discussion_event" && message.channel === channel);
}

class BrowserRealtimeTransport {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private everConnected = false;
  private disconnectedAfterOpen = false;
  private connecting = false;
  private connected = false;
  private readonly globalListeners = new Set<RealtimeListener>();
  private readonly statusListeners = new Set<RealtimeStatusListener>();
  private readonly channelListeners = new Map<string, Set<RealtimeListener>>();
  private readonly eventIds = new BoundedRealtimeEventIds();

  addGlobalListener(listener: RealtimeListener) {
    this.globalListeners.add(listener);
    this.ensureConnected();
    return () => {
      this.globalListeners.delete(listener);
      this.closeIfIdle();
    };
  }

  addStatusListener(listener: RealtimeStatusListener) {
    this.statusListeners.add(listener);
    listener(this.connected);
    this.ensureConnected();
    return () => {
      this.statusListeners.delete(listener);
      this.closeIfIdle();
    };
  }

  subscribe(channel: string, listener: RealtimeListener) {
    const normalizedChannel = String(channel || "").trim();
    if (!normalizedChannel) return () => undefined;
    const listeners = this.channelListeners.get(normalizedChannel) ?? new Set<RealtimeListener>();
    const isNewChannel = listeners.size === 0;
    listeners.add(listener);
    this.channelListeners.set(normalizedChannel, listeners);
    this.ensureConnected();
    if (isNewChannel) this.send({ type: "subscribe", channels: [normalizedChannel] });

    return () => {
      const current = this.channelListeners.get(normalizedChannel);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.channelListeners.delete(normalizedChannel);
        this.send({ type: "unsubscribe", channels: [normalizedChannel] });
      }
      this.closeIfIdle();
    };
  }

  private hasConsumers() {
    return this.globalListeners.size > 0 ||
      this.statusListeners.size > 0 ||
      this.channelListeners.size > 0;
  }

  private ensureConnected() {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") return;
    if (!this.hasConsumers() || !window.localStorage.getItem("streamstudio_user")) return;
    if (this.connecting || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.connecting = true;

    try {
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      this.socket = socket;

      socket.onopen = () => {
        this.connecting = false;
        this.connected = true;
        this.reconnectAttempt = 0;
        this.statusListeners.forEach((listener) => listener(true));
        this.send({
          type: "subscribe",
          channels: Array.from(this.channelListeners.keys()),
        });

        if (this.everConnected && this.disconnectedAfterOpen) {
          const reconnectMessage: RealtimeMessage = { type: "realtime_reconnected" };
          this.globalListeners.forEach((listener) => listener(reconnectMessage));
          this.channelListeners.forEach((listeners) => {
            listeners.forEach((listener) => listener(reconnectMessage));
          });
        }
        this.everConnected = true;
        this.disconnectedAfterOpen = false;
      };

      socket.onmessage = (event) => {
        let message: RealtimeMessage;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (message.type === "discussion_event" && !this.eventIds.accept(message.eventId)) return;
        if (message.type === "subscription_result") {
          for (const result of message.results ?? []) {
            if (result.authorized) continue;
            const denied: RealtimeMessage = {
              type: "subscription_denied",
              channel: result.channel,
            };
            this.channelListeners.get(result.channel)?.forEach((listener) => listener(denied));
          }
          return;
        }
        if (message.channel) {
          this.channelListeners.get(message.channel)?.forEach((listener) => listener(message));
        }
        this.globalListeners.forEach((listener) => listener(message));
      };

      socket.onclose = (event) => {
        if (this.socket === socket) this.socket = null;
        this.connecting = false;
        this.connected = false;
        this.statusListeners.forEach((listener) => listener(false));
        if (this.everConnected) this.disconnectedAfterOpen = true;
        if (event.code !== 1008) this.scheduleReconnect();
      };

      socket.onerror = () => {
        this.connected = false;
        this.statusListeners.forEach((listener) => listener(false));
      };
    } catch {
      this.connecting = false;
      this.connected = false;
      this.statusListeners.forEach((listener) => listener(false));
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.hasConsumers() || this.reconnectTimer) return;
    const delay = getRealtimeReconnectDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, delay);
  }

  private send(message: RealtimeMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch {
      this.connected = false;
    }
  }

  private closeIfIdle() {
    if (this.hasConsumers()) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    this.connecting = false;
    this.connected = false;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close(1000, "No active subscribers");
    }
  }
}

export const realtimeTransport = new BrowserRealtimeTransport();
