import type { Equipment } from "@shared/schema";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isSuperPosition } from "@/lib/equipment-kit-model";
import { getEquipmentCategoryLabel } from "@/lib/equipment-view-model";
import { cn } from "@/lib/utils";

export interface EquipmentKitOperationalContext {
  active: boolean;
  projectId?: string;
  projectName?: string;
}

interface EquipmentKitAddDialogProps {
  bundle: Equipment | null;
  candidates: Equipment[];
  selectedIds: Set<string>;
  search: string;
  reason: string;
  approvalPhrase: string;
  operationalContext: EquipmentKitOperationalContext | null;
  canOverrideActiveKit: boolean;
  pending: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelectedIdsChange: (value: Set<string>) => void;
  onReasonChange: (value: string) => void;
  onApprovalPhraseChange: (value: string) => void;
  onSubmit: (input: {
    bundleId: string;
    equipmentIds: string[];
    reason: string;
    activeKitApproval: boolean;
  }) => void;
}

export function EquipmentKitAddDialog({
  bundle,
  candidates,
  selectedIds,
  search,
  reason,
  approvalPhrase,
  operationalContext,
  canOverrideActiveKit,
  pending,
  onClose,
  onSearchChange,
  onSelectedIdsChange,
  onReasonChange,
  onApprovalPhraseChange,
  onSubmit,
}: EquipmentKitAddDialogProps) {
  const active = Boolean(operationalContext?.active);
  const confirmationValid = !active ||
    approvalPhrase.trim().toLocaleUpperCase("ru-RU") === "ДОБАВИТЬ";
  const submitDisabled = pending ||
    selectedIds.size === 0 ||
    (active && !canOverrideActiveKit) ||
    !confirmationValid;

  return (
    <Dialog open={Boolean(bundle)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-xl flex-col overflow-hidden bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Добавить в комплект</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            {bundle
              ? `Выберите оборудование для «${bundle.name}». Можно вложить и другой комплект.`
              : "Выберите оборудование для комплекта."}
          </DialogDescription>
        </DialogHeader>

        {bundle && (
          <div className="flex min-h-0 flex-col gap-4">
            {active && (
              <div className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                canOverrideActiveKit
                  ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/25 dark:text-red-200"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200",
              )}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Комплект используется{operationalContext?.projectName || operationalContext?.projectId
                      ? ` в проекте «${operationalContext.projectName || operationalContext.projectId}»`
                      : ""}.
                    {canOverrideActiveKit
                      ? " Добавление будет записано как изменение активного состава."
                      : " Изменить активный состав может только менеджер или администратор."}
                  </span>
                </div>
              </div>
            )}

            <Input
              aria-label="Поиск оборудования для комплекта"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск по названию, модели или инвентарному номеру"
            />

            <div className="min-h-0 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {candidates.length > 0 ? candidates.map((item) => {
                const checked = selectedIds.has(item.id);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition",
                      checked
                        ? "border-primary/50 bg-primary/5"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
                    )}
                  >
                    <Checkbox
                      aria-label={`Выбрать «${item.name}»`}
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        const next = new Set(selectedIds);
                        if (nextChecked === true) next.add(item.id);
                        else next.delete(item.id);
                        onSelectedIdsChange(next);
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                        {item.name}
                        {isSuperPosition(item) && (
                          <Badge className="bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Комплект
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        {[item.model, item.inventoryNumber].filter(Boolean).join(" · ") || getEquipmentCategoryLabel(item)}
                      </span>
                    </span>
                  </label>
                );
              }) : (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {search.trim()
                    ? "По вашему запросу нет доступных позиций."
                    : "Нет доступного исправного оборудования, которое можно добавить в этот комплект."}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="kit-add-reason">
                Причина или контекст
              </label>
              <Textarea
                id="kit-add-reason"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Например: доукомплектование для выезда"
                className="min-h-20 resize-y"
              />
            </div>

            {active && canOverrideActiveKit && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/25">
                <label className="text-sm font-medium text-red-800 dark:text-red-200" htmlFor="kit-add-approval">
                  Для изменения активного комплекта введите ДОБАВИТЬ
                </label>
                <Input
                  id="kit-add-approval"
                  value={approvalPhrase}
                  onChange={(event) => onApprovalPhraseChange(event.target.value)}
                  placeholder="ДОБАВИТЬ"
                  autoComplete="off"
                />
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
              <Button
                type="button"
                disabled={submitDisabled}
                onClick={() => onSubmit({
                  bundleId: bundle.id,
                  equipmentIds: [...selectedIds],
                  reason: reason.trim(),
                  activeKitApproval: active,
                })}
              >
                {pending ? "Добавление..." : `Добавить (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
