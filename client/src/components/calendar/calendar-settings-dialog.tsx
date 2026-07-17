import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarSettings,
} from "@/lib/calendar-page-model";

export function CalendarSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CalendarSettings;
  onSettingsChange: Dispatch<SetStateAction<CalendarSettings>>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки календаря</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Начало рабочего дня</span>
              <select
                className="h-9 rounded-control border border-input/60 bg-surface-raised px-3 text-foreground shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                value={settings.workdayStart}
                onChange={(event) => onSettingsChange((previous) => ({
                  ...previous,
                  workdayStart: Number(event.target.value),
                }))}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Конец рабочего дня</span>
              <select
                className="h-9 rounded-control border border-input/60 bg-surface-raised px-3 text-foreground shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                value={settings.workdayEnd}
                onChange={(event) => onSettingsChange((previous) => ({
                  ...previous,
                  workdayEnd: Number(event.target.value),
                }))}
              >
                {Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Шаг сетки</span>
            <select
              className="h-9 rounded-control border border-input/60 bg-surface-raised px-3 text-foreground shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={settings.gridStep}
              onChange={(event) => onSettingsChange((previous) => ({
                ...previous,
                gridStep: Number(event.target.value) as 15 | 30 | 60,
              }))}
            >
              <option value={15}>15 минут</option>
              <option value={30}>30 минут</option>
              <option value={60}>60 минут</option>
            </select>
          </label>

          <div className="grid gap-2 rounded-surface border border-border/50 bg-surface-subtle p-3">
            {([
              ["showWeekends", "Показывать выходные"],
              ["showAllDay", "Показывать all-day зону"],
              ["compactMode", "Компактный режим"],
            ] as const).map(([key, title]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm">
                <span>{title}</span>
                <Checkbox
                  checked={settings[key]}
                  onCheckedChange={(checked) => onSettingsChange((previous) => ({
                    ...previous,
                    [key]: checked === true,
                  }))}
                />
              </label>
            ))}
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Timezone label</span>
            <input
              className="h-9 rounded-control border border-input/60 bg-surface-raised px-3 text-foreground shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={settings.timezoneLabel}
              onChange={(event) => onSettingsChange((previous) => ({
                ...previous,
                timezoneLabel: event.target.value,
              }))}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onSettingsChange(DEFAULT_CALENDAR_SETTINGS)}>
            Сбросить
          </Button>
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
