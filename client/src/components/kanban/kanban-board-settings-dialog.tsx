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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/50 bg-surface-overlay p-0 text-foreground shadow-overlay">
        <DialogHeader className="border-b border-border/50 bg-surface-subtle px-6 py-5">
          <DialogTitle>Настройки доски</DialogTitle>
          <DialogDescription>
            {boardName
              ? `${boardName}: участники и палитра меток.`
              : "Выберите доску, чтобы управлять настройками."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">{children}</div>

        <DialogFooter className="border-t border-border/50 bg-surface-subtle px-6 py-4">
          <Button variant="outline" className="rounded-control" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
