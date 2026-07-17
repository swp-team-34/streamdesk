import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KANBAN_PANEL_INPUT_CLASS } from "@/components/kanban/kanban-styles";
import type { KanbanLabelView } from "@/lib/kanban-board-model";

interface KanbanCardLabelsEditorProps {
  labels: KanbanLabelView[];
  selectedLabelIds: string[];
  query: string;
  canEdit: boolean;
  loading: boolean;
  saveLabelPending: boolean;
  saveCardPending: boolean;
  onQueryChange: (value: string) => void;
  onAttach: (labelId: string) => void;
  onRemove: (labelId: string) => void;
  onCreate: () => void;
}

export function KanbanCardLabelsEditor({
  labels,
  selectedLabelIds,
  query,
  canEdit,
  loading,
  saveLabelPending,
  saveCardPending,
  onQueryChange,
  onAttach,
  onRemove,
  onCreate,
}: KanbanCardLabelsEditorProps) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const labelById = new Map(labels.map((label) => [label.id, label]));
  const matchingLabels = labels.filter((label) => {
    if (selectedLabelIds.includes(label.id)) return false;
    return !normalizedQuery || label.name.toLocaleLowerCase("ru").includes(normalizedQuery);
  });
  const exactMatch = normalizedQuery
    ? labels.find((label) => label.name.toLocaleLowerCase("ru") === normalizedQuery) ?? null
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor="kanban-detail-label-query">Метки</label>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedLabelIds.map((labelId) => {
          const label = labelById.get(labelId);
          if (!label) return null;
          return (
            <button
              key={label.id}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-sm"
              style={{
                backgroundColor: label.color || "var(--muted)",
                color: "var(--foreground)",
              }}
              onClick={() => onRemove(label.id)}
              disabled={!canEdit}
              title="Снять метку"
            >
              <Tag className="h-3.5 w-3.5" />
              {label.name}
              <span aria-hidden>×</span>
            </button>
          );
        })}
        {selectedLabelIds.length === 0 && (
          <span className="rounded-2xl border border-dashed border-border/40 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            У карточки пока нет меток.
          </span>
        )}
      </div>

      {canEdit && (
        <div className="space-y-2 rounded-2xl border border-border/35 bg-muted/20 p-3">
          <Input
            id="kanban-detail-label-query"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Найти или создать метку"
            disabled={saveLabelPending}
            className={KANBAN_PANEL_INPUT_CLASS}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (exactMatch) onAttach(exactMatch.id);
              else onCreate();
            }}
          />
          <div className="flex flex-wrap gap-2">
            {matchingLabels.slice(0, 8).map((label) => (
              <button
                key={label.id}
                type="button"
                className="rounded-full border border-border/35 px-3 py-1.5 text-sm transition hover:border-border"
                style={{ backgroundColor: label.color || "var(--muted)" }}
                onClick={() => onAttach(label.id)}
                disabled={saveCardPending}
              >
                {label.name}
              </button>
            ))}
            {query.trim() && !exactMatch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={onCreate}
                disabled={saveLabelPending}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Создать “{query.trim()}”
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
