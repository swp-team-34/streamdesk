import { useMemo, useState } from "react";
import { Check, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StreamSelect } from "@/components/ui/stream-select";
import { cn } from "@/lib/utils";

interface StreamTimePickerProps {
  id?: string;
  label?: string;
  value?: string | null;
  disabled?: boolean;
  placeholder?: string;
  minuteStep?: 1 | 5 | 10 | 15 | 30;
  onChange: (value: string) => void;
  className?: string;
}

const normalizeTime = (value?: string | null, minuteStep = 5) => {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.floor(Math.min(59, Math.max(0, Number(match[2]))) / minuteStep) * minuteStep;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export function StreamTimePicker({
  id,
  label,
  value,
  disabled,
  placeholder = "Выбрать время",
  minuteStep = 5,
  onChange,
  className,
}: StreamTimePickerProps) {
  const [open, setOpen] = useState(false);
  const normalizedValue = normalizeTime(value, minuteStep);
  const [hour = "09", minute = "00"] = (normalizedValue || "09:00").split(":");
  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, index) => {
    const nextHour = String(index).padStart(2, "0");
    return { value: nextHour, label: nextHour };
  }), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 / minuteStep }, (_, index) => {
    const nextMinute = String(index * minuteStep).padStart(2, "0");
    return { value: nextMinute, label: nextMinute };
  }), [minuteStep]);

  const commit = (nextHour: string, nextMinute: string) => {
    onChange(`${nextHour}:${nextMinute}`);
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-foreground" htmlFor={id}>{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-control border-border/40 bg-surface-raised px-3 text-left font-normal shadow-xs",
              !normalizedValue && "text-muted-foreground",
              className,
            )}
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span className="truncate">{normalizedValue || placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[220] w-[min(92vw,260px)] rounded-dialog border-border/60 bg-popover p-3 shadow-overlay"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <StreamSelect
                ariaLabel="Часы"
                value={hour}
                options={hourOptions}
                onValueChange={(nextHour) => commit(nextHour, minute)}
                className="h-10 sm:h-10"
              />
              <span className="font-semibold text-muted-foreground">:</span>
              <StreamSelect
                ariaLabel="Минуты"
                value={minute}
                options={minuteOptions}
                onValueChange={(nextMinute) => commit(hour, nextMinute)}
                className="h-10 sm:h-10"
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border/35 pt-3">
              <Button type="button" variant="ghost" size="sm" className="gap-2" disabled={disabled || !value} onClick={() => onChange("")}>
                <Trash2 className="h-4 w-4" />
                Очистить
              </Button>
              <Button type="button" size="sm" className="gap-2" onClick={() => setOpen(false)}>
                <Check className="h-4 w-4" />
                Готово
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
