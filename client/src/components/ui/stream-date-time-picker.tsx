import { useMemo, useState } from "react";
import { CalendarDays, Check, Clock, Globe2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  combineDateWithTime,
  formatDueDateLabel,
  toDateTimeLocalValue,
} from "@/lib/task-dates";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

interface StreamDateTimePickerProps {
  id?: string;
  label?: string;
  value?: string | null;
  disabled?: boolean;
  minValue?: string | null;
  allDay?: boolean;
  showAllDay?: boolean;
  timezoneLabel?: string;
  placeholder?: string;
  defaultTime?: string;
  onChange: (value: string) => void;
  onAllDayChange?: (value: boolean) => void;
}

const toValidDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeTimeValue = (value: string) => {
  const [rawHour = "09", rawMinute = "00"] = value.split(":");
  const hour = Math.min(23, Math.max(0, Number.parseInt(rawHour, 10) || 0));
  const minute = Math.floor(Math.min(59, Math.max(0, Number.parseInt(rawMinute, 10) || 0)) / 5) * 5;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export function StreamDateTimePicker({
  id,
  label,
  value,
  disabled,
  minValue,
  allDay = false,
  showAllDay = false,
  timezoneLabel = "Moscow, GMT+3",
  placeholder = "Выбрать дату и время",
  defaultTime = "09:00",
  onChange,
  onAllDayChange,
}: StreamDateTimePickerProps) {
  const selectedDate = toValidDate(value);
  const minDate = toValidDate(minValue);
  const [open, setOpen] = useState(false);

  const selectedTime = useMemo(() => {
    if (!selectedDate) return normalizeTimeValue(defaultTime);
    const minutes = Math.floor(selectedDate.getMinutes() / 5) * 5;
    return `${String(selectedDate.getHours()).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, [defaultTime, selectedDate]);
  const [selectedHour, selectedMinute] = selectedTime.split(":");

  const commit = (date: Date, time = selectedTime) => {
    const next = allDay ? combineDateWithTime(date, "00:00") : combineDateWithTime(date, time);
    onChange(toDateTimeLocalValue(next));
  };

  const handleDateSelect = (date?: Date) => {
    if (!date) return;
    commit(date);
  };

  const handleTimeChange = (time: string) => {
    commit(selectedDate || new Date(), time);
  };

  const handleHourChange = (hour: string) => {
    handleTimeChange(`${hour}:${selectedMinute}`);
  };

  const handleMinuteChange = (minute: string) => {
    handleTimeChange(`${selectedHour}:${minute}`);
  };

  const handleAllDayChange = (checked: boolean) => {
    onAllDayChange?.(checked);
    const sourceDate = selectedDate || new Date();
    onChange(toDateTimeLocalValue(combineDateWithTime(sourceDate, checked ? "00:00" : defaultTime)));
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground" htmlFor={id}>
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-10 w-full justify-start gap-2 rounded-xl border-border/35 bg-muted/20 text-left font-normal text-foreground hover:bg-accent/60 focus-visible:ring-ring"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
              {formatDueDateLabel(value) || placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[220] w-[min(92vw,360px)] rounded-2xl border-border/60 bg-popover p-3 shadow-2xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Дата</p>
                <p className="text-xs text-muted-foreground">
                  {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: ru }) : "Выбери день"}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-border/35 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" />
                {timezoneLabel}
              </div>
            </div>

            <Calendar
              mode="single"
              selected={selectedDate || undefined}
              onSelect={handleDateSelect}
              disabled={minDate ? { before: new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) } : undefined}
              initialFocus={false}
              className="rounded-xl border border-border/35 bg-card p-2"
            />

            <div className="grid gap-2 border-t border-border/35 pt-3">
              {showAllDay && (
                <label className="flex items-center gap-2 rounded-xl border border-border/35 bg-muted/30 px-3 py-2 text-sm">
                  <Checkbox checked={allDay} onCheckedChange={(checked) => handleAllDayChange(checked === true)} />
                  Весь день
                </label>
              )}

              {!allDay && (
                <label className="grid gap-1 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Время
                  </span>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <select
                      className="h-10 rounded-xl border border-border/35 bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      value={selectedHour}
                      onChange={(event) => handleHourChange(event.target.value)}
                      disabled={disabled}
                      aria-label="Часы"
                    >
                      {HOUR_OPTIONS.map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm font-semibold text-muted-foreground">:</span>
                    <select
                      className="h-10 rounded-xl border border-border/35 bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      value={selectedMinute}
                      onChange={(event) => handleMinuteChange(event.target.value)}
                      disabled={disabled}
                      aria-label="Минуты"
                    >
                      {MINUTE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              )}

              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" className="gap-2" disabled={disabled || !value} onClick={() => onChange("")}>
                  <Trash2 className="h-4 w-4" />
                  Очистить
                </Button>
                <Button type="button" size="sm" className="gap-2" onClick={() => setOpen(false)}>
                  <Check className="h-4 w-4" />
                  OK
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
