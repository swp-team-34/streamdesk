import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KANBAN_PANEL_INPUT_CLASS } from "@/components/kanban/kanban-styles";

interface KanbanInlineListCreatorProps {
  open: boolean;
  title: string;
  pending: boolean;
  onOpen: () => void;
  onTitleChange: (title: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function KanbanInlineListCreator({
  open,
  title,
  pending,
  onOpen,
  onTitleChange,
  onCancel,
  onSubmit,
}: KanbanInlineListCreatorProps) {
  return (
    <Card className="task-board-column flex w-[calc(100vw-2.5rem)] shrink-0 items-stretch rounded-surface border border-dashed border-border/50 bg-surface-raised shadow-xs sm:w-[320px]">
      <CardContent className="flex w-full flex-col justify-start p-4">
        {open ? (
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Название столбца"
              autoFocus
              disabled={pending}
              className={KANBAN_PANEL_INPUT_CLASS}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancel();
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              onBlur={() => {
                if (!title.trim()) onCancel();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={onCancel}>
                Отмена
              </Button>
              <Button
                size="sm"
                className="rounded-control"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onSubmit}
                disabled={!title.trim() || pending}
              >
                Создать
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-control text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            onClick={onOpen}
            disabled={pending}
          >
            <Plus className="h-5 w-5" />
            Новый столбец
          </button>
        )}
      </CardContent>
    </Card>
  );
}
