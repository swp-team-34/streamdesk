import type { ReactNode } from "react";
import { Link2, ListChecks, MessageSquare } from "lucide-react";
import { KanbanCardDetailHeader } from "@/components/kanban/kanban-card-detail-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";
import { cn } from "@/lib/utils";

export type KanbanDetailSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export type KanbanDetailTab = "overview" | "resources" | "activity";

interface KanbanCardDetailDialogProps {
  open: boolean;
  card: KanbanCardView | null;
  list: KanbanListView | null;
  formTitle: string;
  saveStatus: KanbanDetailSaveStatus;
  saveError: string;
  children: ReactNode;
  defaultTab?: KanbanDetailTab;
  onClose: () => void;
}

interface KanbanCardDetailTabContentProps {
  value: KanbanDetailTab;
  children: ReactNode;
  className?: string;
}

export function KanbanCardDetailTabContent({
  value,
  children,
  className,
}: KanbanCardDetailTabContentProps) {
  return (
    <TabsContent
      value={value}
      className={cn(
        "m-0 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable] focus-visible:ring-inset sm:px-5 sm:py-5",
        className,
      )}
    >
      {children}
    </TabsContent>
  );
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
  defaultTab = "overview",
  onClose,
}: KanbanCardDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,1080px)] max-w-6xl flex-col overflow-hidden border-border/60 bg-surface-overlay p-0 text-card-foreground shadow-overlay">
        {!card ? (
          <>
            <DialogHeader className="border-b border-border/50 bg-surface-subtle px-6 py-5">
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
            <Tabs
              key={`${card.id}:${defaultTab}`}
              defaultValue={defaultTab}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="shrink-0 border-b border-border/50 bg-surface-overlay px-4 py-2 sm:px-5">
                <TabsList className="grid w-full grid-cols-3 sm:inline-grid sm:w-auto">
                  <TabsTrigger value="overview" className="gap-2 px-3">
                    <ListChecks className="h-4 w-4" />
                    Основное
                  </TabsTrigger>
                  <TabsTrigger value="resources" className="gap-2 px-3">
                    <Link2 className="h-4 w-4" />
                    Связи
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-2 px-3">
                    <MessageSquare className="h-4 w-4" />
                    Активность
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
            </Tabs>
            <div className="flex shrink-0 flex-col gap-3 border-t border-border/50 bg-surface-overlay px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground" role="status">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full bg-muted-foreground/45",
                    saveStatus === "saving" && "animate-pulse bg-info",
                    saveStatus === "saved" && "bg-success",
                    saveStatus === "dirty" && "bg-warning",
                    saveStatus === "error" && "bg-error",
                  )}
                />
                <span className="truncate">{getSaveStatusText(saveStatus, formTitle, saveError)}</span>
              </div>
              <div className="flex shrink-0 justify-end">
                <Button variant="outline" onClick={onClose}>Закрыть</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
