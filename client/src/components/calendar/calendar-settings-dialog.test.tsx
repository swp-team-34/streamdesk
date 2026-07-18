import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { CalendarSettingsDialog } from "./calendar-settings-dialog";
import { DEFAULT_CALENDAR_SETTINGS } from "@/lib/calendar-page-model";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";

describe("CalendarSettingsDialog", () => {
  it("updates controlled settings and closes from the primary action", () => {
    let settings = DEFAULT_CALENDAR_SETTINGS;
    const onOpenChange = vi.fn();
    const onSettingsChange = vi.fn((next) => {
      settings = typeof next === "function" ? next(settings) : next;
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { queryFn: async () => null, retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(["/api/calendar/event-types"], {
      eventTypes: [{ value: "stream", label: "Стрим" }],
      canManage: false,
      scope: "personal",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CalendarSettingsDialog
          open
          onOpenChange={onOpenChange}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </QueryClientProvider>,
    );

    chooseStreamSelectOption("Начало рабочего дня", "08:00");
    expect(settings.workdayStart).toBe(8);

    fireEvent.click(screen.getByText("Готово"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
