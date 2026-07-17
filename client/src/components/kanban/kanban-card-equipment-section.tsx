import { Package, Plus, X } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  EquipmentSummaryView,
  KanbanEquipmentLinkView,
} from "@/lib/kanban-equipment-links";
import {
  getEquipmentWorkflowStatusLabel,
  getEquipmentWorkflowStatusVariant,
} from "@/lib/kanban-presentation";
import { formatDueDateLabel } from "@/lib/task-dates";
import { KANBAN_PANEL_SELECT_CLASS } from "./kanban-styles";

interface KanbanCardEquipmentSectionProps {
  companyScoped: boolean;
  links: KanbanEquipmentLinkView[];
  availableEquipment: EquipmentSummaryView[];
  loading: boolean;
  canManage: boolean;
  selection: string;
  attachPending: boolean;
  detachPending: boolean;
  getUserName: (userId: string) => string;
  onSelectionChange: (equipmentId: string) => void;
  onAttach: (equipmentId: string) => void;
  onDetach: (equipmentId: string) => void;
}

export function KanbanCardEquipmentSection({
  companyScoped,
  links,
  availableEquipment,
  loading,
  canManage,
  selection,
  attachPending,
  detachPending,
  getUserName,
  onSelectionChange,
  onAttach,
  onDetach,
}: KanbanCardEquipmentSectionProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Оборудование</h3>
          <p className="text-xs text-muted-foreground">
            Ручные связи и состояние заявок, выдачи и возврата.
          </p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
      </div>

      {canManage && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Оборудование для карточки"
            value={selection}
            onChange={(event) => onSelectionChange(event.target.value)}
            className={`${KANBAN_PANEL_SELECT_CLASS} flex-1`}
            disabled={attachPending || detachPending || availableEquipment.length === 0}
          >
            <option value="">
              {availableEquipment.length > 0
                ? "Выберите оборудование"
                : "Всё доступное оборудование уже связано"}
            </option>
            {availableEquipment.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.name, item.model].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!selection || attachPending}
            onClick={() => onAttach(selection)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Прикрепить
          </Button>
        </div>
      )}

      {!companyScoped && (
        <div className="mt-3 rounded-xl border border-border/35 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Warehouse доступен только в пространстве компании.
        </div>
      )}

      {links.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border/40 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
          К этой карточке пока не прикреплено оборудование.
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {links.map((link) => {
            const quantity = Math.max(1, Number(link.request?.quantity || 1));
            return (
              <div
                key={link.id}
                className="rounded-2xl border border-border/35 bg-muted/20 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <Link
                        href={`/equipment?equipmentId=${encodeURIComponent(link.equipment.id)}`}
                        className="break-words text-foreground hover:underline"
                      >
                        {link.equipment.name || link.equipment.id}
                      </Link>
                    </div>
                    {link.equipment.model && (
                      <div className="mt-1 text-xs text-muted-foreground">{link.equipment.model}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {link.source === "manual" ? "Ручная связь" : "Заявка / выдача"}
                    </Badge>
                    <Badge
                      variant={getEquipmentWorkflowStatusVariant(link.workflowStatus)}
                      className="rounded-full"
                    >
                      {getEquipmentWorkflowStatusLabel(link.workflowStatus)}
                    </Badge>
                    {link.source === "manual" && link.active && canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        disabled={detachPending}
                        title="Открепить оборудование"
                        aria-label={`Открепить ${link.equipment.name || link.equipment.id}`}
                        onClick={() => onDetach(link.equipment.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {link.request && (
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Запросил: {getUserName(link.request.requestedBy)}</span>
                    <span>Количество: {quantity}</span>
                    {link.request.location && <span>Локация: {link.request.location}</span>}
                    {link.request.createdAt && (
                      <span>Создан: {formatDueDateLabel(link.request.createdAt) || "Неизвестно"}</span>
                    )}
                  </div>
                )}
                {!link.request && link.linkedAt && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Прикреплено: {formatDueDateLabel(link.linkedAt) || "Неизвестно"}
                  </div>
                )}
                {link.request?.note && (
                  <div className="mt-3 rounded-xl border border-border/30 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                    {link.request.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
