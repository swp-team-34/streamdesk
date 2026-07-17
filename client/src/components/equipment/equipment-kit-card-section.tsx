import type { KeyboardEvent, MouseEvent } from "react";
import type { Equipment } from "@shared/schema";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBundleComponents, isSuperPosition } from "@/lib/equipment-kit-model";
import {
  getEquipmentOperabilityClass,
  getEquipmentOperabilityLabel,
  getEquipmentStatusClass,
  getEquipmentStatusLabel,
} from "@/lib/equipment-view-model";

export interface EquipmentProjectReturnInfo {
  returnDate: string;
  returnTime?: string;
}

interface EquipmentKitCardSectionProps {
  bundle: Equipment;
  allEquipment: Equipment[];
  expanded: boolean;
  canEdit: boolean;
  removePending: boolean;
  fallbackProject?: EquipmentProjectReturnInfo;
  getProjectInfo: (equipmentId: string) => EquipmentProjectReturnInfo | undefined;
  getAssignedUserName: (assignedTo: string | null | undefined) => string;
  isReturnOverdue: (returnDate: string, returnTime?: string) => boolean;
  onToggle: () => void;
  onAdd: (bundle: Equipment) => void;
  onOpen: (bundleId: string, component: Equipment) => void;
  onRemove: (bundle: Equipment, component: Equipment) => void;
}

export function EquipmentKitCardSection({
  bundle,
  allEquipment,
  expanded,
  canEdit,
  removePending,
  fallbackProject,
  getProjectInfo,
  getAssignedUserName,
  isReturnOverdue,
  onToggle,
  onAdd,
  onOpen,
  onRemove,
}: EquipmentKitCardSectionProps) {
  if (!isSuperPosition(bundle)) return null;
  const components = getBundleComponents(bundle, allEquipment);
  const stopPropagation = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

  return (
    <div
      className="border-t border-slate-200 pt-2 dark:border-slate-700"
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 min-w-0 flex-1 justify-between px-2 text-xs"
          aria-expanded={expanded}
          aria-controls={`bundle-components-${bundle.id}`}
          onClick={onToggle}
        >
          <span>Состав: {components.length}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            title="Добавить в комплект"
            aria-label={`Добавить позицию в «${bundle.name}»`}
            onClick={() => onAdd(bundle)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      {expanded && (
        <div
          id={`bundle-components-${bundle.id}`}
          className="mt-2 max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1"
        >
          {components.length > 0 ? components.map((component, index) => {
            const componentProject = getProjectInfo(component.id) || fallbackProject;
            const overdue = componentProject
              ? isReturnOverdue(componentProject.returnDate, componentProject.returnTime)
              : false;
            const holder = getAssignedUserName(component.assignedTo);
            return (
              <div
                key={component.id || `${bundle.id}-${index}`}
                className="flex items-stretch overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60"
              >
                <button
                  type="button"
                  aria-label={`Открыть «${component.name}»`}
                  disabled={!component.live}
                  onClick={() => component.live && onOpen(bundle.id, component.live)}
                  className="min-w-0 flex-1 px-2.5 py-2 text-left transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-70 dark:hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-medium text-slate-900 dark:text-white">
                      {component.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {component.inventoryNumber || "без инв. №"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge className={`${getEquipmentStatusClass(component.status)} text-[10px]`}>
                      {getEquipmentStatusLabel(component.status)}
                    </Badge>
                    <Badge className={`${getEquipmentOperabilityClass(component.operabilityStatus)} text-[10px]`}>
                      {getEquipmentOperabilityLabel(component.operabilityStatus)}
                    </Badge>
                    {component.live && isSuperPosition(component.live) && (
                      <Badge className="bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Комплект
                      </Badge>
                    )}
                    {componentProject && (
                      <Badge className="bg-violet-100 text-[10px] text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                        На проекте
                      </Badge>
                    )}
                    {overdue && (
                      <Badge className="bg-red-100 text-[10px] text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Просрочено
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 break-words text-[11px] text-slate-500 dark:text-slate-400">
                    {holder ? `У сотрудника: ${holder}` : component.location ? `Хранение: ${component.location}` : "Место не указано"}
                  </div>
                </button>
                {canEdit && component.live && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-auto w-10 shrink-0 rounded-none border-l border-slate-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-950/20"
                    disabled={removePending}
                    title="Убрать из комплекта"
                    aria-label={`Убрать «${component.name}» из комплекта`}
                    onClick={() => onRemove(bundle, component.live!)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          }) : (
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              В комплекте нет компонентов.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
