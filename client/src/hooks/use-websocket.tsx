import { useEffect, useRef, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import {
  realtimeTransport,
  type RealtimeMessage,
} from "@/lib/realtime";

function applyGlobalRealtimeMessage(data: RealtimeMessage) {
  switch (data.type) {
    case "systems_update":
      queryClient.setQueryData(["/api/systems"], data.data);
      break;
    case "streams_update":
      queryClient.setQueryData(["/api/streams", "active=true"], data.data);
      break;
    case "tasks_update":
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
      break;
    case "events_update":
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      break;
    case "youtube_stats":
      queryClient.setQueryData(["/api/integrations/youtube/stats"], data.data);
      break;
    case "vk_stats":
      queryClient.setQueryData(["/api/integrations/vk/stats"], data.data);
      break;
    case "realtime_reconnected":
      queryClient.invalidateQueries({ queryKey: ["/api/systems"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
      break;
    default:
      break;
  }
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const removeGlobalListener = realtimeTransport.addGlobalListener(applyGlobalRealtimeMessage);
    const removeStatusListener = realtimeTransport.addStatusListener(setIsConnected);
    return () => {
      removeGlobalListener();
      removeStatusListener();
    };
  }, []);

  return { isConnected };
}

export function useRealtimeSubscription(
  channel: string | null | undefined,
  onMessage: (message: RealtimeMessage) => void,
) {
  const callbackRef = useRef(onMessage);
  const [isConnected, setIsConnected] = useState(false);
  callbackRef.current = onMessage;

  useEffect(() => realtimeTransport.addStatusListener(setIsConnected), []);

  useEffect(() => {
    if (!channel) return;
    return realtimeTransport.subscribe(channel, (message) => callbackRef.current(message));
  }, [channel]);

  return { isConnected };
}

export function useRealtimeSubscriptions(
  channels: Array<string | null | undefined>,
  onMessage: (message: RealtimeMessage) => void,
) {
  const callbackRef = useRef(onMessage);
  const [isConnected, setIsConnected] = useState(false);
  callbackRef.current = onMessage;
  const normalizedChannels = Array.from(new Set(
    channels.map((channel) => String(channel || "").trim()).filter(Boolean),
  )).sort().slice(0, 100);
  const channelKey = normalizedChannels.join("\u0000");

  useEffect(() => realtimeTransport.addStatusListener(setIsConnected), []);

  useEffect(() => {
    const cleanups = normalizedChannels.map((channel) =>
      realtimeTransport.subscribe(channel, (message) => callbackRef.current(message)),
    );
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [channelKey]);

  return { isConnected };
}
