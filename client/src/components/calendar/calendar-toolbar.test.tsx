import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarToolbar } from "./calendar-toolbar";

describe("CalendarToolbar", () => {
  it("keeps navigation, creation, settings and view selection controlled", () => {
    const onCreateEvent = vi.fn();
    const onShiftDate = vi.fn();
    const onToday = vi.fn();
    const onOpenSettings = vi.fn();
    const onViewModeChange = vi.fn();

    render(
      <CalendarToolbar
        periodLabel="13–19 июля"
        viewMode="week"
        onCreateEvent={onCreateEvent}
        onShiftDate={onShiftDate}
        onToday={onToday}
        onOpenSettings={onOpenSettings}
        onViewModeChange={onViewModeChange}
      />,
    );

    fireEvent.click(screen.getByText("Событие"));
    fireEvent.click(screen.getByRole("button", { name: "Предыдущий период" }));
    fireEvent.click(screen.getByText("Сегодня"));
    fireEvent.click(screen.getByRole("button", { name: "Настройки календаря" }));
    fireEvent.click(screen.getByText("День"));

    expect(onCreateEvent).toHaveBeenCalledOnce();
    expect(onShiftDate).toHaveBeenCalledWith(-1);
    expect(onToday).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onViewModeChange).toHaveBeenCalledWith("day");
  });
});
