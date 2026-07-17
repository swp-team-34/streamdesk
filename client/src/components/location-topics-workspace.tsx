import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  StickyNote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeSubscriptions } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type TopicAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadedByName?: string | null;
  createdAt?: string | null;
};

type TopicMessage = {
  id: string;
  authorName: string;
  content: string;
  attachments?: TopicAttachment[];
  createdAt?: string | null;
};

export type LocationTopic = {
  id: string;
  locationId: string;
  type: "note" | "issue";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical" | null;
  status: "active" | "resolved" | "archived";
  authorName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  photos?: string[] | null;
  comments?: TopicMessage[];
  project?: { id: string; name: string } | null;
  kanbanCard?: { id: string; title: string; boardId: string } | null;
  canEdit?: boolean;
  canManage?: boolean;
  canReply?: boolean;
};

type LinkedLocationDetails = {
  id: string;
  linkedWork?: {
    projects: Array<{ id: string; name: string; completed: boolean }>;
    cards: Array<{
      id: string;
      title: string;
      boardId: string;
      boardName: string;
      projectId?: string | null;
      status: "active" | "completed";
    }>;
  };
};

export type LocationTopicLocation = {
  id: string;
  name: string;
  companyId?: string | null;
  archivedAt?: string | null;
};

type TopicForm = {
  locationId: string;
  type: "note" | "issue";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  projectId: string;
  kanbanCardId: string;
};

const EMPTY_TOPIC: TopicForm = {
  locationId: "",
  type: "issue",
  title: "",
  description: "",
  severity: "medium",
  projectId: "",
  kanbanCardId: "",
};

const TYPE_LABELS = {
  note: "Заметка",
  issue: "Проблема",
};

const STATUS_LABELS = {
  active: "Активна",
  resolved: "Решена",
  archived: "Архив",
};

const SEVERITY_LABELS = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(value?: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function topicTone(topic: LocationTopic) {
  if (topic.status === "archived") return "border-border/40 bg-surface-subtle opacity-75";
  if (topic.status === "resolved") return "border-success/30 bg-success-muted";
  if (topic.type === "note") return "border-info/30 bg-info-muted";
  if (topic.severity === "critical") return "border-error/35 bg-error-muted";
  if (topic.severity === "high") return "border-warning/35 bg-warning-muted";
  return "border-warning/30 bg-surface-raised";
}

export function LocationTopicsWorkspace({
  locations,
  createOpen,
  onCreateOpenChange,
  topicId,
  onTopicChange,
  defaultLocationId,
}: {
  locations: LocationTopicLocation[];
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  topicId?: string | null;
  onTopicChange: (topicId: string | null, locationId?: string) => void;
  defaultLocationId?: string | null;
}) {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<"all" | LocationTopic["type"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | LocationTopic["status"]>("active");
  const [severityFilter, setSeverityFilter] = useState<"all" | NonNullable<LocationTopic["severity"]>>("all");
  const [form, setForm] = useState<TopicForm>(EMPTY_TOPIC);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const topicsQuery = useQuery<LocationTopic[]>({
    queryKey: ["/api/location-issues"],
    refetchInterval: 30_000,
  });
  const topics = topicsQuery.data ?? [];
  const selectedTopic = topics.find((topic) => topic.id === topicId) ?? null;
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );
  const realtimeChannels = locations
    .filter((location) => !location.archivedAt)
    .map((location) => `location:${location.id}:topics`);

  useRealtimeSubscriptions(realtimeChannels, (event) => {
    if (event.type !== "discussion_event" && event.type !== "realtime_reconnected") return;
    queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
  });

  useEffect(() => {
    if (!createOpen) return;
    setForm({
      ...EMPTY_TOPIC,
      locationId: (
        defaultLocationId &&
        locations.some((location) => location.id === defaultLocationId && !location.archivedAt)
      )
        ? defaultLocationId
        : locations.find((location) => !location.archivedAt)?.id || "",
    });
  }, [createOpen, defaultLocationId, locations]);

  const selectedLocationDetailsQuery = useQuery<LinkedLocationDetails>({
    queryKey: ["/api/locations", form.locationId],
    enabled: Boolean(createOpen && form.locationId),
    queryFn: async () => (await apiRequest("GET", `/api/locations/${form.locationId}`)).json(),
  });
  const linkedProjects = selectedLocationDetailsQuery.data?.linkedWork?.projects
    .filter((project) => !project.completed) ?? [];
  const linkedCards = selectedLocationDetailsQuery.data?.linkedWork?.cards
    .filter((card) =>
      card.status === "active" &&
      (!form.projectId || String(card.projectId || "") === form.projectId),
    ) ?? [];

  const visibleTopics = useMemo(() => topics
    .filter((topic) => typeFilter === "all" || topic.type === typeFilter)
    .filter((topic) => statusFilter === "all" || topic.status === statusFilter)
    .filter((topic) =>
      severityFilter === "all" ||
      (topic.type === "issue" && topic.severity === severityFilter),
    )
    .sort((left, right) =>
      new Date(right.updatedAt || right.createdAt || 0).getTime() -
      new Date(left.updatedAt || left.createdAt || 0).getTime(),
    ), [severityFilter, statusFilter, topics, typeFilter]);

  const invalidateTopicConsumers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
    queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  const createTopic = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/location-issues", {
      locationId: form.locationId,
      type: form.type,
      title: form.title,
      description: form.description,
      severity: form.type === "issue" ? form.severity : null,
      projectId: form.projectId || null,
      kanbanCardId: form.kanbanCardId || null,
    })).json() as Promise<LocationTopic>,
    onSuccess: (topic) => {
      invalidateTopicConsumers();
      onCreateOpenChange(false);
      onTopicChange(topic.id, topic.locationId);
      toast({ title: form.type === "issue" ? "Проблема зарегистрирована" : "Тема создана" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось создать тему", description: error?.message, variant: "destructive" });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LocationTopic["status"] }) =>
      (await apiRequest("PUT", `/api/location-issues/${id}`, { status })).json(),
    onSuccess: () => {
      invalidateTopicConsumers();
      toast({ title: "Статус темы обновлён" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось изменить статус", description: error?.message, variant: "destructive" });
    },
  });

  const addMessage = useMutation({
    mutationFn: async (topic: LocationTopic) => {
      const payload = new FormData();
      payload.append("content", message);
      files.forEach((file) => payload.append("files", file));
      return (await apiRequest("POST", `/api/location-issues/${topic.id}/comments`, payload, true)).json();
    },
    onSuccess: () => {
      setMessage("");
      setFiles([]);
      invalidateTopicConsumers();
    },
    onError: (error: any) => {
      toast({ title: "Не удалось добавить ответ", description: error?.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card className="border-border/50 bg-surface-raised shadow-xs">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" />
                Темы площадок
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Обсуждения отделены от общих рабочих заметок площадки.
              </p>
            </div>
            <Badge variant="outline">{visibleTopics.length}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="issue">Проблемы</SelectItem>
                <SelectItem value="note">Заметки</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Активные</SelectItem>
                <SelectItem value="resolved">Решённые</SelectItem>
                <SelectItem value="archived">Архив</SelectItem>
                <SelectItem value="all">Все статусы</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as typeof severityFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Любая важность</SelectItem>
                {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {topicsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Загрузка тем...
            </div>
          ) : visibleTopics.length === 0 ? (
            <div className="rounded-surface border border-dashed border-border/60 bg-surface-subtle p-8 text-center text-sm text-muted-foreground">
              Тем по выбранным условиям нет.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleTopics.map((topic) => {
                const location = locationById.get(topic.locationId);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    className={cn(
                      "rounded-surface border p-4 text-left transition hover:border-primary/50 hover:bg-surface-overlay",
                      topicTone(topic),
                    )}
                    onClick={() => onTopicChange(topic.id, topic.locationId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {topic.type === "issue"
                            ? <AlertTriangle className="h-4 w-4 text-warning" />
                            : <StickyNote className="h-4 w-4 text-info" />}
                          <span className="font-medium">{topic.title}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {location?.name || "Площадка"} · {topic.authorName} · {formatDateTime(topic.createdAt)}
                        </div>
                      </div>
                      <Badge variant={topic.status === "active" ? "default" : "secondary"}>
                        {STATUS_LABELS[topic.status]}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{topic.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{TYPE_LABELS[topic.type]}</Badge>
                      {topic.type === "issue" && topic.severity && (
                        <Badge variant="outline">{SEVERITY_LABELS[topic.severity]}</Badge>
                      )}
                      {(topic.comments?.length ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Ответов: {topic.comments?.length}
                        </span>
                      )}
                      {(topic.project || topic.kanbanCard) && (
                        <span className="text-xs text-primary">Есть рабочая связь</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Новая тема площадки</DialogTitle>
            <DialogDescription>
              Заметка хранит рабочий контекст, проблема получает важность и жизненный цикл.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>
              Площадка
              <Select
                value={form.locationId}
                onValueChange={(value) => setForm((current) => ({
                  ...current,
                  locationId: value,
                  projectId: "",
                  kanbanCardId: "",
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Выберите площадку" /></SelectTrigger>
                <SelectContent>
                  {locations.filter((location) => !location.archivedAt).map((location) => (
                    <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Тип
              <Select
                value={form.type}
                onValueChange={(value) => setForm((current) => ({
                  ...current,
                  type: value as TopicForm["type"],
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="issue">Проблема</SelectItem>
                  <SelectItem value="note">Заметка</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Заголовок
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </Label>
            <Label>
              Описание
              <Textarea
                className="min-h-28"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </Label>
            {form.type === "issue" && (
              <Label>
                Важность
                <Select
                  value={form.severity}
                  onValueChange={(value) => setForm((current) => ({
                    ...current,
                    severity: value as TopicForm["severity"],
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Проект, необязательно
                <Select
                  value={form.projectId || "none"}
                  onValueChange={(value) => setForm((current) => ({
                    ...current,
                    projectId: value === "none" ? "" : value,
                    kanbanCardId: "",
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без проекта</SelectItem>
                    {linkedProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Label>
                Карточка Kanban V2, необязательно
                <Select
                  value={form.kanbanCardId || "none"}
                  onValueChange={(value) => {
                    const card = linkedCards.find((item) => item.id === value);
                    setForm((current) => ({
                      ...current,
                      kanbanCardId: value === "none" ? "" : value,
                      projectId: card?.projectId || current.projectId,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без карточки</SelectItem>
                    {linkedCards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>{card.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onCreateOpenChange(false)}>Отмена</Button>
            <Button
              onClick={() => createTopic.mutate()}
              disabled={
                !form.locationId ||
                !form.title.trim() ||
                !form.description.trim() ||
                createTopic.isPending
              }
            >
              {createTopic.isPending ? "Создание..." : "Создать тему"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedTopic)}
        onOpenChange={(open) => {
          if (!open) {
            setMessage("");
            setFiles([]);
            onTopicChange(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {selectedTopic && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{TYPE_LABELS[selectedTopic.type]}</Badge>
                  <Badge variant={selectedTopic.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABELS[selectedTopic.status]}
                  </Badge>
                  {selectedTopic.type === "issue" && selectedTopic.severity && (
                    <Badge variant="outline">{SEVERITY_LABELS[selectedTopic.severity]}</Badge>
                  )}
                </div>
                <DialogTitle>{selectedTopic.title}</DialogTitle>
                <DialogDescription>
                  {locationById.get(selectedTopic.locationId)?.name || "Площадка"} · {selectedTopic.authorName} · {formatDateTime(selectedTopic.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p className="whitespace-pre-wrap rounded-control border border-border/50 bg-surface-subtle p-3 text-sm">
                  {selectedTopic.description}
                </p>

                {(selectedTopic.project || selectedTopic.kanbanCard) && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTopic.project && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/projects?projectId=${encodeURIComponent(selectedTopic.project.id)}`}>
                          Проект: {selectedTopic.project.name}
                        </a>
                      </Button>
                    )}
                    {selectedTopic.kanbanCard && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/tasks-v2?boardId=${encodeURIComponent(selectedTopic.kanbanCard.boardId)}&cardId=${encodeURIComponent(selectedTopic.kanbanCard.id)}`}>
                          Kanban V2: {selectedTopic.kanbanCard.title}
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {Array.isArray(selectedTopic.photos) && selectedTopic.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTopic.photos.map((photo) => (
                      <a key={photo} href={apiUrl(photo)} target="_blank" rel="noreferrer">
                        <img src={apiUrl(photo)} alt="" className="h-20 w-20 rounded-control border border-border/50 object-cover" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Обсуждение</h3>
                  {(selectedTopic.comments?.length ?? 0) === 0 ? (
                    <div className="rounded-surface border border-dashed border-border/60 bg-surface-subtle p-5 text-center text-sm text-muted-foreground">
                      Ответов пока нет.
                    </div>
                  ) : selectedTopic.comments?.map((comment) => (
                    <div key={comment.id} className="rounded-surface border border-border/50 bg-surface-subtle p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{comment.authorName}</span>
                        <span>{formatDateTime(comment.createdAt)}</span>
                      </div>
                      {comment.content && <p className="mt-2 whitespace-pre-wrap text-sm">{comment.content}</p>}
                      {(comment.attachments?.length ?? 0) > 0 && (
                        <div className="mt-2 space-y-1">
                          {comment.attachments?.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={apiUrl(attachment.fileUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded-control bg-surface-overlay px-2.5 py-2 text-sm hover:bg-surface-raised"
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                              <span className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
                              <Download className="h-4 w-4" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedTopic.canReply && (
                  <div className="space-y-2 rounded-surface border border-border/50 bg-surface-subtle p-3">
                    <Textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Добавить ответ"
                    />
                    {files.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {files.map((file) => file.name).join(", ")}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                      <Label className="flex h-9 cursor-pointer items-center gap-2 rounded-control border border-border/50 bg-surface-raised px-3 text-sm">
                        <Paperclip className="h-4 w-4" />
                        Файлы
                        <input
                          className="hidden"
                          type="file"
                          multiple
                          accept=".pdf,.docx,.xlsx,.txt,image/jpeg,image/png,image/webp"
                          onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))}
                        />
                      </Label>
                      <Button
                        onClick={() => addMessage.mutate(selectedTopic)}
                        disabled={(!message.trim() && files.length === 0) || addMessage.isPending}
                      >
                        {addMessage.isPending ? "Отправка..." : "Ответить"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {selectedTopic.canManage && selectedTopic.status !== "archived" && (
                <DialogFooter className="gap-2 sm:justify-start">
                  {selectedTopic.status === "active" ? (
                    <Button
                      variant="outline"
                      onClick={() => changeStatus.mutate({ id: selectedTopic.id, status: "resolved" })}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Решено
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => changeStatus.mutate({ id: selectedTopic.id, status: "active" })}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Открыть снова
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => changeStatus.mutate({ id: selectedTopic.id, status: "archived" })}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    В архив
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
