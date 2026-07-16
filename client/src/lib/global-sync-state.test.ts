import { describe, expect, it, vi } from "vitest";
import {
  GLOBAL_SYNC_EVENT,
  publishGlobalSyncState,
  type GlobalSyncDetail,
} from "./global-sync-state";

describe("publishGlobalSyncState", () => {
  it("publishes the source and current autosave state", () => {
    const listener = vi.fn();
    window.addEventListener(GLOBAL_SYNC_EVENT, listener);

    publishGlobalSyncState("equipment:eq-1", "syncing");

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<GlobalSyncDetail>;
    expect(event.detail).toMatchObject({
      source: "equipment:eq-1",
      status: "syncing",
    });
    expect(new Date(event.detail.occurredAt).toString()).not.toBe("Invalid Date");

    window.removeEventListener(GLOBAL_SYNC_EVENT, listener);
  });

  it("includes the autosave error for the global indicator", () => {
    const listener = vi.fn();
    window.addEventListener(GLOBAL_SYNC_EVENT, listener);

    publishGlobalSyncState("project:project-1", "error", "Network error");

    const event = listener.mock.calls[0][0] as CustomEvent<GlobalSyncDetail>;
    expect(event.detail.error).toBe("Network error");

    window.removeEventListener(GLOBAL_SYNC_EVENT, listener);
  });
});
