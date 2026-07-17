import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ProjectEditForm } from "./project-edit-form";

const mocks = vi.hoisted(() => ({ flush: vi.fn() }));

vi.mock("@/hooks/use-debounced-autosave", () => ({
  useDebouncedAutosave: () => ({
    status: "idle",
    error: null,
    flush: mocks.flush,
  }),
}));

describe("ProjectEditForm", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterAll(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("keeps editor state controlled and flushes before closing", async () => {
    mocks.flush.mockReset();
    mocks.flush.mockResolvedValue(true);
    const onClose = vi.fn();
    const closeHandlerRef = createRef<(() => Promise<void>) | null>();
    render(
      <ProjectEditForm
        project={{ id: "project-1", name: "Launch", participants: ["user-1"] }}
        users={[{ id: "user-1", name: "Tim" }]}
        locations={[{ id: "location-1", name: "Studio A" }]}
        onClose={onClose}
        closeHandlerRef={closeHandlerRef}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Launch"), { target: { value: "Launch updated" } });
    expect(screen.getByDisplayValue("Launch updated")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    await waitFor(() => expect(mocks.flush).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
    expect(closeHandlerRef.current).toBeTypeOf("function");
  });
});
