import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StreamColorPicker } from "@/components/ui/stream-color-picker";
import { StreamDateTimePicker } from "@/components/ui/stream-date-time-picker";
import { StreamMultiSelect } from "@/components/ui/stream-multi-select";
import { StreamSelect } from "@/components/ui/stream-select";
import { insertEventSchema } from "@shared/schema";
import {
  DEFAULT_CALENDAR_EVENT_TYPES,
  type CalendarEventType,
} from "@shared/calendar-event-types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AuthService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState, useEffect, useRef } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { combineDateWithTime, normalizeDateRange, toDateTimeLocalValue } from "@/lib/task-dates";

const eventFormSchema = insertEventSchema.extend({
  startTime: z.string(),
  endTime: z.string(),
}).refine((data) => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime();
}, {
  message: "Окончание должно быть позже начала",
  path: ["endTime"],
});

const DEFAULT_EVENT_DURATION_MINUTES = 60;
const EVENT_AUTOSAVE_DELAY_MS = 650;
const EVENT_COLOR_STORAGE_KEY = "streamdesk_event_colors_v1";
const EVENT_COLOR_OPTIONS = [
  { value: "#a855f7", label: "Фиолетовый" },
  { value: "#0ea5e9", label: "Голубой" },
  { value: "#10b981", label: "Зеленый" },
  { value: "#f59e0b", label: "Янтарный" },
  { value: "#f43f5e", label: "Розовый" },
  { value: "#64748b", label: "Серый" },
];

const toLocalDateTime = (value: Date) => format(value, "yyyy-MM-dd'T'HH:mm");

const isFullDayRange = (start?: string | Date | null, end?: string | Date | null) => {
  if (!start || !end) return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
  return startDate.getHours() === 0 && startDate.getMinutes() === 0 && endDate.getHours() >= 23 && endDate.getMinutes() >= 45;
};

const readEventColorMap = () => {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EVENT_COLOR_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
};

const getStoredEventColor = (eventId?: string | null) => {
  if (!eventId) return EVENT_COLOR_OPTIONS[0].value;
  return readEventColorMap()[String(eventId)] || EVENT_COLOR_OPTIONS[0].value;
};

const storeEventColor = (eventId: string | undefined, color: string) => {
  if (!eventId || typeof window === "undefined") return;
  const colors = readEventColorMap();
  window.localStorage.setItem(EVENT_COLOR_STORAGE_KEY, JSON.stringify({ ...colors, [eventId]: color }));
};

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any;
  selectedDate?: Date;
}

interface User {
  id: string;
  name: string;
  email: string;
  position: string;
  department: string;
}

interface KanbanBoardOption {
  id: string;
  name: string;
  description?: string | null;
  canEdit?: boolean;
}

interface KanbanListOption {
  id: string;
  boardId: string;
  name: string;
  type?: string;
}

interface LocationOption {
  id: string;
  name: string;
  status?: string | null;
  archivedAt?: string | null;
}

interface EventTypeSettings {
  eventTypes: CalendarEventType[];
  canManage: boolean;
  scope: "company" | "personal";
}

export function EventForm({ isOpen, onClose, event, selectedDate }: EventFormProps) {
  const fallbackStart = useMemo(
    () => selectedDate ? combineDateWithTime(selectedDate, "09:00") : combineDateWithTime(new Date(), "09:00"),
    [selectedDate],
  );
  const initialRange = normalizeDateRange(
    event?.startTime ? new Date(event.startTime) : fallbackStart,
    event?.endTime ? new Date(event.endTime) : new Date(fallbackStart.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000),
    DEFAULT_EVENT_DURATION_MINUTES,
  );
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(() => {
    const p = event?.participants;
    if (!p || !Array.isArray(p)) return [];
    return p.map((x: any) => (typeof x === "string" ? x : x.userId)).filter(Boolean);
  });
  const [useCustomLocation, setUseCustomLocation] = useState(!!event?.customLocation);
  const [allDay, setAllDay] = useState(() => isFullDayRange(initialRange.start, initialRange.end));
  const [formMode, setFormMode] = useState<"event" | "kanban">("event");
  const [selectedKanbanBoardId, setSelectedKanbanBoardId] = useState("");
  const [selectedKanbanListId, setSelectedKanbanListId] = useState("");
  const [eventColor, setEventColor] = useState(() => event?.color || getStoredEventColor(event?.id));
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [autosaveError, setAutosaveError] = useState("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveSignatureRef = useRef("");
  const { toast } = useToast();

  useEffect(() => {
    const p = event?.participants;
    if (event?.id) setFormMode("event");
    setEventColor(event?.color || getStoredEventColor(event?.id));
    if (!p || !Array.isArray(p)) {
      setSelectedParticipants([]);
      return;
    }
    setSelectedParticipants(p.map((x: any) => (typeof x === "string" ? x : x.userId)).filter(Boolean));
  }, [event?.color, event?.id, event?.participants]);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen,
  });

  const { data: locations = [] } = useQuery<LocationOption[]>({
    queryKey: ["/api/locations"],
    enabled: isOpen && formMode === "event",
  });

  const { data: eventTypeSettings } = useQuery<EventTypeSettings>({
    queryKey: ["/api/calendar/event-types"],
    enabled: isOpen && formMode === "event",
  });

  const { data: kanbanBoards = [] } = useQuery<KanbanBoardOption[]>({
    queryKey: ["/api/kanban/boards"],
    enabled: isOpen && !event?.id,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/kanban/boards");
      return response.json();
    },
  });

  const editableKanbanBoards = useMemo(
    () => kanbanBoards.filter((board) => board.canEdit !== false),
    [kanbanBoards],
  );

  const { data: kanbanLists = [] } = useQuery<KanbanListOption[]>({
    queryKey: ["kanban-lists", selectedKanbanBoardId],
    enabled: isOpen && formMode === "kanban" && Boolean(selectedKanbanBoardId),
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/kanban/boards/${selectedKanbanBoardId}/lists`);
      return response.json();
    },
  });

  useEffect(() => {
    if (!isOpen || event?.id || formMode !== "kanban") return;
    setSelectedKanbanBoardId((current) => {
      if (editableKanbanBoards.some((board) => board.id === current)) return current;
      return editableKanbanBoards[0]?.id || "";
    });
  }, [editableKanbanBoards, event?.id, formMode, isOpen]);

  useEffect(() => {
    if (!isOpen || formMode !== "kanban") return;
    setSelectedKanbanListId((current) => {
      if (kanbanLists.some((list) => list.id === current)) return current;
      return kanbanLists[0]?.id || "";
    });
  }, [formMode, isOpen, kanbanLists]);

  const form = useForm<z.infer<typeof eventFormSchema>>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: event?.title || "",
      description: event?.description || "",
      startTime: toLocalDateTime(initialRange.start),
      endTime: toLocalDateTime(initialRange.end),
      location: event?.location || "",
      customLocation: event?.customLocation || "",
      organizerId: event?.organizerId || AuthService.getCurrentUser()?.id || "admin",
      type: event?.type || "stream",
      status: event?.status || "scheduled",
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const nextRange = normalizeDateRange(
      event?.startTime ? new Date(event.startTime) : fallbackStart,
      event?.endTime ? new Date(event.endTime) : new Date(fallbackStart.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000),
      DEFAULT_EVENT_DURATION_MINUTES,
    );
    form.reset({
      title: event?.title || "",
      description: event?.description || "",
      startTime: toLocalDateTime(nextRange.start),
      endTime: toLocalDateTime(nextRange.end),
      location: event?.location || "",
      customLocation: event?.customLocation || "",
      organizerId: event?.organizerId || AuthService.getCurrentUser()?.id || "admin",
      type: event?.type || "stream",
      status: event?.status || "scheduled",
    });
    setUseCustomLocation(!!event?.customLocation);
    setAllDay(isFullDayRange(nextRange.start, nextRange.end));
    autosaveSignatureRef.current = "";
    setAutosaveStatus(event?.id ? "saved" : "idle");
    setAutosaveError("");
  }, [event?.customLocation, event?.description, event?.endTime, event?.id, event?.location, event?.organizerId, event?.startTime, event?.status, event?.title, event?.type, fallbackStart, form, isOpen]);

  const watchedLocation = form.watch("location");
  const watchedEventType = form.watch("type");
  const configuredEventTypes = eventTypeSettings?.eventTypes?.length
    ? eventTypeSettings.eventTypes
    : DEFAULT_CALENDAR_EVENT_TYPES;
  const eventTypeOptions = useMemo(() => {
    if (!watchedEventType || configuredEventTypes.some((option) => option.value === watchedEventType)) {
      return configuredEventTypes;
    }
    return [
      {
        value: watchedEventType,
        label: event?.id ? `${watchedEventType} · сохранено ранее` : watchedEventType,
      },
      ...configuredEventTypes,
    ];
  }, [configuredEventTypes, event?.id, watchedEventType]);

  useEffect(() => {
    if (
      event?.id ||
      !eventTypeSettings?.eventTypes?.length ||
      eventTypeSettings.eventTypes.some((option) => option.value === watchedEventType)
    ) return;
    form.setValue("type", eventTypeSettings.eventTypes[0].value, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [event?.id, eventTypeSettings?.eventTypes, form, watchedEventType]);

  const locationOptions = useMemo(() => {
    const active = locations
      .filter((location) => !location.archivedAt)
      .map((location) => ({ value: location.name, label: location.name }));
    const current = watchedLocation;
    if (current && !active.some((option) => option.value === current)) {
      active.unshift({ value: current, label: `${current} · сохранено ранее` });
    }
    return active;
  }, [locations, watchedLocation]);

  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");

  useEffect(() => {
    if (!watchedStartTime || !watchedEndTime) return;
    const start = new Date(watchedStartTime);
    const end = new Date(watchedEndTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (end.getTime() > start.getTime()) return;

    const normalized = normalizeDateRange(start, end, DEFAULT_EVENT_DURATION_MINUTES);
    form.setValue("endTime", toLocalDateTime(normalized.end), { shouldValidate: true, shouldDirty: true });
  }, [form, watchedEndTime, watchedStartTime]);

  const setAllDayRange = (checked: boolean) => {
    setAllDay(checked);
    if (!checked) return;
    const start = new Date(form.getValues("startTime") || new Date());
    const dayStart = combineDateWithTime(start, "00:00");
    const dayEnd = combineDateWithTime(start, "23:59");
    form.setValue("startTime", toLocalDateTime(dayStart), { shouldValidate: true, shouldDirty: true });
    form.setValue("endTime", toLocalDateTime(dayEnd), { shouldValidate: true, shouldDirty: true });
  };

  const resolveLocation = (data: z.infer<typeof eventFormSchema>) => String(
    useCustomLocation ? data.customLocation || "" : data.location || "",
  ).trim();

  const validateLocation = (data: z.infer<typeof eventFormSchema>) => {
    if (formMode !== "event" || resolveLocation(data)) {
      form.clearErrors(["location", "customLocation"]);
      return true;
    }
    const field = useCustomLocation ? "customLocation" : "location";
    form.setError(field, { type: "required", message: "Укажите место проведения" });
    return false;
  };

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof eventFormSchema>) => {
      const location = resolveLocation(data);
      if (!location) throw new Error("Укажите место проведения");
      const eventData = {
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        location,
        participants: selectedParticipants.length > 0 ? selectedParticipants : undefined,
        color: eventColor,
      };
      
      const response = await apiRequest("POST", "/api/events", eventData);
      const newEvent = await response.json();
      return newEvent;
    },
    onSuccess: (newEvent: any) => {
      storeEventColor(newEvent?.id, eventColor);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.refetchQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Успешно",
        description: "Событие создано",
      });
      onClose();
      form.reset();
      setSelectedParticipants([]);
    },
    onError: (error: any) => {
      console.error("Error creating event:", error);
      let errorMessage = "Не удалось создать событие";
      
      if (error.message) {
        if (error.message.includes("404")) {
          errorMessage = "Сервер не найден (404). Откройте приложение по адресу, где запущен сервер (например http://localhost:PORT из .env). Если деплой — укажите VITE_API_BASE в .env и пересоберите.";
        } else if (error.message.includes("timeout") || error.message.includes("время ожидания")) {
          errorMessage = "Операция заняла слишком много времени. Попробуйте снова или проверьте подключение к серверу.";
        } else if (error.message.includes("400")) {
          errorMessage = "Неверные данные. Проверьте заполнение всех обязательных полей.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createKanbanCardMutation = useMutation({
    mutationFn: async (data: z.infer<typeof eventFormSchema>) => {
      if (!selectedKanbanBoardId || !selectedKanbanListId) {
        throw new Error("Выберите доску и список для задачи");
      }
      const response = await apiRequest("POST", `/api/kanban/boards/${selectedKanbanBoardId}/cards`, {
        listId: selectedKanbanListId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        priority: "medium",
        startDate: new Date(data.startTime).toISOString(),
        dueDate: new Date(data.endTime).toISOString(),
        assigneeUserId: null,
        labelIds: [],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedKanbanBoardId] });
      toast({
        title: "Успешно",
        description: "Задача создана на доске",
      });
      onClose();
      form.reset();
      setFormMode("event");
      setSelectedKanbanBoardId("");
      setSelectedKanbanListId("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать задачу",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof eventFormSchema>) => {
      const location = resolveLocation(data);
      if (!location) throw new Error("Укажите место проведения");
      const eventData = {
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        location,
        participants: selectedParticipants.length > 0 ? selectedParticipants : [],
        color: eventColor,
      };
      
      const response = await apiRequest("PUT", `/api/events/${event.id}`, eventData);
      return response.json();
    },
    onSuccess: (updatedEvent: any) => {
      storeEventColor(updatedEvent?.id || event?.id, eventColor);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.refetchQueries({ queryKey: ["/api/events"] });
      setAutosaveStatus("saved");
      setAutosaveError("");
    },
    onError: (error: any) => {
      setAutosaveStatus("error");
      setAutosaveError(error.message || "Не удалось обновить событие");
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить событие",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof eventFormSchema>) => {
    if (!event?.id && formMode === "kanban") {
      createKanbanCardMutation.mutate(data);
      return;
    }
    if (event?.id) {
      return;
    } else {
      if (!validateLocation(data)) return;
      createMutation.mutate(data);
    }
  };

  const watchedValues = form.watch();

  useEffect(() => {
    if (!isOpen || !event?.id) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const signature = JSON.stringify({
      ...watchedValues,
      participants: selectedParticipants,
      useCustomLocation,
      eventColor,
    });

    if (!autosaveSignatureRef.current) {
      autosaveSignatureRef.current = signature;
      setAutosaveStatus("saved");
      return;
    }

    if (signature === autosaveSignatureRef.current) return;

    const parsed = eventFormSchema.safeParse(watchedValues);
    if (
      !parsed.success ||
      !watchedValues.title?.trim() ||
      (formMode === "event" && !resolveLocation(parsed.success ? parsed.data : watchedValues as z.infer<typeof eventFormSchema>))
    ) {
      setAutosaveStatus("dirty");
      return;
    }

    setAutosaveStatus("dirty");
    autosaveTimerRef.current = setTimeout(() => {
      setAutosaveStatus("saving");
      updateMutation.mutate(parsed.data, {
        onSuccess: () => {
          autosaveSignatureRef.current = signature;
        },
      });
      autosaveTimerRef.current = null;
    }, EVENT_AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [event?.id, eventColor, isOpen, selectedParticipants, useCustomLocation, watchedValues]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="hide-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event?.id ? "Редактировать событие" : "Создать событие"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {!event?.id && (
              <div className="inline-flex rounded-control border border-border/50 bg-muted/30 p-1">
                <Button
                  type="button"
                  variant={formMode === "event" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-md"
                  onClick={() => setFormMode("event")}
                >
                  Событие
                </Button>
                <Button
                  type="button"
                  variant={formMode === "kanban" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-md"
                  onClick={() => setFormMode("kanban")}
                >
                  Задача Kanban
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название события *</FormLabel>
                  <FormControl>
                    <Input placeholder="Еженедельный подкаст" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formMode === "kanban" && !event?.id && (
              <div className="grid grid-cols-1 gap-4 rounded-surface border border-border/50 bg-muted/20 p-3 md:grid-cols-2">
                <div className="space-y-2">
                  <FormLabel>Доска</FormLabel>
                  <StreamSelect
                    ariaLabel="Доска Kanban"
                    value={selectedKanbanBoardId}
                    options={editableKanbanBoards.length === 0
                      ? [{ value: "", label: "Нет доступных досок" }]
                      : editableKanbanBoards.map((board) => ({ value: board.id, label: board.name }))}
                    onValueChange={(value) => {
                      setSelectedKanbanBoardId(value);
                      setSelectedKanbanListId("");
                    }}
                    className="h-10 sm:h-10"
                    searchable
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel>Список</FormLabel>
                  <StreamSelect
                    ariaLabel="Список Kanban"
                    value={selectedKanbanListId}
                    options={kanbanLists.length === 0
                      ? [{ value: "", label: "Нет списков" }]
                      : kanbanLists.map((list) => ({ value: list.id, label: list.name }))}
                    onValueChange={setSelectedKanbanListId}
                    disabled={!selectedKanbanBoardId}
                    className="h-10 sm:h-10"
                    searchable
                  />
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Подробное описание события..."
                      className="min-h-[100px]"
                      {...field} 
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <StreamDateTimePicker
                        id="event-start-time"
                        label="Начало *"
                        value={field.value}
                        allDay={allDay}
                        defaultTime="09:00"
                        onChange={(value) => {
                          if (allDay && value) {
                            const dayStart = combineDateWithTime(new Date(value), "00:00");
                            const dayEnd = combineDateWithTime(new Date(value), "23:59");
                            field.onChange(toLocalDateTime(dayStart));
                            form.setValue("endTime", toLocalDateTime(dayEnd), { shouldValidate: true, shouldDirty: true });
                            return;
                          }
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <StreamDateTimePicker
                        id="event-end-time"
                        label="Окончание *"
                        value={field.value}
                        minValue={form.watch("startTime")}
                        allDay={allDay}
                        defaultTime="10:00"
                        onChange={(value) => {
                          if (allDay && value) {
                            field.onChange(toLocalDateTime(combineDateWithTime(new Date(value), "23:59")));
                            return;
                          }
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 rounded-control border border-border/50 bg-muted/30 px-3 py-2 text-sm">
                  <Checkbox checked={allDay} onCheckedChange={(checked) => setAllDayRange(checked === true)} />
                  Весь день
                </label>
              </div>

              {formMode === "event" && (
                <>
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип события</FormLabel>
                        <FormControl>
                          <StreamSelect
                            ariaLabel="Тип события"
                            value={field.value || "stream"}
                            options={eventTypeOptions}
                            onValueChange={field.onChange}
                            searchable
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Статус</FormLabel>
                        <FormControl>
                          <StreamSelect
                            ariaLabel="Статус события"
                            value={field.value || "scheduled"}
                            options={[
                              { value: "scheduled", label: "Запланировано" },
                              { value: "active", label: "Активно" },
                              { value: "completed", label: "Завершено" },
                              { value: "cancelled", label: "Отменено" },
                            ]}
                            onValueChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            {formMode === "event" && (
              <div className="space-y-2">
                <FormLabel>Цвет события</FormLabel>
                <StreamColorPicker
                  value={eventColor}
                  onChange={setEventColor}
                  ariaLabel="Цвет события"
                  presets={EVENT_COLOR_OPTIONS}
                />
              </div>
            )}

            {/* Выбор места */}
            {formMode === "event" && <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customLocation"
                  checked={useCustomLocation}
                  onCheckedChange={(checked) => setUseCustomLocation(checked === true)}
                />
                <label htmlFor="customLocation" className="text-sm font-medium">
                  Указать свое место
                </label>
              </div>

              {useCustomLocation ? (
                <FormField
                  control={form.control}
                  name="customLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Место проведения *</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите место проведения" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Место проведения *</FormLabel>
                      <FormControl>
                        <StreamSelect
                          ariaLabel="Место проведения"
                          value={field.value || ""}
                          options={locationOptions}
                          onValueChange={field.onChange}
                          placeholder={locationOptions.length ? "Выберите площадку" : "Нет активных площадок"}
                          searchable
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>}

            {/* Участники */}
            {formMode === "event" && <div className="space-y-4">
              <FormLabel>Участники события</FormLabel>
              <StreamMultiSelect
                values={selectedParticipants}
                options={users.map((user) => ({
                  value: user.id,
                  label: user.name,
                  description: [user.position, user.department].filter(Boolean).join(" · "),
                }))}
                onValuesChange={setSelectedParticipants}
                placeholder="Добавить участников"
                ariaLabel="Участники события"
                title="Участники события"
                searchable
                maxVisibleChips={5}
              />
            </div>}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {event?.id && (
                <div className="text-sm text-muted-foreground">
                  {autosaveStatus === "saving" && "Сохранение..."}
                  {autosaveStatus === "saved" && "Сохранено"}
                  {autosaveStatus === "dirty" && "Есть несохраненные изменения"}
                  {autosaveStatus === "error" && `Ошибка сохранения${autosaveError ? `: ${autosaveError}` : ""}`}
                  {autosaveStatus === "idle" && "Изменения сохраняются автоматически"}
                </div>
              )}
              <div className="ml-auto flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={onClose}>
                {event?.id ? "Закрыть" : "Отмена"}
              </Button>
              {!event?.id && (
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    createKanbanCardMutation.isPending ||
                    (formMode === "kanban" && (!selectedKanbanBoardId || !selectedKanbanListId))
                  }
                >
                  {createMutation.isPending || createKanbanCardMutation.isPending
                    ? "Сохранение..."
                    : formMode === "kanban" ? "Создать задачу" : "Создать"
                  }
                </Button>
              )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
