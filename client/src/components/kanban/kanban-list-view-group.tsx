import type { CSSProperties, ReactNode } from "react";
import { Draggable, Droppable, type DraggableStyle } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamSelect } from "@/components/ui/stream-select";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";
import { KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

export interface KanbanListViewGroupItem {
  id: string;
  title: string;
  cards: KanbanCardView[];
  droppableListId?: string | null;
}

interface KanbanListViewGroupProps {
  group: KanbanListViewGroupItem;
  lists: KanbanListView[];
  droppableId: string | null;
  draftValue: string;
  draftListId: string;
  canEdit: boolean;
  savePending: boolean;
  cardEditPending: boolean;
  onDraftChange: (value: string) => void;
  onDraftListChange: (listId: string) => void;
  onResetDraft: () => void;
  onSubmitDraft: () => void;
  renderCard: (card: KanbanCardView) => ReactNode;
}

const getDraggableStyle = (style: DraggableStyle | undefined): CSSProperties | undefined =>
  style as CSSProperties | undefined;

export function KanbanListViewGroup({
  group,
  lists,
  droppableId,
  draftValue,
  draftListId,
  canEdit,
  savePending,
  cardEditPending,
  onDraftChange,
  onDraftListChange,
  onResetDraft,
  onSubmitDraft,
  renderCard,
}: KanbanListViewGroupProps) {
  const cards = group.cards.map((card, index) =>
    droppableId ? (
      <Draggable key={card.id} draggableId={`card:${card.id}`} index={index} isDragDisabled={!canEdit || cardEditPending}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={getDraggableStyle(provided.draggableProps.style)}
          >
            {renderCard(card)}
          </div>
        )}
      </Draggable>
    ) : (
      <div key={card.id}>{renderCard(card)}</div>
    ),
  );

  const cardList = group.cards.length === 0 ? (
    <div className="px-3 py-4 text-sm text-muted-foreground">В этой группе пока нет задач.</div>
  ) : cards;

  return (
    <section className="overflow-hidden rounded-surface border border-border/50 bg-surface-raised shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/25 px-3 py-2.5">
        <h3 className="font-semibold">{group.title}</h3>
        <Badge variant="secondary" className="rounded-full">{group.cards.length}</Badge>
      </div>
      {canEdit && (
        <div className="grid gap-2 border-b border-border/20 px-3 py-2.5 md:grid-cols-[minmax(180px,1fr)_minmax(140px,220px)_auto]">
          <Input
            value={draftValue}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Новая задача"
            className={KANBAN_PANEL_INPUT_CLASS}
            disabled={savePending || lists.length === 0}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onResetDraft();
                return;
              }
              if (event.key !== "Enter") return;
              event.preventDefault();
              onSubmitDraft();
            }}
          />
          <StreamSelect
            ariaLabel={`Список для новой задачи в группе ${group.title}`}
            value={draftListId}
            options={lists.length === 0
              ? [{ value: "", label: "Нет списков", disabled: true }]
              : lists.map((list) => ({ value: list.id, label: list.name }))}
            onValueChange={onDraftListChange}
            disabled={Boolean(group.droppableListId) || savePending || lists.length === 0}
          />
          <Button
            className="rounded-control"
            onClick={onSubmitDraft}
            disabled={!draftValue.trim() || !draftListId || savePending}
          >
            <Plus className="mr-1 h-4 w-4" />
            Добавить
          </Button>
        </div>
      )}
      {droppableId ? (
        <Droppable droppableId={droppableId} type="CARD">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[72px] space-y-2 p-2">
              {cardList}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      ) : (
        <div className="space-y-2 p-2">{cardList}</div>
      )}
    </section>
  );
}
