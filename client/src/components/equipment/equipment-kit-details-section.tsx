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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/25">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-200">
              <Package className="h-4 w-4" />
              Состав комплекта
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-emerald-300 bg-white/80 text-emerald-800 hover:bg-white dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
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
                className="flex items-stretch overflow-hidden rounded-md border border-emerald-200/70 bg-white dark:border-emerald-900/70 dark:bg-slate-900"
              >
                <button
                  type="button"
                  aria-label={`Открыть «${component.name}»`}
                  disabled={!component.live}
                  onClick={() => component.live && onOpenComponent(equipment.id, component.live)}
                  className="min-w-0 flex-1 px-3 py-2 text-left text-xs transition hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 disabled:cursor-default disabled:opacity-70 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                    {component.name}
                    {component.live && isSuperPosition(component.live) && (
                      <Badge className="bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Комплект
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-slate-500 dark:text-slate-400">
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
                    className="h-auto w-11 shrink-0 rounded-none border-l border-emerald-200/70 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-emerald-900/70 dark:hover:bg-red-950/20"
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
              <div className="rounded-md border border-dashed border-emerald-300 px-3 py-5 text-center text-xs text-emerald-800/80 dark:border-emerald-800 dark:text-emerald-300/80">
                В комплекте пока нет позиций. Нажмите «Добавить».
              </div>
            )}
          </div>
        </div>
      )}

      {parentBundleName && (
        <div className={cn(
          "flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
          parentBundleExists
            ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-200"
            : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200",
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
              className="border-blue-300 bg-white/70 text-blue-800 hover:bg-white dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
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
