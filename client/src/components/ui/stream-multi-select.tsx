import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { StreamSelectOption } from "@/components/ui/stream-select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface StreamMultiSelectProps {
  id?: string;
  values: string[];
  options: StreamSelectOption[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  searchable?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxVisibleChips?: number;
  className?: string;
  contentClassName?: string;
}

export function StreamMultiSelect({
  id,
  values,
  options,
  onValuesChange,
  placeholder = "Ничего не выбрано",
  disabled,
  ariaLabel,
  title,
  searchable,
  searchThreshold = 10,
  searchPlaceholder = "Поиск…",
  emptyMessage = "Ничего не найдено",
  maxVisibleChips = 5,
  className,
  contentClassName,
}: StreamMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const normalizedValues = useMemo(() => values.map(String), [values]);
  const selected = useMemo(() => new Set(normalizedValues), [normalizedValues]);
  const selectedOptions = useMemo(() => normalizedValues.map((value) => (
    options.find((option) => option.value === value) ?? { value, label: value }
  )), [normalizedValues, options]);
  const useSearch = searchable ?? options.length > searchThreshold;

  const toggle = (value: string) => {
    if (selected.has(value)) {
      onValuesChange(normalizedValues.filter((current) => current !== value));
      return;
    }
    onValuesChange([...normalizedValues, value]);
  };

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "h-11 w-full justify-between rounded-control border-input/60 bg-surface-raised px-3 text-sm font-normal shadow-xs sm:h-9",
        selectedOptions.length === 0 && "text-muted-foreground",
        className,
      )}
    >
      <span className="min-w-0 truncate">
        {selectedOptions.length ? `Выбрано: ${selectedOptions.length}` : placeholder}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const optionList = (
    <Command>
      {useSearch && <CommandInput placeholder={searchPlaceholder} />}
      <CommandList className="max-h-[min(50dvh,320px)]">
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => {
            const isSelected = selected.has(option.value);
            return (
              <CommandItem
                key={option.value}
                value={[option.label, option.value, ...(option.keywords || [])].join(" ")}
                disabled={option.disabled}
                onSelect={() => toggle(option.value)}
                className="min-h-11"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{option.label}</p>
                  {option.description && (
                    <p className="truncate text-xs text-muted-foreground">{option.description}</p>
                  )}
                </div>
                <Check className={cn("ml-auto h-4 w-4 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const selectionChips = selectedOptions.length > 0 && (
    <div className="flex flex-wrap gap-1.5" aria-label="Выбранные значения">
      {selectedOptions.slice(0, maxVisibleChips).map((option) => (
        <Badge key={option.value} variant="secondary" className="max-w-full gap-1 rounded-full">
          <span className="truncate">{option.label}</span>
          {!disabled && (
            <button
              type="button"
              aria-label={`Убрать ${option.label}`}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              onClick={() => toggle(option.value)}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {selectedOptions.length > maxVisibleChips && (
        <Badge variant="outline" className="rounded-full">
          +{selectedOptions.length - maxVisibleChips}
        </Badge>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {isMobile && useSearch ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            overlayClassName="z-[230] bg-black/55 backdrop-blur-[2px]"
            className="z-[240] max-h-[82dvh] rounded-t-dialog border-border/60 bg-popover p-0 shadow-overlay"
          >
            <SheetHeader className="border-b border-border/50 px-4 py-3 text-left">
              <SheetTitle className="text-base">{title || ariaLabel || placeholder}</SheetTitle>
            </SheetHeader>
            {optionList}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(
              "z-[220] w-[var(--radix-popover-trigger-width)] min-w-56 rounded-control border-border/60 bg-popover p-0 shadow-overlay",
              contentClassName,
            )}
          >
            {optionList}
          </PopoverContent>
        </Popover>
      )}
      {selectionChips}
    </div>
  );
}
