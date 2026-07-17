import type { Equipment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEquipmentCategoryLabel } from "@/lib/equipment-view-model";

interface CategoryOption {
  value: string;
  label: string;
}

interface EquipmentBundleCreateDialogProps {
  open: boolean;
  name: string;
  categoryId: string;
  categoryOptions: CategoryOption[];
  items: Equipment[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onCategoryIdChange: (categoryId: string) => void;
  onSubmit: (input: { name: string; categoryId: string | null; items: Equipment[] }) => void;
}

export function EquipmentBundleCreateDialog({
  open,
  name,
  categoryId,
  categoryOptions,
  items,
  pending,
  onOpenChange,
  onNameChange,
  onCategoryIdChange,
  onSubmit,
}: EquipmentBundleCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Создать супер позицию</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Выбранные позиции будут объединены в одну складскую карточку, а комплектующие пометятся как входящие в сборку.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="bundle-name">
              Название сборки
            </label>
            <Input
              id="bundle-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Например: PC ECHO_1, комплект режиссерского ПК"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Категория</label>
            <Select value={categoryId} onValueChange={onCategoryIdChange}>
              <SelectTrigger aria-label="Категория сборки" className="bg-white dark:bg-slate-800">
                <SelectValue placeholder="Без категории" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без категории</SelectItem>
                {categoryOptions
                  .filter((option) => option.value.startsWith("category:"))
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value.slice("category:".length)}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="mb-2 text-sm font-medium text-slate-900 dark:text-white">Состав: {items.length}</div>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                  <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                    {[item.model, item.inventoryNumber].filter(Boolean).join(" · ") || getEquipmentCategoryLabel(item)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={pending || items.length < 2 || !name.trim()}
              onClick={() => onSubmit({
                name,
                categoryId: categoryId === "none" ? null : categoryId,
                items,
              })}
            >
              {pending ? "Сборка..." : "Создать сборку"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
