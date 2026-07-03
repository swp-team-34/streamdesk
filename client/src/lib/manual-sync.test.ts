import { describe, expect, it, vi } from "vitest";
import { MANUAL_SYNC_QUERY_KEYS, runManualSync } from "./manual-sync";

describe("runManualSync", () => {
  it("invalidates and refetches scoped workspace query keys", async () => {
    const client = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      refetchQueries: vi.fn().mockResolvedValue(undefined),
    };

    await runManualSync(client, 100);

    expect(client.invalidateQueries).toHaveBeenCalledTimes(MANUAL_SYNC_QUERY_KEYS.length);
    expect(client.refetchQueries).toHaveBeenCalledTimes(MANUAL_SYNC_QUERY_KEYS.length);
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/equipment"] });
    expect(client.refetchQueries).toHaveBeenCalledWith({ queryKey: ["/api/equipment"], type: "active" });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["kanban-cards"] });
    expect(client.refetchQueries).toHaveBeenCalledWith({ queryKey: ["kanban-cards"], type: "active" });
  });

  it("rejects when active refetches do not settle before the timeout", async () => {
    vi.useFakeTimers();
    const client = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      refetchQueries: vi.fn().mockReturnValue(new Promise(() => undefined)),
    };

    const syncExpectation = expect(runManualSync(client, 50)).rejects.toThrow("Manual sync timed out");
    await vi.advanceTimersByTimeAsync(50);

    await syncExpectation;
    vi.useRealTimers();
  });
});
