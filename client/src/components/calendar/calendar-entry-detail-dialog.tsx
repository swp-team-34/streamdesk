import type { CSSProperties } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Check,
  Clock,
  Edit,
  Flag,
  FolderOpen,
  MapPin,
  Paperclip,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthService } from "@/lib/auth";
import {
  getEventTypeText,
  isKanbanEntry,
  isTaskEntry,
  TASK_PRIORITY_LABELS,
  type CalendarEntry,
} from "@/lib/calendar-page-model";
import {
  formatDueDateLabel,
  getDueDateStatus,
  getDueDateStatusLabel,
} from "@/lib/task-dates";
import { cn } from "@/lib/utils";

type EntryColorStrength = "card" | "inline" | "badge";

function getTaskScheduleLabel(task: { startDate?: string | Date | null; dueDate?: string | Date | null }) {
  if (task.startDate && task.dueDate) {
    return `Период: ${format(new Date(task.startDate), "dd.MM.yyyy HH:mm", { locale: ru })} - ${format(new Date(task.dueDate), "dd.MM.yyyy HH:mm", { locale: ru })}`;
  }
  const sourceDate = task.startDate || task.dueDate;
  if (!sourceDate) return null;
  const label = task.startDate ? "Старт" : "Срок";
  return `${label}: ${format(new Date(sourceDate), "dd.MM.yyyy HH:mm", { locale: ru })}`;
}

export function CalendarEntryDetailDialog({
  open,
  onOpenChange,
  entry,
  currentTime,
  getEventDotClass,
  getEntryDotStyle,
  getEventBadgeClasses,
  getEntryColorStyle,
  onRespondParticipant,
  isResponding,
  onEditEvent,
  onDeleteEvent,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: CalendarEntry | null;
  currentTime: Date;
  getEventDotClass: (entry: CalendarEntry) => string;
  getEntryDotStyle: (entry: CalendarEntry) => CSSProperties | undefined;
  getEventBadgeClasses: (entry: CalendarEntry) => string;
  getEntryColorStyle: (entry: CalendarEntry, strength?: EntryColorStrength) => CSSProperties | undefined;
  onRespondParticipant: (response: {
    eventId: string;
    participantId: string;
    status: "accepted" | "declined";
  }) => void;
  isResponding: boolean;
  onEditEvent: () => void;
  onDeleteEvent: (eventId: string) => void;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/50 bg-card p-0 sm:max-w-md">
        {entry && (
          <div className="space-y-4 p-4 sm:p-5">
            {isTaskEntry(entry) || isKanbanEntry(entry) ? (
              <>
                <div className="flex items-start gap-3">
                  <div
                    className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", getEventDotClass(entry))}
                    style={getEntryDotStyle(entry)}
                  />
                  <div className="min-w-0 space-y-2">
                    <h3 className="break-words pr-6 text-lg font-semibold leading-tight text-foreground">{entry.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={cn(getEventBadgeClasses(entry), "text-xs")}
                        style={getEntryColorStyle(entry, "badge")}
                      >
                        {entry.badgeText}
                      </Badge>
                      <Badge variant="secondary">{entry.statusLabel}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                  {getTaskScheduleLabel(entry.task) && (
                    <div className="flex items-start gap-3">
                      <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground">{getTaskScheduleLabel(entry.task)}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground">{entry.responsibleLabel || "Без исполнителя"}</span>
                  </div>
                  {entry.task.priority && (
                    <div className="flex items-start gap-3">
                      <Flag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground">
                        {TASK_PRIORITY_LABELS[entry.task.priority] || entry.task.priority}
                      </span>
                    </div>
                  )}
                  {isTaskEntry(entry) && entry.task.category && (
                    <div className="flex items-start gap-3">
                      <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground">{entry.task.category}</span>
                    </div>
                  )}
                  {isKanbanEntry(entry) && entry.task.boardName && (
                    <div className="flex items-start gap-3">
                      <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground">{entry.task.boardName}</span>
                    </div>
                  )}
                  {isKanbanEntry(entry) && (
                    <>
                      <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-foreground">
                          Старт: {formatDueDateLabel(entry.task.startDate) || "Не задан"}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-foreground">
                          Срок: {formatDueDateLabel(entry.task.dueDate) || "Не задан"}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Flag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-foreground">
                          Статус срока: {getDueDateStatusLabel(getDueDateStatus(entry.task.dueDate, {
                            isComplete:
                              entry.task.listType === "closed" ||
                              entry.task.listType === "archive" ||
                              entry.task.listType === "trash",
                            now: currentTime,
                          }))}
                        </span>
                      </div>
                    </>
                  )}
                  {entry.description && (
                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="break-words text-foreground">{entry.description}</p>
                    </div>
                  )}
                  {isTaskEntry(entry) && Array.isArray(entry.task.subtasks) && entry.task.subtasks.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">Подзадачи</p>
                      <div className="space-y-1.5">
                        {entry.task.subtasks.map((subtask) => (
                          <div key={subtask.id} className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-foreground">
                            {subtask.completed ? "✓ " : ""}
                            {subtask.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isTaskEntry(entry) && Array.isArray(entry.task.links) && entry.task.links.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">Ссылки</p>
                      <div className="space-y-1.5">
                        {entry.task.links.map((link, index) => (
                          <a
                            key={`${link.url || index}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg border border-border/50 px-3 py-2 text-primary hover:underline"
                          >
                            {link.title || link.url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {isTaskEntry(entry) && Array.isArray(entry.task.attachments) && entry.task.attachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">Вложения</p>
                      <div className="space-y-1.5">
                        {entry.task.attachments.map((file, index) => (
                          <div
                            key={`${file.url || file.name || index}`}
                            className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-foreground"
                          >
                            <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate">{file.name || file.url || "Файл"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border/35 pt-2">
                  {isKanbanEntry(entry) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        window.location.href = `/tasks?boardId=${encodeURIComponent(entry.task.boardId)}&cardId=${encodeURIComponent(entry.task.id)}`;
                      }}
                    >
                      Открыть карточку
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Закрыть
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div
                    className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", getEventDotClass(entry))}
                    style={getEntryDotStyle(entry)}
                  />
                  <h3 className="break-words pr-6 text-lg font-semibold leading-tight text-foreground">{entry.title}</h3>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground">
                      {format(new Date(entry.startTime), "EEEE, d MMMM", { locale: ru })}{" "}
                      {format(new Date(entry.startTime), "HH:mm")}–{format(new Date(entry.endTime), "HH:mm")}
                    </span>
                  </div>
                  {entry.location && (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground">{entry.location}</span>
                    </div>
                  )}
                  {entry.description && (
                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="break-words text-foreground">{entry.description}</p>
                    </div>
                  )}
                  {entry.participants && entry.participants.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-sm font-medium text-foreground">Участники</p>
                        <ul className="space-y-1">
                          {entry.participants.map((participant) => {
                            const currentUserId = AuthService.getCurrentUser()?.id;
                            const isMe = currentUserId && participant.userId === currentUserId;
                            const isInvited = participant.status === "invited";
                            return (
                              <li key={participant.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate text-foreground">{participant.userName ?? "?"}</span>
                                <span className={cn(
                                  "shrink-0 text-xs",
                                  participant.status === "accepted" && "text-green-600 dark:text-green-400",
                                  participant.status === "declined" && "text-rose-600 dark:text-rose-400",
                                  participant.status === "invited" && "text-muted-foreground",
                                )}>
                                  {participant.status === "accepted" && "Принято"}
                                  {participant.status === "declined" && "Отклонено"}
                                  {participant.status === "invited" && (isMe ? "Приглашение" : "Ожидает")}
                                </span>
                                {isMe && isInvited && (
                                  <span className="flex shrink-0 items-center gap-0.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-green-600 hover:bg-green-500/10 hover:text-green-700"
                                      onClick={() => onRespondParticipant({
                                        eventId: entry.id,
                                        participantId: participant.id,
                                        status: "accepted",
                                      })}
                                      disabled={isResponding}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                                      onClick={() => onRespondParticipant({
                                        eventId: entry.id,
                                        participantId: participant.id,
                                        status: "declined",
                                      })}
                                      disabled={isResponding}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Badge
                      className={cn(getEventBadgeClasses(entry), "text-xs")}
                      style={getEntryColorStyle(entry, "badge")}
                    >
                      {getEventTypeText(entry.type)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border/35 pt-2">
                  <Button size="sm" className="gap-2" onClick={onEditEvent}>
                    <Edit className="h-4 w-4" />
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    onClick={() => {
                      if (window.confirm("Удалить это событие?")) onDeleteEvent(entry.id);
                    }}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Закрыть
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
