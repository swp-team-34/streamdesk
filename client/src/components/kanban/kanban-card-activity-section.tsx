import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KanbanCardHistoryView } from "@/lib/kanban-board-model";
import { getKanbanHistoryActionLabel } from "@/lib/kanban-presentation";
import { formatDueDateLabel } from "@/lib/task-dates";

interface KanbanCardActivitySectionProps {
  entries: KanbanCardHistoryView[];
  loading: boolean;
  expanded: boolean;
  getUserName: (userId: string) => string;
  getChangeLines: (entry: KanbanCardHistoryView) => string[];
  onToggleExpanded: () => void;
}

export function KanbanCardActivitySection({
  entries,
  loading,
  expanded,
  getUserName,
  getChangeLines,
  onToggleExpanded,
}: KanbanCardActivitySectionProps) {
  const visibleEntries = expanded ? entries : entries.slice(0, 3);
  const hiddenCount = Math.max(0, entries.length - visibleEntries.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Activity Log</h3>
          {entries.length > 0 && (
            <Badge variant="outline" className="rounded-full border-border/40 bg-muted/30 text-xs text-muted-foreground">
              {entries.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-xs text-muted-foreground">Обновляем историю...</span>
          )}
          {entries.length > 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl text-xs text-muted-foreground"
              onClick={onToggleExpanded}
            >
              {expanded ? "Свернуть" : `Показать все (${hiddenCount})`}
              <ChevronDown
                className={[
                  "ml-1 h-3.5 w-3.5 transition-transform",
                  expanded ? "rotate-180" : "",
                ].join(" ")}
              />
            </Button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          Для этой карточки пока нет записанной истории.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map((entry) => {
            const changeLines = getChangeLines(entry);
            return (
              <div key={entry.id} className="rounded-2xl border border-border/35 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {getUserName(entry.userId)}
                  </div>
                  <div className="rounded-full border border-border/35 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                    {formatDueDateLabel(entry.createdAt) || "Неизвестное время"}
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {getKanbanHistoryActionLabel(entry.action)}
                </p>
                {changeLines.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {changeLines.map((line, index) => (
                      <div
                        key={`${entry.id}-${index}`}
                        className="rounded-xl border border-border/35 bg-background/70 px-3 py-2 text-sm"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
