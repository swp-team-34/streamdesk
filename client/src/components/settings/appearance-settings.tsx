import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  Coffee,
  Contrast,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sun,
} from "lucide-react";
import { analyzeUiAccent, normalizeHexColor } from "@shared/ui-accent";
import {
  DEFAULT_USER_UI_PREFERENCES,
  type UiThemeMode,
  type UserUiPreferences,
} from "@shared/ui-preferences";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StreamColorPicker } from "@/components/ui/stream-color-picker";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: Array<{
  value: UiThemeMode;
  label: string;
  description: string;
  icon: typeof Monitor;
}> = [
  { value: "system", label: "Системная", description: "Следует настройке устройства", icon: Monitor },
  { value: "light", label: "Светлая", description: "Тёплая и спокойная, как Notion", icon: Sun },
  { value: "dark", label: "Тёмная", description: "Плотная палитра Linear", icon: Moon },
  { value: "warm", label: "Тёплая", description: "Мягче для продолжительной работы", icon: Coffee },
  { value: "high-contrast", label: "Контрастная", description: "Более чёткие границы и focus", icon: Contrast },
  { value: "sepia", label: "Сепия", description: "Спокойный бумажный оттенок", icon: BookOpen },
];

const ACCENT_PRESETS = [
  { value: "#5E6AD2", label: "Linear lavender" },
  { value: "#4F6BCE", label: "Calm blue" },
  { value: "#0F766E", label: "Deep teal" },
  { value: "#A14F78", label: "Muted berry" },
  { value: "#A65316", label: "Warm amber" },
].filter((preset) => analyzeUiAccent(preset.value).valid);

export function AppearanceSettings() {
  const {
    savedPreferences,
    previewPreferences,
    clearPreferencesPreview,
    savePreferences,
    isHydratingPreferences,
    isSavingPreferences,
    preferencesError,
  } = useTheme();
  const { toast } = useToast();
  const [draft, setDraft] = useState<UserUiPreferences>(savedPreferences);
  const [accentInput, setAccentInput] = useState(savedPreferences.accent);

  useEffect(() => {
    setDraft(savedPreferences);
    setAccentInput(savedPreferences.accent);
  }, [savedPreferences]);

  useEffect(() => () => clearPreferencesPreview(), [clearPreferencesPreview]);

  const normalizedAccent = normalizeHexColor(accentInput);
  const accentAnalysis = useMemo(
    () => normalizedAccent ? analyzeUiAccent(normalizedAccent) : null,
    [normalizedAccent],
  );
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedPreferences)
    || Boolean(normalizedAccent && normalizedAccent !== normalizeHexColor(savedPreferences.accent));
  const canSave = Boolean(accentAnalysis?.valid) && !isHydratingPreferences && !isSavingPreferences;

  const updateDraft = (next: UserUiPreferences) => {
    setDraft(next);
    const analysis = analyzeUiAccent(next.accent);
    if (analysis.valid) previewPreferences(next);
  };

  const updateAccent = (value: string) => {
    setAccentInput(value);
    const normalized = normalizeHexColor(value);
    if (!normalized) return;
    const analysis = analyzeUiAccent(normalized);
    if (analysis.valid) updateDraft({ ...draft, accent: analysis.normalized });
  };

  const handleSave = async () => {
    if (!accentAnalysis?.valid) return;
    const saved = await savePreferences({ ...draft, accent: accentAnalysis.normalized });
    toast(saved
      ? { title: "Настройки интерфейса сохранены" }
      : { title: "Не удалось сохранить настройки", description: preferencesError || undefined, variant: "destructive" });
  };

  const handleCancel = () => {
    clearPreferencesPreview();
    setDraft(savedPreferences);
    setAccentInput(savedPreferences.accent);
  };

  const handleReset = () => {
    const reset = {
      ...DEFAULT_USER_UI_PREFERENCES,
      sidebarCollapsed: savedPreferences.sidebarCollapsed,
    };
    setAccentInput(reset.accent);
    updateDraft(reset);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Внешний вид
        </CardTitle>
        <CardDescription>
          Настройки сохраняются в профиле и синхронизируются между устройствами.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-4 sm:p-6">
        <section className="space-y-3" aria-labelledby="theme-mode-label">
          <div>
            <Label id="theme-mode-label" className="text-sm font-semibold">Режим темы</Label>
            <p className="mt-1 text-sm text-muted-foreground">Предпросмотр применяется сразу и сохраняется только после подтверждения.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-labelledby="theme-mode-label">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = draft.theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    "group flex min-h-[76px] items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/60",
                  )}
                  onClick={() => updateDraft({ ...draft, theme: option.value })}
                >
                  <span className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                    selected ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground",
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {option.label}
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </span>
                    <span className="mt-1 block text-xs leading-4 text-muted-foreground">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/25 p-4">
          <div>
            <Label htmlFor="auto-theme" className="flex items-center gap-2 font-medium">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              Автоматически по времени
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">Светлая с 06:00 до 20:00, тёмная в остальное время.</p>
          </div>
          <Switch
            id="auto-theme"
            checked={draft.autoTheme}
            onCheckedChange={(checked) => updateDraft({ ...draft, autoTheme: checked })}
          />
        </section>

        <section className="space-y-4" aria-labelledby="accent-label">
          <div>
            <Label id="accent-label" className="text-sm font-semibold">Основной акцент</Label>
            <p className="mt-1 text-sm text-muted-foreground">Цвет проверяется для светлой и тёмной темы по WCAG.</p>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="accent-label">
            {ACCENT_PRESETS.map((preset) => {
              const selected = draft.accent.toUpperCase() === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={preset.label}
                  title={preset.label}
                  className={cn(
                    "relative h-10 w-10 rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected ? "border-foreground" : "border-background shadow-[0_0_0_1px_hsl(var(--app-border)/0.7)]",
                  )}
                  style={{ backgroundColor: preset.value }}
                  onClick={() => {
                    setAccentInput(preset.value);
                    updateDraft({ ...draft, accent: preset.value });
                  }}
                >
                  {selected && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_1fr] sm:items-start">
            <StreamColorPicker
              value={normalizedAccent || DEFAULT_USER_UI_PREFERENCES.accent}
              onChange={updateAccent}
              ariaLabel="Выбрать собственный акцент"
              presets={ACCENT_PRESETS}
            />
            {accentAnalysis && !accentAnalysis.valid && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="text-foreground">Этот оттенок недостаточно контрастный.</p>
                <Button
                  type="button"
                  variant="link"
                  className="mt-1 h-auto p-0"
                  onClick={() => updateAccent(accentAnalysis.suggestion)}
                >
                  Использовать ближайший доступный {accentAnalysis.suggestion}
                </Button>
              </div>
            )}
          </div>
        </section>

        {preferencesError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {preferencesError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleReset} disabled={isSavingPreferences}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Сбросить тему
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={!hasChanges || isSavingPreferences}>
              Отмена
            </Button>
            <Button type="button" onClick={handleSave} disabled={!hasChanges || !canSave}>
              {isSavingPreferences ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Сохранить
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
