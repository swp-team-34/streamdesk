import { describe, expect, it } from "vitest";
import {
  createDiscussionRealtimeEvent,
  normalizeRealtimeChannels,
  parseRealtimeChannel,
} from "./realtime";

describe("realtime protocol helpers", () => {
  it("accepts only supported scoped channels", () => {
    expect(parseRealtimeChannel("project:project-1:comments")).toMatchObject({
      scope: "project",
      recordId: "project-1",
      topic: "comments",
    });
    expect(parseRealtimeChannel("kanban-card:card-1:comments")).toMatchObject({
      scope: "kanban-card",
      recordId: "card-1",
    });
    expect(parseRealtimeChannel("location:location-1:topics")).toMatchObject({
      scope: "location",
      topic: "topics",
    });
    expect(parseRealtimeChannel("project:project-1:topics")).toBeNull();
    expect(parseRealtimeChannel("unknown:record:comments")).toBeNull();
  });

  it("deduplicates and bounds requested subscriptions", () => {
    expect(normalizeRealtimeChannels([
      "project:one:comments",
      "project:one:comments",
      "project:two:comments",
    ], 1)).toEqual(["project:one:comments"]);
  });

  it("publishes stable identifiers and version metadata without comment contents", () => {
    const event = createDiscussionRealtimeEvent({
      channel: "project:project-1:comments",
      action: "created",
      recordId: "comment-1",
      version: "2026-07-16T10:00:00.000Z",
    });

    expect(event).toMatchObject({
      type: "discussion_event",
      channel: "project:project-1:comments",
      action: "created",
      recordId: "comment-1",
      version: "2026-07-16T10:00:00.000Z",
    });
    expect(event.eventId).toBeTruthy();
    expect(event).not.toHaveProperty("content");
    expect(event).not.toHaveProperty("authorName");
  });
});
