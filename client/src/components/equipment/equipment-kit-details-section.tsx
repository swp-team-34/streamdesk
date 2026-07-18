import type { Equipment } from "@shared/schema";
import { Package, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getBundleComponents,
  getParentBundleId,
  getParentBundleName,
  isSuperPosition,
} from "@/lib/equipment-kit-model";
import {
  getEquipmentCategoryLabel,
  getEquipmentOperabilityClass,
  getEquipmentOperabilityLabel,
  getEquipmentStatusClass,
  getEquipmentStatusLabel,
} from "@/lib/equipment-view-model";
import { cn } from "@/lib/utils";

interface EquipmentKitDetailsSectionProps {
  equipment: Equipment;
  allEquipment: Equipment[];
  canEdit: boolean;
  removePending: boolean;
  onAdd: (bundle: Equipment) => void;
  onOpenComponent: (bundleId: string, component: Equipment) => void;
  onRemove: (bundle: Equipment, component: Equipment) => void;
  onOpenParent: (component: Equipment) => void;
}

export function EquipmentKitDetailsSection({
  equipment,
  allEquipment,
  canEdit,
  removePending,
  onAdd,
  onOpenComponent,
  onRemove,
  onOpenParent,
}: EquipmentKitDetailsSectionProps) {
  const components = isSuperPosition(equipment)
    ? getBundleComponents(equipment, allEquipment)
    : [];
  const parentBundleName = getParentBundleName(equipment);
  const parentBundleId = getParentBundleId(equipment);
  const parentBundleExists = Boolean(
    parentBundleId && allEquipment.some((item) => item.id === parentBundleId),
  );

  return (
    <>
      {isSuperPosition(equipment) && (
        <div className="rounded-surface border border-success/25 bg-success-muted p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-success">
              <Package className="h-4 w-4" />
              Состав комплекта
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-success/30 bg-surface-raised text-success hover:bg-surface-overlay"
                onClick={() => onAdd(equipment)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Добавить
              </Button>
            )}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {components.length > 0 ? components.map((component, index) => (
              <div
                key={component.id || index}
                className="flex items-stretch overflow-hidden rounded-control border border-success/20 bg-surface-raised"
              >
                <button
                  type="button"
                  aria-label={`Открыть «${component.name}»`}
                  disabled={!component.live}
                  onClick={() => component.live && onOpenComponent(equipment.id, component.live)}
                  className="min-w-0 flex-1 px-3 py-2 text-left text-xs transition hover:bg-success-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-success/30 disabled:cursor-default disabled:opacity-70"
                >
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                    {component.name}
                    {component.live && isSuperPosition(component.live) && (
                      <Badge className="border-success/20 bg-success-muted text-[10px] text-success">
                        Комплект
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    {[component.model, component.inventoryNumber].filter(Boolean).join(" · ") ||
                      getEquipmentCategoryLabel(component.live || ({ type: component.type } as Equipment))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge className={`${getEquipmentStatusClass(component.status)} text-[10px]`}>
                      {getEquipmentStatusLabel(component.status)}
                    </Badge>
                    <Badge className={`${getEquipmentOperabilityClass(component.operabilityStatus)} text-[10px]`}>
                      {getEquipmentOperabilityLabel(component.operabilityStatus)}
                    </Badge>
                  </div>
                </button>
                {canEdit && component.live && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-auto w-11 shrink-0 rounded-none border-l border-success/20 text-error hover:bg-error-muted hover:text-error"
                    disabled={removePending}
                    title="Убрать из комплекта"
                    aria-label={`Убрать «${component.name}» из комплекта`}
                    onClick={() => onRemove(equipment, component.live!)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )) : (
              <div className="rounded-control border border-dashed border-success/30 px-3 py-5 text-center text-xs text-success">
                В комплекте пока нет позиций. Нажмите «Добавить».
              </div>
            )}
          </div>
        </div>
      )}

      {parentBundleName && (
        <div className={cn(
          "flex flex-col gap-2 rounded-surface border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
          parentBundleExists
            ? "border-info/25 bg-info-muted text-info"
            : "border-warning/25 bg-warning-muted text-warning",
        )}>
          <span>
            {parentBundleExists ? (
              <>Входит в комплект: <span className="font-medium">{parentBundleName}</span></>
            ) : (
              <>Сборка «<span className="font-medium">{parentBundleName}</span>» удалена. Старая связь очистится автоматически при следующем действии.</>
            )}
          </span>
          {parentBundleExists && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-info/30 bg-surface-raised text-info hover:bg-surface-overlay"
              onClick={() => onOpenParent(equipment)}
            >
              Открыть комплект
            </Button>
          )}
        </div>
      )}
    </>
  );
}
