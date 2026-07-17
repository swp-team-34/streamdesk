import type { ReactNode } from "react";
import { KanbanCardDetailHeader } from "@/components/kanban/kanban-card-detail-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";

export type KanbanDetailSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface KanbanCardDetailDialogProps {
  open: boolean;
  card: KanbanCardView | null;
  list: KanbanListView | null;
  formTitle: string;
  saveStatus: KanbanDetailSaveStatus;
  saveError: string;
  children: ReactNode;
  onClose: () => void;
}

function getSaveStatusText(status: KanbanDetailSaveStatus, title: string, error: string): string {
  if (status === "saving") return "Сохраняется...";
  if (status === "saved") return "Сохранено";
  if (status === "dirty") {
    return title.trim() ? "Есть несохраненные изменения" : "Введите название, чтобы сохранить";
  }
  if (status === "error") return `Ошибка сохранения: ${error}`;
  return "Изменения сохраняются автоматически";
}

export function KanbanCardDetailDialog({
  open,
  card,
  list,
  formTitle,
  saveStatus,
  saveError,
  children,
  onClose,
}: KanbanCardDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,760px)] max-w-3xl flex-col overflow-hidden border-border/50 bg-card p-0 shadow-2xl shadow-black/10 text-card-foreground">
        {!card ? (
          <>
            <DialogHeader className="border-b border-border/35 bg-muted/20 px-6 py-5">
              <DialogTitle>Карточка</DialogTitle>
              <DialogDescription>Загружаем детали карточки...</DialogDescription>
            </DialogHeader>
            <div className="px-6 py-8 text-sm text-muted-foreground">
              Подождите, данные карточки загружаются.
            </div>
          </>
        ) : (
          <>
            <KanbanCardDetailHeader card={card} list={list} />
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">{children}</div>
            <div className="flex shrink-0 flex-col gap-3 border-t border-border/35 bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm text-muted-foreground" role="status">
                {getSaveStatusText(saveStatus, formTitle, saveError)}
              </div>
              <div className="flex shrink-0 justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={onClose}>Закрыть</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
