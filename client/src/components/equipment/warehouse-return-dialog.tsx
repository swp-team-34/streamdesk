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
import type { WarehouseStorageLocationOption } from "./warehouse-settings";

export interface WarehouseReturnSelection {
  storageLocationId: string | null;
  storageLocation: string | null;
}

interface WarehouseReturnDialogProps {
  equipment: Equipment | null;
  storageLocations: WarehouseStorageLocationOption[];
  storageChoice: string;
  manualStorage: string;
  pending: boolean;
  onStorageChoiceChange: (value: string) => void;
  onManualStorageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (selection: WarehouseReturnSelection) => void;
}

export function WarehouseReturnDialog({
  equipment,
  storageLocations,
  storageChoice,
  manualStorage,
  pending,
  onStorageChoiceChange,
  onManualStorageChange,
  onClose,
  onSubmit,
}: WarehouseReturnDialogProps) {
  const submitDisabled = pending ||
    storageChoice === "none" ||
    (storageChoice === "manual" && !manualStorage.trim());

  return (
    <Dialog
      open={Boolean(equipment)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle>Вернуть оборудование</DialogTitle>
          <DialogDescription>
            Укажите, куда положить «{equipment?.name || "оборудование"}» после возврата.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={storageChoice} onValueChange={onStorageChoiceChange}>
            <SelectTrigger aria-label="Место хранения">
              <SelectValue placeholder="Комната, стеллаж или полка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Выберите место хранения</SelectItem>
              {storageLocations
                .filter((location) =>
                  !location.archivedAt ||
                  String(location.id) === String(equipment?.storageLocationId || ""),
                )
                .map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.path || location.name}{location.archivedAt ? " · в архиве" : ""}
                  </SelectItem>
                ))}
              <SelectItem value="manual">Указать вручную</SelectItem>
            </SelectContent>
          </Select>
          {storageChoice === "manual" && (
            <Input
              aria-label="Место хранения вручную"
              value={manualStorage}
              onChange={(event) => onManualStorageChange(event.target.value)}
              placeholder="Например: комната 204, стеллаж B, полка 3"
            />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button
              disabled={submitDisabled}
              onClick={() => onSubmit({
                storageLocationId: storageChoice === "manual" ? null : storageChoice,
                storageLocation: storageChoice === "manual" ? manualStorage.trim() : null,
              })}
            >
              {pending ? "Возврат..." : "Вернуть на склад"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
