import { Check, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UserOption {
  id: string;
  name: string;
  username?: string | null;
}

interface KanbanUserMultiSelectProps {
  id?: string;
  users: UserOption[];
  value: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string[]) => void;
}

export function KanbanUserMultiSelect({
  id,
  users,
  value,
  disabled,
  placeholder = "Без исполнителей",
  onChange,
}: KanbanUserMultiSelectProps) {
  const selected = new Set(value.map(String));
  const selectedUsers = value.map((userId) =>
    users.find((user) => user.id === userId) ?? {
      id: userId,
      name: `Недоступный участник (${userId})`,
      username: null,
    },
  );

  const toggle = (userId: string) => {
    if (selected.has(userId)) {
      onChange(value.filter((currentId) => currentId !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-10 w-full justify-between rounded-xl border-border/35 bg-muted/20 px-3 font-normal"
          >
            <span className={selectedUsers.length ? "" : "text-muted-foreground"}>
              {selectedUsers.length ? `Выбрано: ${selectedUsers.length}` : placeholder}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[220] w-[min(92vw,320px)] p-2">
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {users.map((user) => {
              const isSelected = selected.has(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onClick={() => toggle(user.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.name}</span>
                    {user.username && (
                      <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
                    )}
                  </span>
                  <Check className={`h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                </button>
              );
            })}
            {users.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">Нет доступных участников.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.slice(0, 5).map((user) => (
            <Badge key={user.id} variant="secondary" className="gap-1 rounded-full">
              {user.name}
              {!disabled && (
                <button type="button" aria-label={`Убрать ${user.name}`} onClick={() => toggle(user.id)}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {selectedUsers.length > 5 && (
            <Badge variant="outline" className="rounded-full">+{selectedUsers.length - 5}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
