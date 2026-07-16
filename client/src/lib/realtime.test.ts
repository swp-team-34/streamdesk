import { describe, expect, it } from "vitest";
import {
  BoundedRealtimeEventIds,
  getRealtimeReconnectDelay,
  shouldRefetchDiscussion,
} from "./realtime";

describe("realtime client helpers", () => {
  it("uses bounded exponential reconnect delays", () => {
    expect(getRealtimeReconnectDelay(0)).toBe(1000);
    expect(getRealtimeReconnectDelay(1)).toBe(2000);
    expect(getRealtimeReconnectDelay(4)).toBe(15000);
    expect(getRealtimeReconnectDelay(20)).toBe(15000);
  });

  it("ignores duplicate event identifiers without unbounded memory growth", () => {
    const ids = new BoundedRealtimeEventIds(2);

    expect(ids.accept("event-1")).toBe(true);
    expect(ids.accept("event-1")).toBe(false);
    expect(ids.accept("event-2")).toBe(true);
    expect(ids.accept("event-3")).toBe(true);
    expect(ids.size).toBe(2);
    expect(ids.accept("event-1")).toBe(true);
  });

  it("refetches only the affected discussion and always refetches after reconnect", () => {
    const channel = "project:project-1:comments";

    expect(shouldRefetchDiscussion({ type: "realtime_reconnected" }, channel)).toBe(true);
    expect(shouldRefetchDiscussion({
      type: "discussion_event",
      channel,
      eventId: "event-1",
    }, channel)).toBe(true);
    expect(shouldRefetchDiscussion({
      type: "discussion_event",
      channel: "project:project-2:comments",
      eventId: "event-2",
    }, channel)).toBe(false);
  });
});
