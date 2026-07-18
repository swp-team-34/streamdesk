import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { BoardCompletionSummary } from "@/lib/kanban-board-model";

export interface BoardCompletionGroup {
  id: string;
  title: string;
  hint?: string;
  summary: BoardCompletionSummary;
}

export interface BoardCompletionSection {
  id: string;
  title: string;
  description: string;
  emptyLabel: string;
  groups: BoardCompletionGroup[];
}

export interface KanbanBoardCompletionStats {
  overview: BoardCompletionSummary;
  sections: BoardCompletionSection[];
}

interface KanbanBoardStatsDialogProps {
  open: boolean;
  boardName?: string | null;
  loading: boolean;
  stats: KanbanBoardCompletionStats;
  onOpenChange: (open: boolean) => void;
}

export function KanbanBoardStatsDialog({
  open,
  boardName,
  loading,
  stats,
  onOpenChange,
}: KanbanBoardStatsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto border-border/50 bg-surface-overlay p-0 text-foreground shadow-overlay">
        <DialogHeader className="border-b border-border/50 bg-surface-subtle px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Статистика доски
          </DialogTitle>
          <DialogDescription>
            {boardName
              ? `${boardName}: текущий completion level по карточкам доски.`
              : "Выберите доску, чтобы увидеть статистику."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          {loading ? (
            <div className="space-y-4" aria-label="Загрузка статистики">
              <div className="h-28 animate-pulse rounded-surface bg-surface-subtle" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-44 animate-pulse rounded-surface bg-surface-subtle" />
                <div className="h-44 animate-pulse rounded-surface bg-surface-subtle" />
              </div>
            </div>
          ) : !boardName ? (
            <div className="rounded-surface border border-border/50 bg-surface-subtle p-6 text-sm text-muted-foreground">
              Доска не выбрана.
            </div>
          ) : stats.overview.total === 0 ? (
            <div className="rounded-surface border border-border/50 bg-surface-subtle p-6 text-sm text-muted-foreground">
              На этой доске пока нет задач. Completion level появится после создания первой карточки.
            </div>
          ) : (
            <>
              <div className="rounded-surface border border-border/50 bg-surface-subtle p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Общий completion level</p>
                    <div className="mt-1 text-4xl font-semibold">{stats.overview.percent}%</div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {stats.overview.completed}/{stats.overview.total} завершено
                    </div>
                    <div>Completed = списки Closed или Archive</div>
                  </div>
                </div>
                <Progress value={stats.overview.percent} className="mt-4 h-2 rounded-full" />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {stats.sections.map((section) => (
                  <div key={section.id} className="rounded-surface border border-border/50 bg-surface-subtle p-4">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                    </div>

                    {section.groups.length === 0 ? (
                      <div className="rounded-control border border-dashed border-border/50 bg-surface-raised p-4 text-sm text-muted-foreground">
                        {section.emptyLabel}
                      </div>
                    ) : (
                      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                        {section.groups.map((group) => (
                          <div key={group.id} className="rounded-control border border-border/50 bg-surface-raised p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{group.title}</div>
                                {group.hint && (
                                  <div className="truncate text-xs text-muted-foreground">{group.hint}</div>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-sm font-semibold">{group.summary.percent}%</div>
                                <div className="text-xs text-muted-foreground">
                                  {group.summary.completed}/{group.summary.total}
                                </div>
                              </div>
                            </div>
                            <Progress value={group.summary.percent} className="mt-3 h-1.5 rounded-full" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border/50 bg-surface-subtle px-6 py-4">
          <Button variant="outline" className="rounded-control" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
