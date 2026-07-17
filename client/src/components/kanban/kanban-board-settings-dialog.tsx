import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KanbanBoardSettingsDialogProps {
  open: boolean;
  boardName?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}

export function KanbanBoardSettingsDialog({
  open,
  boardName,
  children,
  onOpenChange,
}: KanbanBoardSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/50 bg-card p-0 shadow-2xl shadow-black/10 text-card-foreground">
        <DialogHeader className="border-b border-border/35 bg-muted/20 px-6 py-5">
          <DialogTitle>Настройки доски</DialogTitle>
          <DialogDescription>
            {boardName
              ? `${boardName}: участники и палитра меток.`
              : "Выберите доску, чтобы управлять настройками."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">{children}</div>

        <DialogFooter className="border-t border-border/35 bg-muted/20 px-6 py-4">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
