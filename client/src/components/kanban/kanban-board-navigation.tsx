import {
  BarChart3,
  Check,
  ChevronDown,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPluralRu } from "@/lib/plural-ru";

export interface KanbanBoardNavigationItem {
  id: string;
  name: string;
  description?: string | null;
  companyId?: string | null;
  canManage?: boolean;
}

interface KanbanBoardNavigationProps {
  boards: KanbanBoardNavigationItem[];
  boardsLoading: boolean;
  selectedBoardId: string | null;
  selectedBoard?: KanbanBoardNavigationItem | null;
  canEditSelectedBoard: boolean;
  listCount: number;
  overdueCardsCount: number;
  createMenuOpen: boolean;
  boardMutationPending: boolean;
  onSelectBoard: (boardId: string) => void;
  onCreateMenuOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onCreateBoard: () => void;
  onCreateList: () => void;
  onCreateCard: () => void;
  onOpenStats: () => void;
  onOpenSmartInputHelp: () => void;
  onEditBoard: () => void;
  onDeleteBoard: () => void;
}

export function KanbanBoardNavigation({
  boards,
  boardsLoading,
  selectedBoardId,
  selectedBoard,
  canEditSelectedBoard,
  listCount,
  overdueCardsCount,
  createMenuOpen,
  boardMutationPending,
  onSelectBoard,
  onCreateMenuOpenChange,
  onOpenSettings,
  onCreateBoard,
  onCreateList,
  onCreateCard,
  onOpenStats,
  onOpenSmartInputHelp,
  onEditBoard,
  onDeleteBoard,
}: KanbanBoardNavigationProps) {
  const personalBoards = boards.filter((board) => !board.companyId);
  const sharedBoards = boards.filter((board) => Boolean(board.companyId));

  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-surface border border-border/50 bg-surface-raised p-2 shadow-xs">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 min-w-0 max-w-full flex-1 justify-between gap-2 rounded-control border-border/50 bg-surface-base sm:max-w-[320px] sm:flex-none">
              <span className="min-w-0 truncate">
                {boardsLoading ? "Загрузка досок..." : selectedBoard?.name || "Выберите доску"}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {boards.length === 0 ? (
              <DropdownMenuItem disabled>Досок пока нет</DropdownMenuItem>
            ) : (
              <>
                {([["Личные", personalBoards], ["Командные", sharedBoards]] as const).map(([title, items]) =>
                  items.length > 0 ? (
                    <div key={title}>
                      <DropdownMenuLabel>{title}</DropdownMenuLabel>
                      {items.map((board) => (
                        <DropdownMenuItem key={board.id} onClick={() => onSelectBoard(board.id)} className="justify-between">
                          <span className="min-w-0 truncate">{board.name}</span>
                          {board.id === selectedBoardId && <Check className="h-4 w-4 text-primary" />}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ) : null,
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedBoard && (
          <span className="hidden max-w-[420px] truncate text-sm text-muted-foreground md:inline">
            {selectedBoard.description || "Без описания"}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {selectedBoard?.canManage && (
          <Button variant="outline" size="icon" className="hidden h-9 w-9 rounded-control border-border/50 bg-surface-base md:inline-flex" onClick={onOpenSettings} aria-label="Настройки доски" title="Настройки доски">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}

        <DropdownMenu open={createMenuOpen} onOpenChange={onCreateMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-9 w-9 rounded-control" aria-label="Создать">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreateBoard}>Создать доску</DropdownMenuItem>
            <DropdownMenuItem disabled={!canEditSelectedBoard} onClick={onCreateList}>
              Создать столбец
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canEditSelectedBoard || listCount === 0} onClick={onCreateCard}>
              Создать карточку
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-control border-border/50 bg-surface-base" aria-label="Действия доски">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Действия</DropdownMenuLabel>
            <DropdownMenuItem disabled={!selectedBoard} onClick={onOpenStats}>
              <BarChart3 className="h-4 w-4" />
              Статистика доски
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!selectedBoard} onClick={onOpenSmartInputHelp}>
              <HelpCircle className="h-4 w-4" />
              Подсказка умного ввода
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Всего: {formatPluralRu(boards.length, "доска", "доски", "досок")}</DropdownMenuItem>
            <DropdownMenuItem disabled>Личных: {formatPluralRu(personalBoards.length, "доска", "доски", "досок")}</DropdownMenuItem>
            <DropdownMenuItem disabled>Просрочено: {formatPluralRu(overdueCardsCount, "карточка", "карточки", "карточек")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!selectedBoard?.canManage} onClick={onEditBoard}>
              <Pencil className="h-4 w-4" />
              Изменить доску
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!selectedBoard?.canManage} onClick={onOpenSettings}>
              <Settings2 className="h-4 w-4" />
              Настройки доски
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!selectedBoard?.canManage || boardMutationPending}
              className="text-destructive focus:text-destructive"
              onClick={onDeleteBoard}
            >
              <Trash2 className="h-4 w-4" />
              Удалить доску
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
