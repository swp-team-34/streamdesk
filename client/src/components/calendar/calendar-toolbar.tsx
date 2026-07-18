import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Settings } from "lucide-react";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CalendarViewMode } from "@/lib/calendar-page-model";

const VIEW_MODE_LABELS: Record<CalendarViewMode, string> = {
  month: "Месяц",
  week: "Неделя",
  "3days": "3 дня",
  day: "День",
  list: "Список",
};

export function CalendarToolbar({
  periodLabel,
  selectedDate,
  viewMode,
  onCreateEvent,
  onShiftDate,
  onToday,
  onOpenSettings,
  onDateSelect,
  onViewModeChange,
}: {
  periodLabel: string;
  selectedDate: Date;
  viewMode: CalendarViewMode;
  onCreateEvent: () => void;
  onShiftDate: (direction: -1 | 1) => void;
  onToday: () => void;
  onOpenSettings: () => void;
  onDateSelect: (date: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div className="mb-3 flex w-full min-w-0 flex-col gap-2 border-b border-border/40 pb-3 xl:flex-row xl:items-center">
      <div className="flex min-w-0 items-center justify-between gap-2 xl:shrink-0">
        <h2 className="truncate text-base font-semibold text-foreground">Календарь</h2>
        <Button
          size="sm"
          className="shrink-0"
          onClick={onCreateEvent}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          <span>Событие</span>
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 xl:ml-2">
        <div className="flex shrink-0 items-center rounded-control border border-border/50 bg-surface-raised shadow-xs">
          <Button
            variant="ghost"
            size="icon"
            className="border-r border-border/40"
            onClick={() => onShiftDate(-1)}
            aria-label="Предыдущий период"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="min-w-[112px] rounded-none px-2 text-center text-xs font-medium text-foreground hover:bg-muted/55 sm:min-w-[150px] sm:text-sm"
                aria-label={`Выбрать дату. ${periodLabel}`}
              >
                <span className="max-w-[180px] truncate">{periodLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="z-[210] w-auto rounded-dialog border-border/60 bg-popover p-2 shadow-overlay"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <Calendar
                key={`${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
                mode="single"
                selected={selectedDate}
                defaultMonth={selectedDate}
                locale={ru}
                onSelect={(date) => {
                  if (!date) return;
                  onDateSelect(date);
                  setDatePickerOpen(false);
                }}
                initialFocus={false}
                className="rounded-surface bg-card p-2"
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="border-l border-border/40"
            onClick={() => onShiftDate(1)}
            aria-label="Следующий период"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onToday}>
          Сегодня
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onOpenSettings}
          title="Настройки календаря"
          aria-label="Настройки календаря"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      <div className="hide-scrollbar flex shrink-0 overflow-x-auto rounded-control border border-border/40 bg-surface-subtle p-0.5">
        {(["month", "week", "3days", "day", "list"] as const).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-8 shrink-0 border border-transparent px-2 text-[10px] sm:px-2.5 sm:text-xs",
              viewMode === mode && "border-border/50 bg-surface-raised text-foreground shadow-xs hover:bg-surface-raised",
            )}
            onClick={() => onViewModeChange(mode)}
          >
            {VIEW_MODE_LABELS[mode]}
          </Button>
        ))}
      </div>
    </div>
  );
}
