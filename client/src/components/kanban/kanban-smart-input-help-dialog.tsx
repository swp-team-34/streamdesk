import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KanbanSmartInputHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KanbanSmartInputHelpDialog({
  open,
  onOpenChange,
}: KanbanSmartInputHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50 bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>Умный ввод карточки</DialogTitle>
          <DialogDescription>
            Контрольные фразы распознаются локально и показываются отдельными чипами до сохранения.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-border/35 bg-muted/20 p-3">
            <code>Подготовить эфир завтра 14:00 высокий приоритет @tim</code>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Даты: сегодня, завтра, дни недели, следующая неделя, 21.07 или 2026-07-21.</li>
            <li>Диапазон: «с сегодня 14:00 до завтра 16:00».</li>
            <li>Приоритет: low/medium/high/urgent или русский эквивалент.</li>
            <li>Исполнитель: начните ввод с @ и выберите участника компании.</li>
            <li>Нажмите на распознанный чип, чтобы оставить фразу обычным текстом.</li>
          </ul>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Понятно</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
