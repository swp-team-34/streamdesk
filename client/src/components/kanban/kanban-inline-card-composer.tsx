import { Plus, WandSparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KANBAN_PANEL_INPUT_CLASS } from "@/components/kanban/kanban-styles";
import {
  insertKanbanMention,
  type KanbanSmartInputResult,
  type KanbanSmartUser,
} from "@/lib/kanban-smart-input";

interface KanbanInlineCardComposerProps {
  open: boolean;
  value: string;
  smartInput: KanbanSmartInputResult;
  mentionSuggestions: KanbanSmartUser[];
  pending: boolean;
  onOpen: () => void;
  onChange: (value: string) => void;
  onCancelToken: (tokenId: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function KanbanInlineCardComposer({
  open,
  value,
  smartInput,
  mentionSuggestions,
  pending,
  onOpen,
  onChange,
  onCancelToken,
  onCancel,
  onSubmit,
}: KanbanInlineCardComposerProps) {
  return (
    <div className="rounded-control border border-border/40 bg-surface-raised p-2 shadow-xs">
      {open ? (
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Задача завтра 14:00 высокий приоритет @user"
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
              if (!value.trim()) onCancel();
            }}
          />
          {mentionSuggestions.length > 0 && (
            <div className="rounded-control border border-border/50 bg-surface-overlay p-1 shadow-overlay">
              {mentionSuggestions.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-control px-2 py-1.5 text-left text-sm hover:bg-surface-subtle"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChange(insertKanbanMention(value, user.username || user.name))}
                >
                  <span>{user.name}</span>
                  {user.username && <span className="text-xs text-muted-foreground">@{user.username}</span>}
                </button>
              ))}
            </div>
          )}
          {smartInput.tokens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {smartInput.tokens.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-xs text-primary"
                  title="Нажмите, чтобы оставить эту фразу обычным текстом"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onCancelToken(token.id)}
                >
                  <WandSparkles className="h-3 w-3" />
                  {token.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          {smartInput.errors.map((error) => (
            <p key={error} className="text-xs text-destructive">{error}</p>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={onCancel}>
              Отмена
            </Button>
            <Button
              size="sm"
            className="rounded-control"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onSubmit}
              disabled={!smartInput.title.trim() || smartInput.errors.length > 0 || pending}
            >
              Добавить
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={onOpen}
          disabled={pending}
        >
          <Plus className="h-4 w-4" />
          Добавить задачу
        </button>
      )}
    </div>
  );
}
