import {
  AlertTriangle,
  Archive,
  ArrowDown,
  Copy,
  GripVertical,
  Layers3,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  getSubtaskProgress,
  normalizeLabelIds,
  type KanbanCardView,
  type KanbanCustomFieldDefinition,
  type KanbanLabelView,
  type KanbanListView,
} from "@/lib/kanban-board-model";
import {
  CARD_PRIORITY_BADGE_VARIANTS,
  CARD_PRIORITY_LABELS,
  formatCustomFieldValue,
} from "@/lib/kanban-presentation";
import {
  formatDueDateLabel,
  getDueDateStatus,
  getDueDateStatusClasses,
  getDueDateStatusLabel,
} from "@/lib/task-dates";
import { getKanbanCardAssigneeUserIds } from "@shared/kanban-card-roles";
import { KANBAN_BOARD_GHOST_BADGE_CLASS, KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

interface KanbanBoardCardProps {
  card: KanbanCardView;
  list: KanbanListView;
  lists: KanbanListView[];
  customFields: KanbanCustomFieldDefinition[];
  userById: ReadonlyMap<string, { name: string }>;
  labelById: ReadonlyMap<string, KanbanLabelView>;
  equipmentLinkCount: number;
  canEdit: boolean;
  inlineEditing: boolean;
  inlineTitle: string;
  cardPending: boolean;
  movePending: boolean;
  detailLoading: boolean;
  isDragging: boolean;
  isDropAnimating: boolean;
  listTint?: string;
  listCardTint?: string;
  onInlineTitleChange: (value: string) => void;
  onBeginInlineTitleEdit: () => void;
  onCancelInlineTitleEdit: () => void;
  onCommitInlineTitleEdit: () => void;
  onOpenDetail: (expanded?: boolean) => void;
  onDuplicate: () => void;
  onMove: (targetListId: string) => void;
  onDelete: () => void;
}

const stopInteractiveEvent = (event: {
  stopPropagation: () => void;
  preventDefault?: () => void;
}) => {
  event.stopPropagation();
  event.preventDefault?.();
};

const stopEventPropagation = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

export function KanbanBoardCard({
  card,
  list,
  lists,
  customFields,
  userById,
  labelById,
  equipmentLinkCount,
  canEdit,
  inlineEditing,
  inlineTitle,
  cardPending,
  movePending,
  detailLoading,
  isDragging,
  isDropAnimating,
  listTint,
  listCardTint,
  onInlineTitleChange,
  onBeginInlineTitleEdit,
  onCancelInlineTitleEdit,
  onCommitInlineTitleEdit,
  onOpenDetail,
  onDuplicate,
  onMove,
  onDelete,
}: KanbanBoardCardProps) {
  const isCompleteLikeList = list.type === "closed" || list.type === "archive" || list.type === "trash";
  const dueDateLabel = formatDueDateLabel(card.dueDate);
  const dueDateStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList });
  const dueDateStatusClasses = getDueDateStatusClasses(dueDateStatus);
  const subtaskProgress = getSubtaskProgress(card.subtasks);
  const assigneeName = getKanbanCardAssigneeUserIds(card)
    .map((userId) => userById.get(userId)?.name || userId)
    .join(", ") || null;
  const cardLabels = normalizeLabelIds(card.labelIds)
    .map((labelId) => labelById.get(labelId))
    .filter((label): label is KanbanLabelView => Boolean(label));
  const visibleCustomFields = customFields.flatMap((field) => {
    if (field.showOnCard === false) return [];
    const value = formatCustomFieldValue(field, card.customFieldValues?.[field.id], userById);
    return value ? [{ id: field.id, name: field.name, value }] : [];
  });
  const archiveList = lists.find((targetList) => targetList.type === "archive" && targetList.id !== card.listId);

  return (
    <div
      className={[
        "group w-full select-none space-y-3 rounded-surface border p-3 text-card-foreground shadow-xs transition-[box-shadow,border-color,background-color] duration-150 ease-out sm:p-3.5",
        dueDateStatusClasses.card,
        isDragging
          ? "border-primary/40 shadow-overlay ring-2 ring-primary/15"
          : isDropAnimating
            ? "border-primary/30 shadow-surface"
            : "hover:border-border/80 hover:shadow-surface",
      ].join(" ").trim()}
      style={{
        background: isDragging
          ? `linear-gradient(180deg, var(--kanban-drag-card-start), ${listTint || "var(--kanban-card-end)"})`
          : `linear-gradient(180deg, var(--kanban-card-start), ${listCardTint || "var(--kanban-card-end)"})`,
        borderLeftColor: list.color || undefined,
        borderLeftWidth: list.color ? 2 : undefined,
      }}
      onDoubleClick={(event) => {
        const target = event.target;
        const interactiveTarget = target instanceof Element
          ? target.closest("button, a, input, textarea, select, [role='button'], [role='menuitem'], [contenteditable='true'], .task-drag-handle")
          : null;
        if (interactiveTarget && event.currentTarget.contains(interactiveTarget)) return;
        event.stopPropagation();
        onOpenDetail();
      }}
    >
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-2">
              {canEdit && (
                <div
                  className="task-drag-handle shrink-0 self-center rounded-xl p-1.5 text-muted-foreground transition group-hover:text-foreground"
                  style={{ backgroundColor: listTint || "var(--muted)" }}
                >
                  <GripVertical className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 space-y-1">
                {inlineEditing ? (
                  <Input
                    value={inlineTitle}
                    onChange={(event) => onInlineTitleChange(event.target.value)}
                    autoFocus
                    className={KANBAN_PANEL_INPUT_CLASS}
                    onMouseDown={stopInteractiveEvent}
                    onPointerDown={stopInteractiveEvent}
                    onTouchStart={stopInteractiveEvent}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        onCancelInlineTitleEdit();
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onCommitInlineTitleEdit();
                      }
                    }}
                    onBlur={onCommitInlineTitleEdit}
                    disabled={cardPending}
                  />
                ) : (
                  <p
                    className="font-medium break-words text-foreground"
                    title={canEdit ? "Двойной клик для переименования" : undefined}
                    onDoubleClick={(event) => {
                      stopInteractiveEvent(event);
                      onBeginInlineTitleEdit();
                    }}
                  >
                    {card.title}
                  </p>
                )}
                {card.description && (
                  <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap break-words">
                    {card.description}
                  </p>
                )}
              </div>
            </div>
            <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[card.priority]} className="rounded-full">
              {CARD_PRIORITY_LABELS[card.priority]}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={["rounded-full", dueDateStatusClasses.badge].join(" ")}>
              {getDueDateStatusLabel(dueDateStatus)}
            </Badge>
            {(card.locationTopics?.length ?? 0) > 0 && (
              <a
                href={`/locations?locationId=${encodeURIComponent(card.locationTopics![0].locationId)}&topicId=${encodeURIComponent(card.locationTopics![0].id)}`}
                onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/15"
              >
                <MessageSquare className="h-3 w-3" />
                Темы: {card.locationTopics?.length}
              </a>
            )}
            {list.type === "active" && (card.locationWarnings?.length ?? 0) > 0 && (
              <Badge variant="destructive" className="gap-1 rounded-full">
                <AlertTriangle className="h-3 w-3" />
                Площадка: {card.locationWarnings?.length}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>#{Number(card.position) + 1}</span>
            {assigneeName && <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>Исполнители: {assigneeName}</span>}
            {card.responsibleUserId && (
              <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                Ответственный: {userById.get(card.responsibleUserId)?.name || card.responsibleUserId}
              </span>
            )}
            {dueDateLabel && <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>Срок: {dueDateLabel}</span>}
            {subtaskProgress.total > 0 && (
              <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                Подзадачи: {subtaskProgress.completed}/{subtaskProgress.total}
              </span>
            )}
            {equipmentLinkCount > 0 && (
              <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>Оборудование: {equipmentLinkCount}</span>
            )}
            {(card.commentCount ?? 0) > 0 && (
              <span className={`${KANBAN_BOARD_GHOST_BADGE_CLASS} inline-flex items-center gap-1`}>
                <MessageSquare className="h-3 w-3" />
                Комментарии: {card.commentCount}
                {card.latestCommentAt && ` · ${formatDueDateLabel(card.latestCommentAt)}`}
              </span>
            )}
            {card.locations?.map((location) => (
              <span key={location.id} className={KANBAN_BOARD_GHOST_BADGE_CLASS}>Площадка: {location.name}</span>
            ))}
          </div>

          {cardLabels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cardLabels.map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="gap-1 rounded-full border-transparent"
                  style={{
                    backgroundColor: label.color || "var(--muted)",
                    color: "var(--foreground)",
                  }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          )}

          {visibleCustomFields.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {visibleCustomFields.map((field) => (
                <span key={field.id} className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                  {field.name}: {field.value}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 border-l border-border/35 pl-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-control text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Быстрое редактирование"
            title="Быстрое редактирование"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail();
            }}
            onMouseDown={stopEventPropagation}
            onPointerDown={stopEventPropagation}
            onTouchStart={stopEventPropagation}
            disabled={detailLoading}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-control text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Действия с карточкой"
                title="Действия с карточкой"
                onClick={stopEventPropagation}
                onMouseDown={stopEventPropagation}
                onPointerDown={stopEventPropagation}
                onTouchStart={stopEventPropagation}
                disabled={detailLoading}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => onOpenDetail(true)}>
                <Layers3 className="mr-2 h-4 w-4" />
                Открыть все детали
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={onDuplicate} disabled={cardPending}>
                    <Copy className="mr-2 h-4 w-4" />
                    Дублировать
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowDown className="mr-2 h-4 w-4 -rotate-90" />
                      Переместить
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {lists.map((targetList) => (
                        <DropdownMenuItem
                          key={targetList.id}
                          disabled={targetList.id === card.listId || movePending}
                          onClick={() => onMove(targetList.id)}
                        >
                          {targetList.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {archiveList && (
                    <DropdownMenuItem onClick={() => onMove(archiveList.id)} disabled={movePending}>
                      <Archive className="mr-2 h-4 w-4" />
                      Архивировать
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                    disabled={cardPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
