import { Clock, History, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatEquipmentDateTime } from "@/lib/equipment-view-model";

export interface WarehouseHistoryItem {
  id: string;
  equipmentName: string;
  model?: string | null;
}

export interface WarehouseHistoryGroup {
  id: string;
  status: string;
  tone: string;
  date: Date | null;
  location?: string | null;
  note?: string;
  items: WarehouseHistoryItem[];
}

interface WarehouseHistorySheetProps {
  open: boolean;
  groups: WarehouseHistoryGroup[];
  onOpenChange: (open: boolean) => void;
}

export function WarehouseHistorySheet({
  open,
  groups,
  onOpenChange,
}: WarehouseHistorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-0 flex-1 border-slate-300 dark:border-slate-600 sm:flex-none">
          <History className="mr-1.5 h-4 w-4 sm:mr-2" />
          Моя история
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="px-4 pt-4">Моя история склада</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {groups.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Пока нет выдач и запросов.
            </div>
          ) : groups.map((group) => (
            <div key={group.id} className="rounded-md border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium leading-snug text-slate-900 dark:text-white">
                    {group.items.length === 1
                      ? group.items[0].equipmentName
                      : `${group.items.length} позиций оборудования`}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {group.items.slice(0, 8).map((item) => (
                      <div key={item.id} className="break-words">
                        {item.equipmentName}{item.model ? ` · ${item.model}` : ""}
                      </div>
                    ))}
                    {group.items.length > 8 && <div>+ ещё {group.items.length - 8}</div>}
                  </div>
                </div>
                <Badge variant={group.tone === "rejected" ? "destructive" : "outline"} className="shrink-0">
                  {group.status}
                </Badge>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {group.date && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Забрал: {formatEquipmentDateTime(group.date.toISOString())}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Вернул: {group.status.includes("Сейчас") ? "пока на руках" : "по отметке склада"}
                </div>
                {group.location && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{group.location}</span>
                  </div>
                )}
                {group.note && (
                  <div className="break-words text-slate-600 dark:text-slate-300">{group.note}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
