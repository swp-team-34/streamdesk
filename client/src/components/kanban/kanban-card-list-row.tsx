import { AlertTriangle, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamSelect } from "@/components/ui/stream-select";
import {
  getDueDateStatus,
  getDueDateStatusClasses,
  getDueDateStatusLabel,
  formatDueDateLabel,
} from "@/lib/task-dates";
import { formatPluralRu } from "@/lib/plural-ru";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";
import {
  CARD_PRIORITY_BADGE_VARIANTS,
  CARD_PRIORITY_LABELS,
} from "@/lib/kanban-presentation";
import {
  KANBAN_BOARD_GHOST_BADGE_CLASS,
  KANBAN_PANEL_INPUT_CLASS,
} from "./kanban-styles";

interface KanbanCardListLabel {
  id: string;
  name: string;
  color?: string | null;
}

interface KanbanCardListCustomField {
  id: string;
  name: string;
  value: string;
}

interface KanbanCardListRowProps {
  card: KanbanCardView;
  list?: KanbanListView;
  lists: KanbanListView[];
  labels: KanbanCardListLabel[];
  customFields: KanbanCardListCustomField[];
  assigneeName: string;
  equipmentLinkCount: number;
  canEdit: boolean;
  inlineEditing: boolean;
  inlineTitle: string;
  savePending: boolean;
  movePending: boolean;
  deletePending: boolean;
  onInlineTitleChange: (value: string) => void;
  onBeginInlineEdit: () => void;
  onCancelInlineEdit: () => void;
  onCommitInlineEdit: () => void;
  onMove: (targetListId: string) => void;
  onOpen: () => void;
  onDelete: () => void;
}

export function KanbanCardListRow({
  card,
  list,
  lists,
  labels,
  customFields,
  assigneeName,
  equipmentLinkCount,
  canEdit,
  inlineEditing,
  inlineTitle,
  savePending,
  movePending,
  deletePending,
  onInlineTitleChange,
  onBeginInlineEdit,
  onCancelInlineEdit,
  onCommitInlineEdit,
  onMove,
  onOpen,
  onDelete,
}: KanbanCardListRowProps) {
  const dueDateStatus = getDueDateStatus(card.dueDate, {
    isComplete: list?.type === "closed" || list?.type === "archive" || list?.type === "trash",
  });
  const dueDateStatusClasses = getDueDateStatusClasses(dueDateStatus);

  return (
    <div
      className={[
        "grid gap-2 rounded-surface border border-l-4 px-3 py-2.5 text-sm shadow-xs transition-colors sm:grid-cols-2 lg:grid-cols-[minmax(180px,1.6fr)_minmax(140px,180px)_auto_minmax(120px,160px)_auto_auto] lg:items-center",
        dueDateStatusClasses.card || "border-border/50 bg-surface-raised hover:bg-surface-overlay",
      ].join(" ")}
    >
      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        {inlineEditing ? (
          <Input
            value={inlineTitle}
            onChange={(event) => onInlineTitleChange(event.target.value)}
            autoFocus
            className={KANBAN_PANEL_INPUT_CLASS}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelInlineEdit();
              }
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitInlineEdit();
              }
            }}
            onBlur={onCommitInlineEdit}
            disabled={savePending}
          />
        ) : (
          <button
            type="button"
            className="block max-w-full truncate text-left font-medium text-foreground hover:underline"
            title={canEdit ? "Двойной клик для переименования" : card.title}
            onDoubleClick={onBeginInlineEdit}
          >
            {card.title}
          </button>
        )}
        {card.description && <div className="mt-1 truncate text-xs text-muted-foreground">{card.description}</div>}
        {equipmentLinkCount > 0 && (
          <Badge variant="outline" className="mt-1.5 w-fit rounded-full border-border/40 bg-surface-subtle text-xs text-muted-foreground">
            Оборудование: {formatPluralRu(equipmentLinkCount, "позиция", "позиции", "позиций")}
          </Badge>
        )}
        {(card.commentCount ?? 0) > 0 && (
          <Badge variant="outline" className="mt-1.5 w-fit gap-1 rounded-full border-border/40 bg-surface-subtle text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {card.commentCount}
            {card.latestCommentAt && <span>· {formatDueDateLabel(card.latestCommentAt)}</span>}
          </Badge>
        )}
        {(card.locationTopics?.length ?? 0) > 0 && (
          <a
            href={`/locations?locationId=${encodeURIComponent(card.locationTopics![0].locationId)}&topicId=${encodeURIComponent(card.locationTopics![0].id)}`}
            onClick={(event) => event.stopPropagation()}
            className="mt-1.5 flex w-fit items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/15"
          >
            <MessageSquare className="h-3 w-3" />
            Темы площадки: {card.locationTopics?.length}
          </a>
        )}
        {list?.type === "active" && (card.locationWarnings?.length ?? 0) > 0 && (
          <Badge variant="destructive" className="mt-1.5 w-fit gap-1 rounded-full text-xs">
            <AlertTriangle className="h-3 w-3" />
            Проблемы площадки: {card.locationWarnings?.length}
          </Badge>
        )}
        {customFields.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {customFields.map((field) => (
              <span key={field.id} className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                {field.name}: {field.value}
              </span>
            ))}
          </div>
        )}
      </div>
      <StreamSelect
        ariaLabel={`Список для ${card.title}`}
        className="min-w-0"
        value={card.listId}
        options={lists.map((item) => ({ value: item.id, label: item.name }))}
        onValueChange={onMove}
        disabled={!canEdit || movePending}
      />
      <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[card.priority]} className="w-fit rounded-full">
        {CARD_PRIORITY_LABELS[card.priority]}
      </Badge>
      <span className="min-w-0 truncate text-muted-foreground">{assigneeName}</span>
      <Badge variant="outline" className={["w-fit rounded-full", dueDateStatusClasses.badge].join(" ")}>
        {getDueDateStatusLabel(dueDateStatus)}
      </Badge>
      <div className="flex items-center justify-end gap-1 sm:col-span-2 lg:col-span-1">
        {labels.slice(0, 2).map((label) => (
          <span
            key={label.id}
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: label.color || "var(--muted)" }}
            title={label.name}
          />
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-control"
          onClick={onOpen}
          aria-label="Изменить карточку"
          title="Изменить карточку"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-control text-error hover:bg-error-muted hover:text-error"
            onClick={onDelete}
            disabled={deletePending}
            aria-label="Удалить карточку"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
