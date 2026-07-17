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
import { Input } from "@/components/ui/input";
import { StreamSelect } from "@/components/ui/stream-select";
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
              <StreamSelect
                ariaLabel="Начало рабочего дня"
                value={String(settings.workdayStart)}
                options={Array.from({ length: 24 }, (_, hour) => ({
                  value: String(hour),
                  label: `${String(hour).padStart(2, "0")}:00`,
                }))}
                onValueChange={(value) => onSettingsChange((previous) => ({
                  ...previous,
                  workdayStart: Number(value),
                }))}
                className="h-9 sm:h-9"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Конец рабочего дня</span>
              <StreamSelect
                ariaLabel="Конец рабочего дня"
                value={String(settings.workdayEnd)}
                options={Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => ({
                  value: String(hour),
                  label: `${String(hour).padStart(2, "0")}:00`,
                }))}
                onValueChange={(value) => onSettingsChange((previous) => ({
                  ...previous,
                  workdayEnd: Number(value),
                }))}
                className="h-9 sm:h-9"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Шаг сетки</span>
            <StreamSelect
              ariaLabel="Шаг сетки"
              value={String(settings.gridStep)}
              options={[
                { value: "15", label: "15 минут" },
                { value: "30", label: "30 минут" },
                { value: "60", label: "60 минут" },
              ]}
              onValueChange={(value) => onSettingsChange((previous) => ({
                ...previous,
                gridStep: Number(value) as 15 | 30 | 60,
              }))}
              className="h-9 sm:h-9"
            />
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
            <Input
              value={settings.timezoneLabel}
              onChange={(event) => onSettingsChange((previous) => ({
                ...previous,
                timezoneLabel: event.target.value,
              }))}
              className="h-9"
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
