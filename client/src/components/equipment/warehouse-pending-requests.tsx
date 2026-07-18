import type { Equipment } from "@shared/schema";
import { PackageCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type WarehousePendingRequestType = "checkout" | "transfer" | "kit-extraction";

export interface WarehousePendingRequestGroupView {
  id: string;
  requestIds: string[];
  items: Equipment[];
  fallbackEquipmentName: string;
  requesterName: string;
  requestType: WarehousePendingRequestType;
  currentHolderName: string;
  quantity: number;
  destination: string;
  projectName: string;
  kanbanCardTitles: string[];
  note: string;
}

interface WarehousePendingRequestsProps {
  groups: WarehousePendingRequestGroupView[];
  approvePending: boolean;
  rejectPending: boolean;
  onApprove: (group: WarehousePendingRequestGroupView) => void;
  onReject: (requestIds: string[]) => void;
}

export function WarehousePendingRequests({
  groups,
  approvePending,
  rejectPending,
  onApprove,
  onReject,
}: WarehousePendingRequestsProps) {
  if (groups.length === 0) return null;

  return (
    <Card className="border-primary/25 bg-primary/5 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground">
          Запросы на выдачу и перенос оборудования
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Сотрудники ждут решения. После апрува позиция либо выдаётся, либо переносится на нового сотрудника.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((group) => {
          const isKitExtraction = group.requestType === "kit-extraction";
          return (
            <div
              key={group.id}
              className="flex flex-col gap-3 rounded-surface border border-border/50 bg-surface-raised p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="font-medium text-foreground">
                  {group.items.length <= 1
                    ? group.items[0]?.name || group.fallbackEquipmentName || "Оборудование"
                    : `${group.items.length} позиций оборудования`}
                </div>
                {group.items.length > 1 && (
                  <div className="space-y-0.5 text-sm text-muted-foreground">
                    {group.items.slice(0, 8).map((item) => (
                      <div key={item.id} className="break-words">
                        {item.name}{item.model ? ` · ${item.model}` : ""}
                      </div>
                    ))}
                    {group.items.length > 8 && <div>+ ещё {group.items.length - 8}</div>}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {isKitExtraction
                    ? "Запросил извлечение"
                    : group.requestType === "transfer"
                      ? "Просит перенести"
                      : "Запросил"}: {group.requesterName || "Сотрудник"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Количество: {Math.max(1, group.quantity)}
                </div>
                {(group.requestType === "transfer" || isKitExtraction) && group.currentHolderName && (
                  <div className="text-sm text-muted-foreground">
                    {isKitExtraction ? "Активный комплект" : "Сейчас у сотрудника"}: {group.currentHolderName}
                  </div>
                )}
                {group.destination && (
                  <div className="text-sm text-muted-foreground">
                    {group.requestType === "transfer" ? "Куда переносит" : "Куда берёт"}: {group.destination}
                  </div>
                )}
                {group.projectName && (
                  <div className="text-sm text-muted-foreground">
                    Проект: {group.projectName}
                  </div>
                )}
                {group.kanbanCardTitles.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Kanban V2: {group.kanbanCardTitles.join(", ")}
                  </div>
                )}
                {group.note && (
                  <div className="break-words text-sm text-muted-foreground">
                    Комментарий: {group.note}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={approvePending}
                  onClick={() => onApprove(group)}
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  {isKitExtraction ? "Подтвердить извлечение" : "Разрешить"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rejectPending}
                  onClick={() => onReject(group.requestIds)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Отклонить
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
