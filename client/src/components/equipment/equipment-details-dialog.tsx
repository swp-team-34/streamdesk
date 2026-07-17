import type { Equipment } from "@shared/schema";
import { ChevronUp, History, MapPin, MessageSquare, User } from "lucide-react";
import { Link } from "wouter";
import { EquipmentActivity } from "@/components/equipment/equipment-activity";
import { EquipmentKitDetailsSection } from "@/components/equipment/equipment-kit-details-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { AutosaveStatus } from "@/hooks/use-debounced-autosave";
import { apiUrl } from "@/lib/queryClient";
import {
  asRecord,
  formatEquipmentDateTime,
  getEquipmentCategoryLabel,
  getEquipmentContextLinks,
  getEquipmentOperabilityClass,
  getEquipmentOperabilityLabel,
  getEquipmentOperabilityStatus,
  getEquipmentPhotos,
  getEquipmentPhysicalDestination,
  getEquipmentResponsibleContact,
  getEquipmentResponsiblePerson,
  getEquipmentStorageLocation,
  getSpecificationEntries,
} from "@/lib/equipment-view-model";
import { cn } from "@/lib/utils";

interface EquipmentDetailsDialogProps {
  equipment: Equipment | null;
  allEquipment: Equipment[];
  canEdit: boolean;
  canComment: boolean;
  assignedUserName: string;
  canReturnToBundle: boolean;
  note: string;
  noteAutosaveStatus: AutosaveStatus;
  noteAutosaveError: string;
  removePending: boolean;
  onClose: () => void | Promise<void>;
  onBackToBundle: () => void;
  onAddToKit: (bundle: Equipment) => void;
  onOpenComponent: (bundleId: string, component?: Equipment) => void;
  onRemoveComponent: (bundle: Equipment, component: Equipment) => void;
  onOpenParent: (component: Equipment) => void;
  onNoteChange: (value: string) => void;
  onActivity: () => void;
}

function getRequestStatusText(status: string | null | undefined): string {
  switch (status) {
    case "approved": return "Подтверждено";
    case "rejected": return "Отклонено";
    case "pending": return "Ожидает решения";
    default: return status || "История";
  }
}

function getNoteAudit(equipment: Equipment): { authorName: string; at: string } {
  const audit = asRecord(asRecord(equipment.specifications).noteAudit);
  return {
    authorName: String(audit.authorName || "").trim(),
    at: String(audit.at || "").trim(),
  };
}

function getKitHistory(equipment: Equipment): Array<Record<string, unknown>> {
  const specs = asRecord(equipment.specifications);
  if (Array.isArray(specs.bundleExtractionHistory)) {
    return specs.bundleExtractionHistory as Array<Record<string, unknown>>;
  }
  if (Array.isArray(specs.kitExtractionHistory)) {
    return specs.kitExtractionHistory as Array<Record<string, unknown>>;
  }
  return [];
}

export function EquipmentDetailsDialog({
  equipment,
  allEquipment,
  canEdit,
  canComment,
  assignedUserName,
  canReturnToBundle,
  note,
  noteAutosaveStatus,
  noteAutosaveError,
  removePending,
  onClose,
  onBackToBundle,
  onAddToKit,
  onOpenComponent,
  onRemoveComponent,
  onOpenParent,
  onNoteChange,
  onActivity,
}: EquipmentDetailsDialogProps) {
  const photos = equipment ? getEquipmentPhotos(equipment) : [];
  const history = equipment ? getKitHistory(equipment) : [];
  const specificationEntries = equipment ? getSpecificationEntries(equipment.specifications) : [];
  const noteAudit = equipment ? getNoteAudit(equipment) : { authorName: "", at: "" };

  return (
    <Dialog open={Boolean(equipment)} onOpenChange={(open) => !open && void onClose()}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden bg-white dark:bg-slate-900">
        {equipment && (
          <>
            <DialogHeader>
              {canReturnToBundle && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-1 w-fit px-2"
                  onClick={onBackToBundle}
                >
                  <ChevronUp className="mr-1.5 h-4 w-4 -rotate-90" />
                  Назад к комплекту
                </Button>
              )}
              <DialogTitle className="text-slate-900 dark:text-white">{equipment.name}</DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                {[equipment.model, getEquipmentCategoryLabel(equipment)].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 space-y-4 overflow-y-auto pr-1 text-sm text-slate-700 dark:text-slate-300">
              {photos.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {photos.map((photo, index) => (
                    <a
                      key={`${equipment.id}-photo-${index}`}
                      href={photo}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <img
                        src={photo}
                        alt={`${equipment.name} ${index + 1}`}
                        className="h-48 w-full object-contain"
                        loading="lazy"
                        onError={(event) => {
                          const image = event.currentTarget;
                          if (image.dataset.retry === "api") return;
                          image.dataset.retry = "api";
                          image.src = apiUrl(photo);
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}

              <EquipmentKitDetailsSection
                equipment={equipment}
                allEquipment={allEquipment}
                canEdit={canEdit}
                removePending={removePending}
                onAdd={onAddToKit}
                onOpenComponent={onOpenComponent}
                onRemove={onRemoveComponent}
                onOpenParent={onOpenParent}
              />

              {history.length > 0 && (
                <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    <History className="h-3.5 w-3.5" />
                    История состава
                  </div>
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {[...history].reverse().map((entry, index) => (
                      <div key={String(entry.id || index)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {String(entry.componentName || "Компонент")}
                        </div>
                        <Badge className={cn(
                          "mt-1 text-[10px]",
                          entry.action === "added"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                        )}>
                          {entry.action === "added" ? "Добавлено" : "Извлечено"}
                        </Badge>
                        <div className="mt-1 text-slate-500 dark:text-slate-400">
                          {String(entry.actorName || "Пользователь")} · {formatEquipmentDateTime(String(entry.at || ""))}
                        </div>
                        <div className="mt-1 break-words text-slate-600 dark:text-slate-300">
                          {String(entry.reason || entry.context || "Без комментария")}
                        </div>
                        {entry.managerOverride === true && (
                          <Badge className="mt-2 bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Override менеджера
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                  Исправность
                </div>
                <Badge className={getEquipmentOperabilityClass(getEquipmentOperabilityStatus(equipment))}>
                  {getEquipmentOperabilityLabel(getEquipmentOperabilityStatus(equipment))}
                </Badge>
              </div>

              {(() => {
                const destination = getEquipmentPhysicalDestination(equipment);
                if (!destination.displayName) return null;
                return (
                  <div className="rounded-md border border-violet-200/80 bg-violet-50/70 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/20">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-violet-600 dark:text-violet-300">
                      Физическое местоположение
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <div className="min-w-0">
                        <div className="break-words font-medium">{destination.displayName}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge className="bg-white text-[10px] text-violet-700 dark:bg-violet-950 dark:text-violet-200">
                            {destination.locationId
                              ? "Площадка"
                              : destination.legacyLocation
                                ? "Историческое значение"
                                : "Ручной ввод"}
                          </Badge>
                          {destination.archived && (
                            <Badge className="bg-slate-200 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              В архиве
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const links = getEquipmentContextLinks(equipment).filter((link) => link.active);
                if (links.length === 0) return null;
                return (
                  <div className="rounded-md border border-blue-200/80 bg-blue-50/70 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-normal text-blue-600 dark:text-blue-300">
                      Рабочий контекст
                    </div>
                    <div className="space-y-2">
                      {links.map((link) => (
                        <div key={link.id} className="rounded-md border border-blue-200/70 bg-white/80 px-3 py-2 dark:border-blue-900/70 dark:bg-slate-900/70">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={link.source === "checkout"
                              ? "bg-blue-100 text-[10px] text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                              : "bg-violet-100 text-[10px] text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"}>
                              {link.source === "checkout" ? "Выдача / запрос" : "Ручная связь"}
                            </Badge>
                            {link.checkoutRequest?.status && (
                              <Badge className="bg-slate-100 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {getRequestStatusText(link.checkoutRequest.status)}
                              </Badge>
                            )}
                          </div>
                          {link.project?.name && (
                            <Link
                              href={`/projects?projectId=${encodeURIComponent(String(link.project.id))}`}
                              className="mt-1.5 block break-words font-medium text-slate-900 hover:underline dark:text-white"
                            >
                              Проект: {link.project.name}
                            </Link>
                          )}
                          {link.kanbanCard?.title && (
                            <Link
                              href={`/tasks?boardId=${encodeURIComponent(String(link.kanbanCard.boardId))}&cardId=${encodeURIComponent(String(link.kanbanCard.id))}`}
                              className="mt-1 block break-words text-slate-600 hover:underline dark:text-slate-300"
                            >
                              Kanban V2: {link.kanbanCard.title}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const storageLocation = getEquipmentStorageLocation(equipment);
                const responsiblePerson = getEquipmentResponsiblePerson(equipment);
                const responsibleContact = getEquipmentResponsibleContact(equipment);
                if (!storageLocation && !responsiblePerson && !responsibleContact) return null;

                return (
                  <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                      Хранение и ответственность
                    </div>
                    <div className="space-y-2">
                      {storageLocation && (
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Место хранения</div>
                            <div className="break-words font-medium">{storageLocation}</div>
                          </div>
                        </div>
                      )}
                      {(responsiblePerson || responsibleContact) && (
                        <div className="flex items-start gap-2">
                          <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Ответственный</div>
                            {responsiblePerson && <div className="break-words font-medium">{responsiblePerson}</div>}
                            {responsibleContact && <div className="break-words text-slate-600 dark:text-slate-300">{responsibleContact}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {equipment.status === "in-use" && assignedUserName && (
                <div className="rounded-md border border-blue-200 bg-blue-50/80 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/20">
                  <div className="flex items-start gap-2 text-blue-700 dark:text-blue-300">
                    <User className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">Сейчас забрал</div>
                      <div className="break-words">{assignedUserName}</div>
                    </div>
                  </div>
                </div>
              )}

              {!canEdit && String(equipment.notes ?? "").trim() && (
                <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    Описание
                  </div>
                  {(noteAudit.authorName || noteAudit.at) && (
                    <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                      Примечание: {noteAudit.authorName || "пользователь"}
                      {noteAudit.at ? `, ${formatEquipmentDateTime(noteAudit.at)}` : ""}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words leading-6 text-slate-700 dark:text-slate-200">
                    {equipment.notes}
                  </p>
                </div>
              )}

              {canEdit && (
                <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    Примечание
                  </div>
                  {(noteAudit.authorName || noteAudit.at) && (
                    <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                      Последнее изменение: {noteAudit.authorName || "пользователь"}
                      {noteAudit.at ? `, ${formatEquipmentDateTime(noteAudit.at)}` : ""}
                    </div>
                  )}
                  <Textarea
                    aria-label="Примечание по оборудованию"
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                    placeholder="Напишите примечание по оборудованию"
                    className="min-h-28 resize-y bg-white dark:bg-slate-950"
                  />
                  <div
                    className={cn(
                      "mt-2 text-xs",
                      noteAutosaveStatus === "error" ||
                        (noteAutosaveStatus === "dirty" && noteAutosaveError)
                        ? "text-destructive"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                    role="status"
                  >
                    {noteAutosaveStatus === "saving"
                      ? "Сохранение..."
                      : noteAutosaveStatus === "dirty"
                        ? noteAutosaveError || "Изменения будут сохранены автоматически"
                        : noteAutosaveStatus === "error"
                          ? noteAutosaveError || "Не удалось сохранить изменения"
                          : "Все изменения сохранены"}
                  </div>
                </div>
              )}

              {specificationEntries.length > 0 && (
                <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    Технические характеристики
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {specificationEntries.map(([label, value]) => (
                      <div
                        key={`${equipment.id}-${label}`}
                        className="rounded-md border border-slate-200/70 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                        <div className="mt-1 break-words font-medium text-slate-900 dark:text-slate-100">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                  <MessageSquare className="h-3.5 w-3.5" />
                  История и файлы
                </div>
                <EquipmentActivity
                  equipmentId={equipment.id}
                  canComment={canComment}
                  onActivity={onActivity}
                />
              </div>

              {canEdit && !String(equipment.notes ?? "").trim() && specificationEntries.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Для этой позиции описание и технические характеристики пока не заполнены.
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
