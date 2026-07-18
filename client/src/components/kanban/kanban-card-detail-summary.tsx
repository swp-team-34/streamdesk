import { AlertTriangle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getSubtaskProgress,
  normalizeLabelIds,
  type KanbanCardView,
  type KanbanLabelView,
  type KanbanListView,
} from "@/lib/kanban-board-model";
import {
  CARD_PRIORITY_BADGE_VARIANTS,
  CARD_PRIORITY_LABELS,
} from "@/lib/kanban-presentation";
import {
  formatDueDateLabel,
  getDueDateStatus,
  getDueDateStatusClasses,
  getDueDateStatusLabel,
} from "@/lib/task-dates";

interface KanbanCardDetailHeaderProps {
  card: KanbanCardView;
  list: KanbanListView | null;
}

function isCompleteLikeList(list: KanbanListView | null): boolean {
  return list?.type === "closed" || list?.type === "archive" || list?.type === "trash";
}

export function KanbanCardDetailHeader({ card, list }: KanbanCardDetailHeaderProps) {
  const dueDateStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList(list) });
  const dueDateStatusClasses = getDueDateStatusClasses(dueDateStatus);
  return (
    <DialogHeader className="space-y-3 border-b border-border/50 bg-surface-subtle px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
        <div className="space-y-1">
          <DialogTitle className="break-words text-xl font-semibold tracking-tight">{card.title}</DialogTitle>
          <DialogDescription className="break-words">
            {card.description || "У этой карточки пока нет описания."}
          </DialogDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[card.priority]} className="rounded-full">
            {CARD_PRIORITY_LABELS[card.priority]}
          </Badge>
          {list && (
            <Badge variant="outline" className="rounded-full border-border/40 bg-surface-overlay text-muted-foreground">
              {list.name}
            </Badge>
          )}
          <Badge variant="outline" className={["rounded-full", dueDateStatusClasses.badge].join(" ")}>
            {getDueDateStatusLabel(dueDateStatus)}
          </Badge>
        </div>
      </div>
    </DialogHeader>
  );
}

export function KanbanCardLocationContext({ card }: { card: KanbanCardView }) {
  const issues = card.locationWarnings ?? [];
  const topics = card.locationTopics ?? [];
  return (
    <>
      {issues.length > 0 && (
        <div className="flex items-start gap-2 rounded-control border border-warning/30 bg-warning-muted px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            На связанных площадках есть проблемы высокой важности:{" "}
            {issues.map((issue) => `${issue.locationName}: ${issue.title}`).join(", ")}.
          </span>
        </div>
      )}
      {topics.length > 0 && (
        <div className="rounded-control border border-primary/25 bg-primary/5 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-primary">
            <MessageSquare className="h-4 w-4" />
            Активные темы связанных площадок
          </div>
          <div className="space-y-1">
            {topics.map((topic) => (
              <a
                key={topic.id}
                href={`/locations?locationId=${encodeURIComponent(topic.locationId)}&topicId=${encodeURIComponent(topic.id)}`}
                className="block text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {topic.locationName}: {topic.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

interface KanbanCardMetadataProps {
  card: KanbanCardView;
  list: KanbanListView | null;
  labels: KanbanLabelView[];
  creatorName: string;
  expanded: boolean;
  className: string;
}

export function KanbanCardMetadata({
  card,
  list,
  labels,
  creatorName,
  expanded,
  className,
}: KanbanCardMetadataProps) {
  const subtaskProgress = getSubtaskProgress(card.subtasks);
  const dueDateStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList(list) });
  const labelById = new Map(labels.map((label) => [label.id, label]));
  return (
    <div className={expanded ? className : "hidden"}>
      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <p>Подзадачи: {subtaskProgress.completed}/{subtaskProgress.total}</p>
        <p>Создатель: {creatorName}</p>
        <p>Позиция в списке: {Number(card.position) + 1}</p>
        <p>Старт: {formatDueDateLabel(card.startDate) || "Не задан"}</p>
        <p>Статус срока: {getDueDateStatusLabel(dueDateStatus)}</p>
        <p>Срок: {formatDueDateLabel(card.dueDate) || "Не задан"}</p>
        <p>Создана: {formatDueDateLabel(card.createdAt) || "Неизвестно"}</p>
        <p>Обновлена: {formatDueDateLabel(card.updatedAt) || "Еще не обновлялась"}</p>
      </div>
      {normalizeLabelIds(card.labelIds).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {normalizeLabelIds(card.labelIds).map((labelId) => {
            const label = labelById.get(labelId);
            if (!label) return null;
            return (
              <Badge
                key={label.id}
                variant="outline"
                className="rounded-full border-transparent"
                style={{
                  backgroundColor: label.color || "var(--muted)",
                  color: "var(--foreground)",
                }}
              >
                {label.name}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
