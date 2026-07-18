import { useMemo, useState } from "react";
import { Check, Palette } from "lucide-react";
import { normalizeHexColor } from "@shared/ui-accent";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StreamColorPreset {
  value: string;
  label: string;
}

interface StreamColorPickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  label?: string;
  disabled?: boolean;
  presets?: readonly StreamColorPreset[];
  className?: string;
}

const DEFAULT_COLOR = "#5E6AD2";
const DEFAULT_PRESETS: StreamColorPreset[] = [
  { value: "#5E6AD2", label: "Лавандовый" },
  { value: "#4F6BCE", label: "Синий" },
  { value: "#0F766E", label: "Бирюзовый" },
  { value: "#16A34A", label: "Зелёный" },
  { value: "#A65316", label: "Янтарный" },
  { value: "#DC2626", label: "Красный" },
  { value: "#A14F78", label: "Розовый" },
  { value: "#64748B", label: "Серый" },
];

interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}

const hexToHsl = (hex: string): HslColor => {
  const normalized = normalizeHexColor(hex) || DEFAULT_COLOR;
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    hue: Math.round(hue),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
};

const hslToHex = ({ hue, saturation, lightness }: HslColor) => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = Math.min(100, Math.max(0, saturation)) / 100;
  const normalizedLightness = Math.min(100, Math.max(0, lightness)) / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const segment = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs(segment % 2 - 1));
  const offset = normalizedLightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment < 1) [red, green] = [chroma, secondary];
  else if (segment < 2) [red, green] = [secondary, chroma];
  else if (segment < 3) [green, blue] = [chroma, secondary];
  else if (segment < 4) [green, blue] = [secondary, chroma];
  else if (segment < 5) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
};

export function StreamColorPicker({
  id,
  value,
  onChange,
  ariaLabel = "Выбрать цвет",
  label,
  disabled,
  presets = DEFAULT_PRESETS,
  className,
}: StreamColorPickerProps) {
  const [open, setOpen] = useState(false);
  const normalizedValue = normalizeHexColor(value) || DEFAULT_COLOR;
  const hsl = useMemo(() => hexToHsl(normalizedValue), [normalizedValue]);
  const updateChannel = (channel: keyof HslColor, nextValue: number) => {
    onChange(hslToHex({ ...hsl, [channel]: nextValue }));
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
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-control border-border/40 bg-surface-raised px-3 font-normal shadow-xs",
              className,
            )}
          >
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-black/15 shadow-xs"
              style={{ backgroundColor: normalizedValue }}
            />
            <span className="truncate">Настроить цвет</span>
            <Palette className="ml-auto h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[220] w-[min(92vw,320px)] rounded-dialog border-border/60 bg-popover p-4 shadow-overlay"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-4">
            <div
              className="h-16 rounded-control border border-black/10 shadow-inner"
              style={{ backgroundColor: normalizedValue }}
              aria-label="Предпросмотр цвета"
            />

            <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="Готовые цвета">
              {presets.map((preset) => {
                const normalizedPreset = normalizeHexColor(preset.value) || preset.value;
                const selected = normalizedPreset === normalizedValue;
                return (
                  <button
                    key={`${preset.value}-${preset.label}`}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={preset.label}
                    title={preset.label}
                    className="relative h-7 w-7 rounded-full border border-black/15 shadow-xs outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary/60"
                    style={{ backgroundColor: normalizedPreset }}
                    onClick={() => onChange(normalizedPreset)}
                  >
                    {selected && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>

            {([
              ["hue", "Оттенок", 0, 359],
              ["saturation", "Насыщенность", 0, 100],
              ["lightness", "Яркость", 10, 90],
            ] as const).map(([channel, channelLabel, min, max]) => (
              <label key={channel} className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="flex items-center justify-between gap-2">
                  {channelLabel}
                  <span>{hsl[channel]}{channel === "hue" ? "°" : "%"}</span>
                </span>
                <input
                  type="range"
                  aria-label={channelLabel}
                  min={min}
                  max={max}
                  value={hsl[channel]}
                  onChange={(event) => updateChannel(channel, Number(event.target.value))}
                  className={cn(
                    "h-2 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2",
                    channel === "hue" && "bg-[linear-gradient(to_right,#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)]",
                    channel !== "hue" && "bg-muted",
                  )}
                  style={{ accentColor: normalizedValue }}
                />
              </label>
            ))}

            <Button type="button" className="w-full" onClick={() => setOpen(false)}>
              Готово
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
