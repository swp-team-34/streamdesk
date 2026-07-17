import type { Equipment } from "@shared/schema";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface EquipmentKitSafetyEntry {
  item: Equipment;
  bundle: Equipment;
  active: boolean;
  projectId?: string;
  projectName?: string;
}

interface EquipmentKitSafetyDialogProps {
  entries: EquipmentKitSafetyEntry[];
  actionLabel: string;
  reason: string;
  overridePhrase: string;
  canOverrideActiveKit: boolean;
  requestPending: boolean;
  onReasonChange: (value: string) => void;
  onOverridePhraseChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onRequestManager: (entries: EquipmentKitSafetyEntry[], reason: string) => void;
}

export function EquipmentKitSafetyDialog({
  entries,
  actionLabel,
  reason,
  overridePhrase,
  canOverrideActiveKit,
  requestPending,
  onReasonChange,
  onOverridePhraseChange,
  onClose,
  onConfirm,
  onRequestManager,
}: EquipmentKitSafetyDialogProps) {
  const activeEntries = entries.filter((entry) => entry.active);
  const hasActiveEntries = activeEntries.length > 0;
  const overrideConfirmed = overridePhrase.trim().toLocaleUpperCase("ru-RU") === "ИЗВЛЕЧЬ";

  return (
    <Dialog open={entries.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            Компонент входит в комплект
          </DialogTitle>
          <DialogDescription>
            Для действия «{actionLabel}» сначала нужно явно извлечь компонент. Состав и автор операции будут записаны в историю.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-52 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {entries.map((entry) => (
              <div key={entry.item.id} className={cn(
                "rounded-control border px-3 py-2 text-sm",
                entry.active
                  ? "border-error/30 bg-error-muted"
                  : "border-warning/30 bg-warning-muted",
              )}>
                <div className="font-medium text-foreground">{entry.item.name}</div>
                <div className="mt-1 text-muted-foreground">
                  Комплект: <span className="font-medium">{entry.bundle.name}</span>
                </div>
                {entry.active && (
                  <div className="mt-1 flex items-start gap-1.5 font-medium text-error">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Комплект используется{entry.projectName || entry.projectId
                        ? ` в проекте «${entry.projectName || entry.projectId}»`
                        : ""}.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="kit-safety-reason">
              Причина или контекст
            </label>
            <Textarea
              id="kit-safety-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Например: замена неисправного компонента"
              className="min-h-20 resize-y"
            />
          </div>

          {hasActiveEntries && canOverrideActiveKit && (
            <div className="space-y-2 rounded-control border border-error/30 bg-error-muted p-3">
              <label className="text-sm font-medium text-error" htmlFor="kit-safety-override">
                Для override активного комплекта введите ИЗВЛЕЧЬ
              </label>
              <Input
                id="kit-safety-override"
                value={overridePhrase}
                onChange={(event) => onOverridePhraseChange(event.target.value)}
                placeholder="ИЗВЛЕЧЬ"
                autoComplete="off"
              />
            </div>
          )}

          {hasActiveEntries && !canOverrideActiveKit ? (
            <div className="space-y-3">
              <div className="rounded-control border border-border/50 bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
                Активный комплект может изменить только менеджер или администратор. До решения состав останется без изменений.
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onClose}>Оставить в комплекте</Button>
                <Button
                  type="button"
                  disabled={requestPending}
                  onClick={() => onRequestManager(activeEntries, reason)}
                >
                  {requestPending ? "Отправка..." : "Отправить запрос менеджеру"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>Оставить в комплекте</Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={hasActiveEntries && !overrideConfirmed}
              >
                Извлечь и продолжить
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
