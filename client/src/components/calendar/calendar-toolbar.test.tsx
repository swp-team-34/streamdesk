import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarToolbar } from "./calendar-toolbar";

describe("CalendarToolbar", () => {
  afterEach(cleanup);

  it("keeps navigation, creation, settings and view selection controlled", () => {
    const onCreateEvent = vi.fn();
    const onShiftDate = vi.fn();
    const onToday = vi.fn();
    const onOpenSettings = vi.fn();
    const onDateSelect = vi.fn();
    const onViewModeChange = vi.fn();

    render(
      <CalendarToolbar
        periodLabel="13–19 июля"
        selectedDate={new Date(2026, 6, 17, 12)}
        viewMode="week"
        onCreateEvent={onCreateEvent}
        onShiftDate={onShiftDate}
        onToday={onToday}
        onOpenSettings={onOpenSettings}
        onDateSelect={onDateSelect}
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

  it("opens a date picker from the period label without changing the view mode", () => {
    const onDateSelect = vi.fn();
    const onViewModeChange = vi.fn();

    render(
      <CalendarToolbar
        periodLabel="13–19 июля"
        selectedDate={new Date(2026, 6, 17, 12)}
        viewMode="week"
        onCreateEvent={vi.fn()}
        onShiftDate={vi.fn()}
        onToday={vi.fn()}
        onOpenSettings={vi.fn()}
        onDateSelect={onDateSelect}
        onViewModeChange={onViewModeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Выбрать дату. 13–19 июля" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "20" }));

    expect(onDateSelect).toHaveBeenCalledOnce();
    expect(onDateSelect.mock.calls[0][0]).toEqual(expect.any(Date));
    expect(onDateSelect.mock.calls[0][0].getDate()).toBe(20);
    expect(onViewModeChange).not.toHaveBeenCalled();
  });
});
