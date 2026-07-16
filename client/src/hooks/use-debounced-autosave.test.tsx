import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedAutosave } from "./use-debounced-autosave";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedAutosave", () => {
  it("debounces a valid change and marks it as saved", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ name }) => useDebouncedAutosave({
        enabled: true,
        resetKey: "project-1",
        source: "project:project-1",
        value: { name },
        validate: (value) => value.name.trim()
          ? { ok: true as const, payload: value }
          : { ok: false as const, error: "Введите название" },
        save,
      }),
      { initialProps: { name: "Initial" } },
    );

    expect(result.current.status).toBe("saved");
    rerender({ name: "Updated" });
    expect(result.current.status).toBe("dirty");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ name: "Updated" });
    expect(result.current.status).toBe("saved");
  });

  it("does not send invalid data and refuses to flush it", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ name }) => useDebouncedAutosave({
        enabled: true,
        resetKey: "equipment-1",
        source: "equipment:equipment-1",
        value: { name },
        validate: (value) => value.name.trim()
          ? { ok: true as const, payload: value }
          : { ok: false as const, error: "Введите название оборудования" },
        save,
      }),
      { initialProps: { name: "Camera" } },
    );

    rerender({ name: "" });
    expect(result.current.status).toBe("dirty");
    expect(result.current.error).toBe("Введите название оборудования");

    let flushed = true;
    await act(async () => {
      flushed = await result.current.flush();
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(flushed).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it("flushes a pending valid change before the editor closes", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ notes }) => useDebouncedAutosave({
        enabled: true,
        resetKey: "equipment-note-1",
        source: "equipment-note:equipment-1",
        value: { notes },
        validate: (value) => ({ ok: true as const, payload: value }),
        save,
      }),
      { initialProps: { notes: "Old" } },
    );

    rerender({ notes: "Latest note" });

    let flushed = false;
    await act(async () => {
      flushed = await result.current.flush();
    });

    expect(flushed).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ notes: "Latest note" });
    expect(result.current.status).toBe("saved");
  });

  it("saves the latest snapshot after an earlier request finishes", async () => {
    vi.useFakeTimers();
    let resolveFirstSave: (() => void) | undefined;
    const firstSave = new Promise<void>((resolve) => {
      resolveFirstSave = resolve;
    });
    const save = vi.fn(({ name }: { name: string }) =>
      name === "First change" ? firstSave : Promise.resolve(),
    );
    const { result, rerender } = renderHook(
      ({ name }) => useDebouncedAutosave({
        enabled: true,
        resetKey: "project-2",
        source: "project:project-2",
        value: { name },
        validate: (value) => ({ ok: true as const, payload: value }),
        save,
      }),
      { initialProps: { name: "Initial" } },
    );

    rerender({ name: "First change" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledWith({ name: "First change" });

    rerender({ name: "Latest change" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstSave?.();
      await firstSave;
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ name: "Latest change" });
    expect(result.current.status).toBe("saved");
  });
});
