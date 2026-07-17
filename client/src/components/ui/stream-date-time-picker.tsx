import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, Clock, Globe2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StreamSelect } from "@/components/ui/stream-select";
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
  onAllDayChange?: (value: boolean, nextValue: string) => void;
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
  const lastTimedTimeRef = useRef(allDay ? normalizeTimeValue(defaultTime) : selectedTime);

  useEffect(() => {
    if (!allDay) lastTimedTimeRef.current = selectedTime;
  }, [allDay, selectedTime]);

  const commit = (date: Date, time = selectedTime) => {
    const next = allDay ? combineDateWithTime(date, "00:00") : combineDateWithTime(date, time);
    onChange(toDateTimeLocalValue(next));
  };

  const handleDateSelect = (date?: Date) => {
    if (!date) return;
    commit(date);
  };

  const handleTimeChange = (time: string) => {
    const normalizedTime = normalizeTimeValue(time);
    lastTimedTimeRef.current = normalizedTime;
    commit(selectedDate || new Date(), normalizedTime);
  };

  const handleHourChange = (hour: string) => {
    handleTimeChange(`${hour}:${selectedMinute}`);
  };

  const handleMinuteChange = (minute: string) => {
    handleTimeChange(`${selectedHour}:${minute}`);
  };

  const handleAllDayChange = (checked: boolean) => {
    const sourceDate = selectedDate || new Date();
    if (checked && !allDay) lastTimedTimeRef.current = selectedTime;
    const nextValue = toDateTimeLocalValue(combineDateWithTime(
      sourceDate,
      checked ? "00:00" : lastTimedTimeRef.current || normalizeTimeValue(defaultTime),
    ));
    if (onAllDayChange) {
      onAllDayChange(checked, nextValue);
      return;
    }
    onChange(nextValue);
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
            className="h-10 w-full justify-start gap-2 rounded-control border-border/50 bg-muted/20 text-left font-normal text-foreground hover:bg-accent/60 focus-visible:ring-ring"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
              {formatDueDateLabel(value) || placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[220] max-h-[min(calc(100dvh-1rem),640px)] w-[min(92vw,360px)] overflow-y-auto overscroll-contain rounded-dialog border-border/60 bg-popover p-3 shadow-overlay"
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
              className="rounded-surface border border-border/50 bg-card p-2"
            />

            <div className="grid gap-2 border-t border-border/35 pt-3">
              {showAllDay && (
                <label className="flex items-center gap-2 rounded-control border border-border/50 bg-muted/30 px-3 py-2 text-sm">
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
                    <StreamSelect
                      ariaLabel="Часы"
                      value={selectedHour}
                      options={HOUR_OPTIONS.map((hour) => ({ value: hour, label: hour }))}
                      onValueChange={handleHourChange}
                      disabled={disabled}
                      className="h-10 sm:h-10"
                      contentClassName="z-[240]"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">:</span>
                    <StreamSelect
                      ariaLabel="Минуты"
                      value={selectedMinute}
                      options={MINUTE_OPTIONS.map((minute) => ({ value: minute, label: minute }))}
                      onValueChange={handleMinuteChange}
                      disabled={disabled}
                      className="h-10 sm:h-10"
                      contentClassName="z-[240]"
                    />
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
