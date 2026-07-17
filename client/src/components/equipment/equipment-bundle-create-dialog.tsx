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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Создать супер позицию</DialogTitle>
          <DialogDescription>
            Выбранные позиции будут объединены в одну складскую карточку, а комплектующие пометятся как входящие в сборку.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="bundle-name">
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
            <label className="text-sm font-medium text-foreground">Категория</label>
            <Select value={categoryId} onValueChange={onCategoryIdChange}>
              <SelectTrigger aria-label="Категория сборки">
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

          <div className="rounded-control border border-border/50 bg-surface-subtle p-3">
            <div className="mb-2 text-sm font-medium text-foreground">Состав: {items.length}</div>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="rounded-control border border-border/40 bg-surface-raised px-3 py-2 text-xs shadow-xs">
                  <div className="font-medium text-foreground">{item.name}</div>
                  <div className="mt-0.5 text-muted-foreground">
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
