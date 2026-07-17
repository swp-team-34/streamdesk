import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarSettingsDialog } from "./calendar-settings-dialog";
import { DEFAULT_CALENDAR_SETTINGS } from "@/lib/calendar-page-model";

describe("CalendarSettingsDialog", () => {
  it("updates controlled settings and closes from the primary action", () => {
    let settings = DEFAULT_CALENDAR_SETTINGS;
    const onOpenChange = vi.fn();
    const onSettingsChange = vi.fn((next) => {
      settings = typeof next === "function" ? next(settings) : next;
    });

    render(
      <CalendarSettingsDialog
        open
        onOpenChange={onOpenChange}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Начало рабочего дня"), { target: { value: "8" } });
    expect(settings.workdayStart).toBe(8);

    fireEvent.click(screen.getByText("Готово"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
