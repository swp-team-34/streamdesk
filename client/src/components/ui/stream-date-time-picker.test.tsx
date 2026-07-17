import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StreamDateTimePicker } from "./stream-date-time-picker";

describe("StreamDateTimePicker", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterAll(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("returns an atomic all-day update and restores the previous time", () => {
    const onChange = vi.fn();
    const onAllDayChange = vi.fn();
    const { rerender } = render(
      <StreamDateTimePicker
        label="Дата старта"
        value="2026-07-17T14:00"
        allDay={false}
        showAllDay
        onChange={onChange}
        onAllDayChange={onAllDayChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /17.*14:00/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Весь день" }));

    expect(onAllDayChange).toHaveBeenLastCalledWith(true, "2026-07-17T00:00");
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <StreamDateTimePicker
        label="Дата старта"
        value="2026-07-17T00:00"
        allDay
        showAllDay
        onChange={onChange}
        onAllDayChange={onAllDayChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Весь день" }));

    expect(onAllDayChange).toHaveBeenLastCalledWith(false, "2026-07-17T14:00");
    expect(onChange).not.toHaveBeenCalled();
  });
});
