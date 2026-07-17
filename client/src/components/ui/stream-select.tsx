import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface StreamSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  keywords?: string[];
}

interface StreamSelectProps {
  id?: string;
  value?: string | null;
  options: StreamSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  searchable?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  contentClassName?: string;
}

export function StreamSelect({
  id,
  value,
  options,
  onValueChange,
  placeholder = "Выбрать",
  disabled,
  ariaLabel,
  title,
  searchable,
  searchThreshold = 10,
  searchPlaceholder = "Поиск…",
  emptyMessage = "Ничего не найдено",
  className,
  contentClassName,
}: StreamSelectProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const currentValue = value ?? "";
  const selectedOption = useMemo(
    () => options.find((option) => option.value === currentValue),
    [currentValue, options],
  );
  const useSearch = searchable ?? options.length > searchThreshold;

  const choose = (nextValue: string) => {
    if (nextValue !== currentValue) onValueChange(nextValue);
    setOpen(false);
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
        !selectedOption && "text-muted-foreground",
        className,
      )}
    >
      <span className="min-w-0 truncate">{selectedOption?.label || placeholder}</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const optionList = (
    <Command>
      {useSearch && <CommandInput placeholder={searchPlaceholder} />}
      <CommandList className="max-h-[min(50dvh,320px)]">
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => (
            <CommandItem
              key={option.value || "__empty__"}
              value={[option.label, option.value, ...(option.keywords || [])].join(" ")}
              disabled={option.disabled}
              onSelect={() => choose(option.value)}
              className="min-h-11"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">{option.label}</p>
                {option.description && (
                  <p className="truncate text-xs text-muted-foreground">{option.description}</p>
                )}
              </div>
              <Check className={cn("ml-auto h-4 w-4 text-primary", currentValue === option.value ? "opacity-100" : "opacity-0")} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  if (isMobile && useSearch) {
    return (
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
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("z-[220] w-[var(--radix-popover-trigger-width)] min-w-56 rounded-control border-border/60 bg-popover p-0 shadow-overlay", contentClassName)}
      >
        {optionList}
      </PopoverContent>
    </Popover>
  );
}
