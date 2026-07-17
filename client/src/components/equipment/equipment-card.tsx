import type { KeyboardEvent, MouseEvent } from "react";
import type { Equipment } from "@shared/schema";
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Camera,
  Clock,
  Edit,
  FileText,
  Gavel,
  Lightbulb,
  MapPin,
  MessageSquare,
  Mic,
  Monitor,
  Package,
  PackageCheck,
  Printer,
  QrCode,
  Send,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EquipmentKitCardSection, type EquipmentProjectReturnInfo } from "./equipment-kit-card-section";
import { getParentBundleId, getParentBundleName, isSuperPosition } from "@/lib/equipment-kit-model";
import {
  formatEquipmentDateTime,
  formatEquipmentReturnDateTime,
  getEquipmentActivitySummary,
  getEquipmentCategoryLabel,
  getEquipmentOperabilityClass,
  getEquipmentOperabilityLabel,
  getEquipmentOperabilityStatus,
  getEquipmentPhysicalDestination,
  getEquipmentResponsibleContact,
  getEquipmentResponsiblePerson,
  getEquipmentStatusClass,
  getEquipmentStatusLabel,
  getEquipmentStorageLocation,
  getSpecificationEntries,
} from "@/lib/equipment-view-model";
import { cn } from "@/lib/utils";

export interface EquipmentCardProjectInfo extends EquipmentProjectReturnInfo {
  projectId: string;
  projectName?: string;
  sentAt?: string;
  assignedByName: string;
  assignedByUserId?: string;
}

export interface EquipmentCardContextInfo {
  projectId: string;
  projectName?: string;
}

export interface EquipmentCardPendingRequest {
  requestedBy: string;
  requestType?: string | null;
}

interface EquipmentCardProps {
  item: Equipment;
  allEquipment: Equipment[];
  selected: boolean;
  inCart: boolean;
  projectInfo?: EquipmentCardProjectInfo;
  contextProjectInfo?: EquipmentCardContextInfo;
  pendingRequest?: EquipmentCardPendingRequest;
  requestType: string;
  requestedByCurrentUser: boolean;
  canReturnOwnItem: boolean;
  canRequestItem: boolean;
  canReserve: boolean;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId?: string;
  expanded: boolean;
  printPending: boolean;
  calibratePending: boolean;
  returnPending: boolean;
  deletePending: boolean;
  removeKitPending: boolean;
  getAssignedUserName: (assignedTo: string | null | undefined) => string;
  getProjectInfo: (equipmentId: string) => EquipmentCardProjectInfo | undefined;
  isReturnOverdue: (returnDate: string, returnTime?: string) => boolean;
  onToggleSelected: (item: Equipment) => void;
  onOpenDetails: (item: Equipment) => void;
  onOpenBarcode: (item: Equipment) => void;
  onPrint: (item: Equipment) => void;
  onCalibrate: () => void;
  onAddToCart: (item: Equipment) => void;
  onTakeReturn: (item: Equipment, returnViaParentBundle: boolean) => void;
  onReturnOwn: (item: Equipment, returnViaParentBundle: boolean) => void;
  onRequest: (item: Equipment) => void;
  onEdit: (item: Equipment) => void;
  onDelete: (item: Equipment) => void;
  onProjectReturn: (item: Equipment, isKitComponent: boolean) => void;
  onToggleBundle: (bundle: Equipment) => void;
  onAddBundleComponent: (bundle: Equipment) => void;
  onOpenBundleComponent: (bundleId: string, component: Equipment) => void;
  onRemoveBundleComponent: (bundle: Equipment, component: Equipment) => void;
}

function getTypeIcon(type: string) {
  switch (type) {
    case "microphone": return <Mic className="h-5 w-5" />;
    case "camera": return <Camera className="h-5 w-5" />;
    case "lighting": return <Lightbulb className="h-5 w-5" />;
    case "computer": return <Monitor className="h-5 w-5" />;
    default: return <Gavel className="h-5 w-5" />;
  }
}

export function EquipmentCard({
  item,
  allEquipment,
  selected,
  inCart,
  projectInfo,
  contextProjectInfo,
  pendingRequest,
  requestType,
  requestedByCurrentUser,
  canReturnOwnItem,
  canRequestItem,
  canReserve,
  canEdit,
  canDelete,
  currentUserId,
  expanded,
  printPending,
  calibratePending,
  returnPending,
  deletePending,
  removeKitPending,
  getAssignedUserName,
  getProjectInfo,
  isReturnOverdue,
  onToggleSelected,
  onOpenDetails,
  onOpenBarcode,
  onPrint,
  onCalibrate,
  onAddToCart,
  onTakeReturn,
  onReturnOwn,
  onRequest,
  onEdit,
  onDelete,
  onProjectReturn,
  onToggleBundle,
  onAddBundleComponent,
  onOpenBundleComponent,
  onRemoveBundleComponent,
}: EquipmentCardProps) {
  const parentBundleId = getParentBundleId(item);
  const parentBundleExists = Boolean(
    parentBundleId && allEquipment.some((candidate) => candidate.id === parentBundleId),
  );
  const isKitComponent = Boolean(parentBundleId && parentBundleExists);
  const returnViaParentBundle = isKitComponent && item.status === "in-use";
  const takenByName = !projectInfo && item.status === "in-use"
    ? getAssignedUserName(item.assignedTo)
    : "";
  const hasDescription = Boolean(
    String(item.notes ?? "").trim() || getSpecificationEntries(item.specifications).length > 0,
  );
  const activitySummary = getEquipmentActivitySummary(item);
  const physicalDestination = getEquipmentPhysicalDestination(item);
  const storageLocation = getEquipmentStorageLocation(item);
  const responsiblePerson = getEquipmentResponsiblePerson(item);
  const responsibleContact = getEquipmentResponsibleContact(item);
  const operabilityStatus = getEquipmentOperabilityStatus(item);
  const canReturnProjectItem = Boolean(
    projectInfo && (
      canReserve ||
      (currentUserId && projectInfo.assignedByUserId === currentUserId)
    ),
  );
  const stopPropagation = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails(item);
        }
      }}
      className={cn(
        "group cursor-pointer overflow-hidden border bg-surface-raised shadow-xs transition-[background-color,border-color,box-shadow] duration-150 hover:border-border/80 hover:bg-surface-overlay hover:shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        selected ? "border-primary/45 ring-1 ring-primary/20" : "border-border/50",
      )}
    >
      <CardHeader className="space-y-3 p-3 pb-2">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="flex min-w-0 items-center pr-0 sm:pr-2">
            <div onClick={stopPropagation} onKeyDown={stopPropagation} className="shrink-0">
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelected(item)}
                className="shrink-0"
                title="Выбрать для выгрузки в Excel"
                aria-label={`Выбрать «${item.name}»`}
              />
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-start gap-0.5 rounded-control bg-surface-subtle p-0.5 transition-opacity sm:w-auto sm:max-w-[248px] sm:justify-end sm:opacity-70 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetails(item);
              }}
              title={hasDescription ? "Описание и тех. характеристики" : "Открыть описание"}
              data-testid={`button-details-${item.id}`}
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
              onClick={(event) => {
                event.stopPropagation();
                onOpenBarcode(item);
              }}
              title="Штрих-код"
              data-testid={`button-barcode-${item.id}`}
            >
              <QrCode className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
              onClick={(event) => {
                event.stopPropagation();
                onPrint(item);
              }}
              title="Напечатать этикетку"
              disabled={printPending}
              data-testid={`button-print-label-${item.id}`}
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
              onClick={(event) => {
                event.stopPropagation();
                onCalibrate();
              }}
              title="Калибровка принтера этикеток"
              disabled={calibratePending}
              data-testid={`button-calibrate-label-${item.id}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
              onClick={(event) => {
                event.stopPropagation();
                onAddToCart(item);
              }}
              title="В корзину"
              disabled={inCart || Boolean(projectInfo)}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </Button>
            {canReserve && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onTakeReturn(item, returnViaParentBundle);
                }}
                title={returnViaParentBundle ? "Открыть сборку для возврата" : item.status === "in-use" ? "Вернуть" : "Взять"}
                data-testid={`button-take-return-${item.id}`}
              >
                {returnViaParentBundle ? (
                  <Package className="h-3.5 w-3.5 text-warning" />
                ) : (
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {!canReserve && canReturnOwnItem && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onReturnOwn(item, returnViaParentBundle);
                }}
                title={returnViaParentBundle ? "Открыть сборку для возврата" : "Вернуть"}
                disabled={returnPending}
              >
                {returnViaParentBundle ? (
                  <Package className="h-3.5 w-3.5 text-warning" />
                ) : (
                  <PackageCheck className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {canRequestItem && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequest(item);
                }}
                title={
                  pendingRequest
                    ? requestType === "transfer" ? "Запрос на перенос уже отправлен" : "Запрос уже отправлен"
                    : requestType === "transfer" ? "Запросить перенос" : "Запросить выдачу"
                }
                disabled={Boolean(pendingRequest)}
              >
                {pendingRequest ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(item);
                }}
                title="Редактировать"
                data-testid={`button-edit-${item.id}`}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-error hover:bg-error-muted hover:text-error sm:h-7 sm:w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item);
                }}
                title="Удалить"
                disabled={deletePending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20">
            {getTypeIcon(item.type)}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="break-words text-sm leading-tight text-foreground sm:text-base">
              {item.name}
            </CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              {getEquipmentCategoryLabel(item)}
            </p>
          </div>
        </div>

        {canReturnProjectItem && projectInfo && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            title={isKitComponent ? "Открыть сборку для возврата" : "Вернуть на склад"}
            disabled={!isKitComponent && returnPending}
            onClick={(event) => {
              event.stopPropagation();
              onProjectReturn(item, isKitComponent);
            }}
          >
            {isKitComponent ? <Package className="mr-1 h-3.5 w-3.5" /> : <PackageCheck className="mr-1 h-3.5 w-3.5" />}
            {isKitComponent ? "Открыть сборку" : "Вернуть"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="space-y-2.5 text-[12px] text-foreground/90 sm:text-sm">
          {projectInfo && (() => {
            const overdue = isReturnOverdue(projectInfo.returnDate, projectInfo.returnTime);
            return (
              <div className={cn(
                "rounded-md p-2 space-y-1.5",
                overdue
                  ? "border border-error/20 bg-error-muted"
                  : "border border-primary/20 bg-primary/5",
              )}>
                <div className={cn("flex items-start gap-1.5", overdue ? "text-error" : "text-primary")}>
                  <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">Отправил: {projectInfo.assignedByName}</span>
                </div>
                {projectInfo.sentAt && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 break-words">Выдано: {formatEquipmentDateTime(projectInfo.sentAt)}</span>
                  </div>
                )}
                <div className="flex items-start gap-1.5 text-muted-foreground">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">
                    Возврат: {formatEquipmentReturnDateTime(projectInfo.returnDate, projectInfo.returnTime)}
                    {projectInfo.projectName ? ` · ${projectInfo.projectName}` : ""}
                  </span>
                </div>
                {overdue && (
                  <div className="flex items-start gap-1.5 font-medium text-error">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 break-words">Просрочено возвращение</span>
                  </div>
                )}
              </div>
            );
          })()}
          {item.model && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <span className="shrink-0 text-muted-foreground">Модель:</span>
              <span className="max-w-full min-w-0 break-words text-left font-medium sm:max-w-[68%] sm:text-right">{item.model}</span>
            </div>
          )}
          {item.serialNumber && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <span className="shrink-0 text-muted-foreground">Серийный номер:</span>
              <span className="max-w-full min-w-0 break-all text-left font-mono text-xs font-medium sm:max-w-[68%] sm:text-right">{item.serialNumber}</span>
            </div>
          )}
          {item.inventoryNumber && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <span className="shrink-0 text-muted-foreground">Инв. номер:</span>
              <span className="max-w-full min-w-0 break-all text-left font-medium sm:max-w-[68%] sm:text-right">{item.inventoryNumber}</span>
            </div>
          )}
          {physicalDestination.displayName && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
              <MapPin className="mt-1 h-3 w-3 shrink-0 text-primary" />
              <span className="text-muted-foreground">Сейчас:</span>
              <span className="col-span-2 min-w-0 break-words font-medium sm:col-span-1 sm:text-right">
                {physicalDestination.displayName}{physicalDestination.archived ? " · архив" : ""}
              </span>
            </div>
          )}
          {storageLocation && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
              <MapPin className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Хранение:</span>
              <span className="col-span-2 min-w-0 break-words font-medium sm:col-span-1 sm:text-right">{storageLocation}</span>
            </div>
          )}
          {(responsiblePerson || responsibleContact) && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
              <User className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Ответственный:</span>
              <span className="col-span-2 min-w-0 break-words font-medium sm:col-span-1 sm:text-right">
                {[responsiblePerson, responsibleContact].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
          {contextProjectInfo && !projectInfo && (
            <div className="rounded-control border border-info/20 bg-info-muted px-3 py-2 text-info">
              <div className="min-w-0 break-words">
                Рабочий контекст: {contextProjectInfo.projectName || contextProjectInfo.projectId}
              </div>
            </div>
          )}
          {activitySummary.commentCount > 0 && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                {activitySummary.commentCount} зап.
                {activitySummary.attachmentCount > 0 ? ` · файлов: ${activitySummary.attachmentCount}` : ""}
                {activitySummary.latestAuthorName ? ` · последний: ${activitySummary.latestAuthorName}` : ""}
              </span>
            </div>
          )}
          {item.lastUsed && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <span className="shrink-0 text-muted-foreground">Последнее использование:</span>
              <span className="min-w-0 text-left font-medium sm:text-right">{new Date(item.lastUsed).toLocaleDateString("ru-RU")}</span>
            </div>
          )}
          {!projectInfo && takenByName && (
            <div className="rounded-control border border-info/20 bg-info-muted px-3 py-2">
              <div className="flex items-start gap-1.5 text-info">
                <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-words">Забрал: {takenByName}</span>
              </div>
            </div>
          )}
          {pendingRequest && !projectInfo && (
            <div className="rounded-control border border-warning/20 bg-warning-muted px-3 py-2">
              <div className="flex items-start gap-1.5 text-warning">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-words">
                  {requestedByCurrentUser
                    ? requestType === "transfer"
                      ? "Ваш запрос на перенос отправлен и ждёт решения главного"
                      : "Ваш запрос на выдачу отправлен и ждёт подтверждения"
                    : requestType === "transfer"
                      ? `Ожидает решения по переносу для ${getAssignedUserName(pendingRequest.requestedBy) || "сотрудника"}`
                      : `Ожидает решения по запросу от ${getAssignedUserName(pendingRequest.requestedBy) || "сотрудника"}`}
                </span>
              </div>
            </div>
          )}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
            {projectInfo ? (
              <Badge className="max-w-full rounded-full border border-primary/20 bg-primary/10 text-[11px] text-primary">
                На проекте
              </Badge>
            ) : pendingRequest ? (
              <Badge className="max-w-full rounded-full border border-warning/20 bg-warning-muted text-[11px] text-warning">
                {requestedByCurrentUser
                  ? requestType === "transfer" ? "Ждёт перенос" : "Ждёт апрув"
                  : requestType === "transfer" ? "Есть перенос" : "Есть запрос"}
              </Badge>
            ) : contextProjectInfo ? (
              <Badge className="max-w-full rounded-full border border-info/20 bg-info-muted text-[11px] text-info">
                Контекст проекта
              </Badge>
            ) : (
              <Badge className={`${getEquipmentStatusClass(item.status)} max-w-full rounded-full text-[11px]`}>
                {getEquipmentStatusLabel(item.status)}
              </Badge>
            )}
            {isSuperPosition(item) && (
              <Badge className="max-w-full rounded-full border border-success/20 bg-success-muted text-[11px] text-success">
                Сборка
              </Badge>
            )}
            <Badge className={`${getEquipmentOperabilityClass(operabilityStatus)} max-w-full rounded-full text-[11px]`}>
              {getEquipmentOperabilityLabel(operabilityStatus)}
            </Badge>
            {getParentBundleName(item) && (
              <Badge className="max-w-full rounded-full border border-info/20 bg-info-muted text-[11px] text-info">
                В сборке
              </Badge>
            )}
          </div>
          <EquipmentKitCardSection
            bundle={item}
            allEquipment={allEquipment}
            expanded={expanded}
            canEdit={canEdit}
            removePending={removeKitPending}
            fallbackProject={projectInfo}
            getProjectInfo={getProjectInfo}
            getAssignedUserName={getAssignedUserName}
            isReturnOverdue={isReturnOverdue}
            onToggle={() => onToggleBundle(item)}
            onAdd={onAddBundleComponent}
            onOpen={onOpenBundleComponent}
            onRemove={onRemoveBundleComponent}
          />
        </div>
      </CardContent>
    </Card>
  );
}
