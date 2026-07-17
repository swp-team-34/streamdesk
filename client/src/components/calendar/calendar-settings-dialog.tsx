import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StreamSelect } from "@/components/ui/stream-select";
import {
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarSettings,
} from "@/lib/calendar-page-model";
import {
  createCalendarEventTypeValue,
  DEFAULT_CALENDAR_EVENT_TYPES,
  type CalendarEventType,
} from "@shared/calendar-event-types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EventTypeSettings {
  eventTypes: CalendarEventType[];
  canManage: boolean;
  scope: "company" | "personal";
}

export function CalendarSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CalendarSettings;
  onSettingsChange: Dispatch<SetStateAction<CalendarSettings>>;
}) {
  const { toast } = useToast();
  const [eventTypes, setEventTypes] = useState<CalendarEventType[]>(DEFAULT_CALENDAR_EVENT_TYPES);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const { data: eventTypeSettings } = useQuery<EventTypeSettings>({
    queryKey: ["/api/calendar/event-types"],
    enabled: open,
  });

  useEffect(() => {
    if (eventTypeSettings?.eventTypes?.length) setEventTypes(eventTypeSettings.eventTypes);
  }, [eventTypeSettings]);

  const saveEventTypesMutation = useMutation({
    mutationFn: async (nextEventTypes: CalendarEventType[]) => {
      const response = await apiRequest("PUT", "/api/calendar/event-types", { eventTypes: nextEventTypes });
      return response.json() as Promise<EventTypeSettings>;
    },
    onSuccess: (response) => {
      setEventTypes(response.eventTypes);
      queryClient.setQueryData(["/api/calendar/event-types"], response);
    },
    onError: (error: Error) => {
      setEventTypes(eventTypeSettings?.eventTypes || DEFAULT_CALENDAR_EVENT_TYPES);
      toast({
        title: "Не удалось сохранить типы событий",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const persistEventTypes = (nextEventTypes: CalendarEventType[]) => {
    setEventTypes(nextEventTypes);
    saveEventTypesMutation.mutate(nextEventTypes);
  };

  const addEventType = () => {
    const label = newTypeLabel.trim();
    if (!label || eventTypes.length >= 24) return;
    persistEventTypes([
      ...eventTypes,
      { value: createCalendarEventTypeValue(label, eventTypes), label },
    ]);
    setNewTypeLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки календаря</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Начало рабочего дня</span>
              <StreamSelect
                ariaLabel="Начало рабочего дня"
                value={String(settings.workdayStart)}
                options={Array.from({ length: 24 }, (_, hour) => ({
                  value: String(hour),
                  label: `${String(hour).padStart(2, "0")}:00`,
                }))}
                onValueChange={(value) => onSettingsChange((previous) => ({
                  ...previous,
                  workdayStart: Number(value),
                }))}
                className="h-9 sm:h-9"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Конец рабочего дня</span>
              <StreamSelect
                ariaLabel="Конец рабочего дня"
                value={String(settings.workdayEnd)}
                options={Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => ({
                  value: String(hour),
                  label: `${String(hour).padStart(2, "0")}:00`,
                }))}
                onValueChange={(value) => onSettingsChange((previous) => ({
                  ...previous,
                  workdayEnd: Number(value),
                }))}
                className="h-9 sm:h-9"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Шаг сетки</span>
            <StreamSelect
              ariaLabel="Шаг сетки"
              value={String(settings.gridStep)}
              options={[
                { value: "15", label: "15 минут" },
                { value: "30", label: "30 минут" },
                { value: "60", label: "60 минут" },
              ]}
              onValueChange={(value) => onSettingsChange((previous) => ({
                ...previous,
                gridStep: Number(value) as 15 | 30 | 60,
              }))}
              className="h-9 sm:h-9"
            />
          </label>

          <div className="grid gap-2 rounded-surface border border-border/50 bg-surface-subtle p-3">
            {([
              ["showWeekends", "Показывать выходные"],
              ["showAllDay", "Показывать all-day зону"],
              ["compactMode", "Компактный режим"],
            ] as const).map(([key, title]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm">
                <span>{title}</span>
                <Checkbox
                  checked={settings[key]}
                  onCheckedChange={(checked) => onSettingsChange((previous) => ({
                    ...previous,
                    [key]: checked === true,
                  }))}
                />
              </label>
            ))}
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Timezone label</span>
            <Input
              value={settings.timezoneLabel}
              onChange={(event) => onSettingsChange((previous) => ({
                ...previous,
                timezoneLabel: event.target.value,
              }))}
              className="h-9"
            />
          </label>

          <section className="grid gap-3 rounded-surface border border-border/50 bg-surface-subtle p-3">
            <div>
              <h3 className="text-sm font-medium">Типы событий</h3>
              <p className="text-xs text-muted-foreground">
                {eventTypeSettings?.scope === "company"
                  ? "Общий список для выбранной компании."
                  : "Личный список типов событий."}
              </p>
            </div>
            <div className="grid max-h-44 gap-1.5 overflow-y-auto pr-1">
              {eventTypes.map((eventType) => (
                <div
                  key={eventType.value}
                  className="flex min-h-9 items-center justify-between gap-2 rounded-control border border-border/40 bg-surface-raised px-3 py-1.5"
                >
                  <span className="min-w-0 truncate text-sm">{eventType.label}</span>
                  {Boolean(eventTypeSettings?.canManage) && eventTypes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Удалить тип ${eventType.label}`}
                      disabled={saveEventTypesMutation.isPending}
                      onClick={() => persistEventTypes(eventTypes.filter((item) => item.value !== eventType.value))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {Boolean(eventTypeSettings?.canManage) && (
              <div className="flex gap-2">
                <Input
                  value={newTypeLabel}
                  maxLength={64}
                  placeholder="Новый тип события"
                  onChange={(event) => setNewTypeLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addEventType();
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={!newTypeLabel.trim() || saveEventTypesMutation.isPending}
                  onClick={addEventType}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Добавить
                </Button>
              </div>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onSettingsChange(DEFAULT_CALENDAR_SETTINGS)}>
            Сбросить
          </Button>
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
