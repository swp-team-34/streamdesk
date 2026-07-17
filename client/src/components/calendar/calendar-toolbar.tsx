import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  viewMode,
  onCreateEvent,
  onShiftDate,
  onToday,
  onOpenSettings,
  onViewModeChange,
}: {
  periodLabel: string;
  viewMode: CalendarViewMode;
  onCreateEvent: () => void;
  onShiftDate: (direction: -1 | 1) => void;
  onToday: () => void;
  onOpenSettings: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}) {
  return (
    <div className="mb-3 flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="truncate text-base font-bold text-foreground sm:text-lg">Календарь</h2>
        <Button
          size="sm"
          className="h-8 shrink-0 rounded-lg bg-primary text-xs text-primary-foreground sm:order-3"
          onClick={onCreateEvent}
        >
          <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Событие</span>
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 rounded-lg border-border/35 p-0"
          onClick={() => onShiftDate(-1)}
        >
          ←
        </Button>
        <span className="min-w-[90px] truncate text-center text-xs font-medium text-foreground sm:min-w-[100px] sm:text-sm">
          {periodLabel}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 rounded-lg border-border/35 p-0"
          onClick={() => onShiftDate(1)}
        >
          →
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 rounded-lg border-border/35 text-xs"
        onClick={onToday}
      >
        Сегодня
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 shrink-0 rounded-lg border-border/35 text-xs sm:flex"
        onClick={onOpenSettings}
        title="Настройки календаря"
      >
        <Settings className="mr-1.5 h-4 w-4" />
        Настройки
      </Button>
      <div className="hide-scrollbar flex shrink-0 overflow-x-auto rounded-lg bg-muted/40 p-0.5">
        {(["month", "week", "3days", "day", "list"] as const).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 shrink-0 rounded-md border border-transparent px-2 text-[10px] sm:px-2.5 sm:text-xs",
              viewMode === mode && "border-primary/60 bg-primary text-primary-foreground shadow-sm",
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
