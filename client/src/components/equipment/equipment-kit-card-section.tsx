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
      className="border-t border-border/40 pt-2"
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
            className="h-8 w-8 shrink-0 text-success hover:bg-success-muted hover:text-success"
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
                className="flex items-stretch overflow-hidden rounded-control border border-border/40 bg-surface-subtle"
              >
                <button
                  type="button"
                  aria-label={`Открыть «${component.name}»`}
                  disabled={!component.live}
                  onClick={() => component.live && onOpen(bundle.id, component.live)}
                  className="min-w-0 flex-1 px-2.5 py-2 text-left transition hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-medium text-foreground">
                      {component.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
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
                      <Badge className="border border-success/20 bg-success-muted text-[10px] text-success">
                        Комплект
                      </Badge>
                    )}
                    {componentProject && (
                      <Badge className="border border-primary/20 bg-primary/10 text-[10px] text-primary">
                        На проекте
                      </Badge>
                    )}
                    {overdue && (
                      <Badge className="border border-error/20 bg-error-muted text-[10px] text-error">
                        Просрочено
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 break-words text-[11px] text-muted-foreground">
                    {holder ? `У сотрудника: ${holder}` : component.location ? `Хранение: ${component.location}` : "Место не указано"}
                  </div>
                </button>
                {canEdit && component.live && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-auto w-10 shrink-0 rounded-none border-l border-border/40 text-error hover:bg-error-muted hover:text-error"
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
            <div className="rounded-control border border-dashed border-border/60 bg-surface-subtle px-3 py-4 text-center text-xs text-muted-foreground">
              В комплекте нет компонентов.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
