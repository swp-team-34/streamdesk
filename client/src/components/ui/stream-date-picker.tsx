import { useState } from "react";
import { CalendarDays, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface StreamDatePickerProps {
  id?: string;
  label?: string;
  value?: string | null;
  disabled?: boolean;
  minValue?: string | null;
  maxValue?: string | null;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

const parseDateValue = (value?: string | null) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function StreamDatePicker({
  id,
  label,
  value,
  disabled,
  minValue,
  maxValue,
  placeholder = "Выбрать дату",
  onChange,
  className,
}: StreamDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);
  const minDate = parseDateValue(minValue);
  const maxDate = parseDateValue(maxValue);
  const disabledRange = minDate && maxDate
    ? [{ before: minDate }, { after: maxDate }]
    : minDate
      ? { before: minDate }
      : maxDate
        ? { after: maxDate }
        : undefined;

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground" htmlFor={id}>{label}</label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-control border-border/40 bg-surface-raised px-3 text-left font-normal shadow-xs",
              !selectedDate && "text-muted-foreground",
              className,
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">
              {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: ru }) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[220] w-[min(92vw,340px)] rounded-dialog border-border/60 bg-popover p-3 shadow-overlay"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-3">
            <Calendar
              mode="single"
              selected={selectedDate || undefined}
              onSelect={(date) => {
                if (date) onChange(format(date, "yyyy-MM-dd"));
              }}
              disabled={disabledRange}
              initialFocus={false}
              className="rounded-control border border-border/35 bg-card p-2"
            />
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
