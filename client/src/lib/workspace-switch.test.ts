import { describe, expect, it, vi } from "vitest";
import {
  flushWorkspaceChanges,
  registerWorkspaceFlushHandler,
} from "./workspace-switch";

describe("workspace switch flush registry", () => {
  it("flushes every registered autosave before allowing a switch", async () => {
    const first = vi.fn().mockResolvedValue(true);
    const second = vi.fn().mockResolvedValue(true);
    const unregisterFirst = registerWorkspaceFlushHandler(first);
    const unregisterSecond = registerWorkspaceFlushHandler(second);

    await expect(flushWorkspaceChanges()).resolves.toBe(true);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    unregisterFirst();
    unregisterSecond();
  });

  it("blocks the switch when an editor cannot flush its state", async () => {
    const failing = vi.fn().mockResolvedValue(false);
    const afterFailure = vi.fn().mockResolvedValue(true);
    const unregisterFailing = registerWorkspaceFlushHandler(failing);
    const unregisterAfterFailure = registerWorkspaceFlushHandler(afterFailure);

    await expect(flushWorkspaceChanges()).resolves.toBe(false);
    expect(failing).toHaveBeenCalledOnce();
    expect(afterFailure).not.toHaveBeenCalled();

    unregisterFailing();
    unregisterAfterFailure();
  });
});
