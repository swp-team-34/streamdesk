import { ArrowUpDown, Check, Layers3, LayoutList, Settings2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { StreamSelect } from "@/components/ui/stream-select";
import type { TaskManagerSortBy, TaskManagerSortDirection } from "@/lib/task-manager-sort";
import { KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

export type BoardViewMode = "kanban" | "list";
export type BoardListGrouping = "none" | "list" | "due" | "assignee" | "priority" | `field:${string}`;

const CARD_SORT_LABELS: Record<TaskManagerSortBy, string> = {
  position: "Порядок доски",
  deadline: "Срок",
  priority: "Приоритет",
  createdAt: "Создано",
  updatedAt: "Обновлено",
  title: "Название",
};

const CARD_SORT_DIRECTION_LABELS: Record<TaskManagerSortDirection, string> = {
  asc: "По возрастанию",
  desc: "По убыванию",
};

interface KanbanBoardToolbarProps {
  selectedBoard?: { name: string; description?: string | null } | null;
  search: string;
  sortBy: TaskManagerSortBy;
  sortDirection: TaskManagerSortDirection;
  hasActiveFilters: boolean;
  viewMode: BoardViewMode;
  listGrouping: BoardListGrouping;
  customFields: Array<{ id: string; name: string }>;
  onSearchChange: (value: string) => void;
  onSortByChange: (value: TaskManagerSortBy) => void;
  onSortDirectionChange: (value: TaskManagerSortDirection) => void;
  onOpenFilters: () => void;
  onViewModeChange: (value: BoardViewMode) => void;
  onListGroupingChange: (value: BoardListGrouping) => void;
}

export function KanbanBoardToolbar({
  selectedBoard,
  search,
  sortBy,
  sortDirection,
  hasActiveFilters,
  viewMode,
  listGrouping,
  customFields,
  onSearchChange,
  onSortByChange,
  onSortDirectionChange,
  onOpenFilters,
  onViewModeChange,
  onListGroupingChange,
}: KanbanBoardToolbarProps) {
  return (
    <CardHeader className="gap-3 px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-xl sm:text-2xl">
            {selectedBoard ? `Доска: ${selectedBoard.name}` : "Выберите доску"}
          </CardTitle>
          <CardDescription>
            {selectedBoard
              ? selectedBoard.description || "У доски пока нет описания."
              : "Выберите доску в верхнем списке, чтобы увидеть ее поток задач, списки и карточки."}
          </CardDescription>
        </div>
        {selectedBoard && (
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 lg:w-auto lg:items-end">
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
              <div className="relative min-w-0 lg:w-[320px] lg:flex-none">
                <Input
                  id="kanban-board-search"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Поиск карточек"
                  className={`${KANBAN_PANEL_INPUT_CLASS} pr-9`}
                />
                {search && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8 rounded-lg text-muted-foreground"
                    onClick={() => onSearchChange("")}
                    aria-label="Очистить поиск"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-0 gap-2 rounded-control border-border/50 bg-surface-base px-3"
                    aria-label="Сортировка карточек"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="hidden sm:inline">{CARD_SORT_LABELS[sortBy]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Сортировка</DropdownMenuLabel>
                  {(Object.keys(CARD_SORT_LABELS) as TaskManagerSortBy[]).map((sortKey) => (
                    <DropdownMenuItem key={sortKey} onClick={() => onSortByChange(sortKey)} className="justify-between">
                      <span>{CARD_SORT_LABELS[sortKey]}</span>
                      {sortBy === sortKey && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Направление</DropdownMenuLabel>
                  {(Object.keys(CARD_SORT_DIRECTION_LABELS) as TaskManagerSortDirection[]).map((direction) => (
                    <DropdownMenuItem
                      key={direction}
                      disabled={sortBy === "deadline"}
                      onClick={() => onSortDirectionChange(direction)}
                      className="justify-between"
                    >
                      <span>{CARD_SORT_DIRECTION_LABELS[direction]}</span>
                      {sortDirection === direction && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  {sortBy === "deadline" && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Срок всегда сортируется: просрочено, ближайшие будущие, без срока.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="min-w-0 gap-2 rounded-control border-border/50 bg-surface-base px-3"
                onClick={onOpenFilters}
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Фильтры</span>
                {hasActiveFilters && <Badge variant="secondary" className="rounded-full">Активны</Badge>}
              </Button>
              <div className="col-span-3 inline-flex w-full rounded-control border border-border/45 bg-surface-subtle p-1 lg:col-span-1 lg:w-auto">
                <Button
                  variant={viewMode === "kanban" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 gap-2 rounded-control lg:flex-none"
                  onClick={() => onViewModeChange("kanban")}
                >
                  <Layers3 className="h-4 w-4" />
                  Kanban
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 gap-2 rounded-control lg:flex-none"
                  onClick={() => onViewModeChange("list")}
                >
                  <LayoutList className="h-4 w-4" />
                  List
                </Button>
              </div>
              {viewMode === "list" && (
                <StreamSelect
                  ariaLabel="Группировка списка"
                  className="col-span-3 w-full lg:col-span-1 lg:w-[220px]"
                  value={listGrouping}
                  options={[
                    { value: "none", label: "Без группировки" },
                    { value: "list", label: "По списку" },
                    { value: "due", label: "По сроку" },
                    { value: "assignee", label: "По исполнителю" },
                    { value: "priority", label: "По приоритету" },
                    ...(customFields.length > 0
                      ? [{ value: "__custom-fields-divider__", label: "Поля карточек", disabled: true }]
                      : []),
                    ...customFields.map((field) => ({ value: `field:${field.id}`, label: `По полю: ${field.name}` })),
                  ]}
                  onValueChange={(value) => onListGroupingChange(value as BoardListGrouping)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </CardHeader>
  );
}
