import {
  Archive,
  ArchiveRestore,
  Building2,
  Download,
  Edit3,
  FileText,
  Film,
  History,
  ListTodo,
  MapPin,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  formatLocationDateTime,
  formatLocationFileSize,
  type Location,
} from "@/lib/location-model";
import { apiUrl } from "@/lib/queryClient";
import { RECORDING_PLACE_STATUS_LABELS } from "@/lib/recording-place-status";

interface LocationDetailsDialogProps {
  location: Location | null;
  loading: boolean;
  canManage: boolean;
  restorePending: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onRestore: () => void;
  onArchive: () => void;
  onEdit: () => void;
}

export function LocationDetailsDialog({
  location,
  loading,
  canManage,
  restorePending,
  onClose,
  onUpload,
  onRemoveAttachment,
  onRestore,
  onArchive,
  onEdit,
}: LocationDetailsDialogProps) {
  return (
    <Dialog open={Boolean(location)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        {location && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <Building2 className="h-5 w-5" />
                {location.name}
                {location.archivedAt && <Badge variant="secondary">Архив</Badge>}
              </DialogTitle>
              <DialogDescription>
                {location.type || "Тип не указан"} · {RECORDING_PLACE_STATUS_LABELS[location.status || "available"]}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {location.address && (
                <div className="rounded-surface border border-border/50 bg-surface-subtle p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Адрес или контекст
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{location.address}</p>
                </div>
              )}
              {location.description && (
                <div className="rounded-surface border border-border/50 bg-surface-subtle p-3">
                  <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Описание</div>
                  <p className="whitespace-pre-wrap text-sm">{location.description}</p>
                </div>
              )}
              {location.notes && (
                <div className="rounded-surface border border-border/50 bg-surface-subtle p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Рабочие заметки
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{location.notes}</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-surface border border-border/50 bg-surface-subtle p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ListTodo className="h-4 w-4" />
                      Карточки Kanban V2
                    </div>
                    <Badge variant="outline">{location.linkedWork?.cards.length ?? 0}</Badge>
                  </div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Загружаем связи...</p>
                  ) : (location.linkedWork?.cards.length ?? 0) > 0 ? (
                    <div className="max-h-52 space-y-2 overflow-y-auto">
                      {location.linkedWork?.cards.map((card) => (
                        <a
                          key={card.id}
                          href={`/tasks-v2?boardId=${encodeURIComponent(card.boardId)}&cardId=${encodeURIComponent(card.id)}`}
                          className="block rounded-control bg-surface-overlay px-3 py-2 transition hover:bg-surface-raised"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium">{card.title}</span>
                            <Badge variant={card.status === "active" ? "default" : "secondary"}>
                              {card.status === "active" ? "Активна" : "Завершена"}
                            </Badge>
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {card.boardName} · {card.listName}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Связанных карточек пока нет.</p>
                  )}
                </div>

                <div className="rounded-surface border border-border/50 bg-surface-subtle p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Film className="h-4 w-4" />
                      Проекты
                    </div>
                    <Badge variant="outline">{location.linkedWork?.projects.length ?? 0}</Badge>
                  </div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Загружаем связи...</p>
                  ) : (location.linkedWork?.projects.length ?? 0) > 0 ? (
                    <div className="max-h-52 space-y-2 overflow-y-auto">
                      {location.linkedWork?.projects.map((project) => (
                        <a
                          key={project.id}
                          href={`/projects?projectId=${encodeURIComponent(project.id)}`}
                          className="block rounded-control bg-surface-overlay px-3 py-2 transition hover:bg-surface-raised"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium">{project.name}</span>
                            <Badge variant={project.completed ? "secondary" : "default"}>
                              {project.completed ? "Завершён" : "Активен"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {project.source === "cards"
                              ? "Связь через карточки Kanban"
                              : project.source === "direct_and_cards"
                                ? "Прямая связь и карточки Kanban"
                                : "Прямая связь проекта"}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Связанных проектов пока нет.</p>
                  )}
                </div>
              </div>

              <div className="rounded-surface border border-border/50 bg-surface-subtle p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Paperclip className="h-4 w-4" />
                    Файлы
                  </div>
                  {canManage && !location.archivedAt && (
                    <Label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-control border border-border/50 bg-surface-raised px-2.5 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Добавить
                      <input
                        className="hidden"
                        type="file"
                        accept=".pdf,.docx,.xlsx,.txt,image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUpload(file);
                        }}
                      />
                    </Label>
                  )}
                </div>
                {Array.isArray(location.attachments) && location.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {location.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 rounded-control bg-surface-overlay px-3 py-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{attachment.fileName}</div>
                          <div className="text-xs text-muted-foreground">
                            {[
                              formatLocationFileSize(attachment.fileSize),
                              attachment.uploadedByName,
                              formatLocationDateTime(attachment.createdAt),
                            ].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                          <a href={apiUrl(attachment.fileUrl)} target="_blank" rel="noreferrer" aria-label="Открыть файл">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        {canManage && !location.archivedAt && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-error hover:bg-error-muted hover:text-error"
                            onClick={() => onRemoveAttachment(attachment.id)}
                            aria-label="Удалить файл"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Файлы пока не добавлены.</p>
                )}
              </div>

              <div className="rounded-surface border border-border/50 bg-surface-subtle p-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <History className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Последнее изменение: {location.updatedByName || "неизвестный пользователь"}
                    {location.updatedAt ? ` · ${formatLocationDateTime(location.updatedAt)}` : ""}
                  </span>
                </div>
                {location.archivedAt && (
                  <div className="mt-2">
                    Архивировал: {location.archivedByName || "неизвестный пользователь"} · {formatLocationDateTime(location.archivedAt)}
                  </div>
                )}
              </div>
            </div>

            {canManage && (
              <DialogFooter className="gap-2 sm:justify-between">
                {location.archivedAt ? (
                  <Button variant="outline" onClick={onRestore} disabled={restorePending}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Восстановить
                  </Button>
                ) : (
                  <Button variant="outline" onClick={onArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    В архив
                  </Button>
                )}
                {!location.archivedAt && (
                  <Button onClick={onEdit}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Редактировать
                  </Button>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
