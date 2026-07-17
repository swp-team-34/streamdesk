import type { Equipment } from "@shared/schema";
import { FileText, Send, ShoppingCart, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamDatePicker } from "@/components/ui/stream-date-picker";
import { StreamDateTimePicker } from "@/components/ui/stream-date-time-picker";
import { StreamTimePicker } from "@/components/ui/stream-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getEquipmentCategoryLabel } from "@/lib/equipment-view-model";

interface WarehouseCartProject {
  id: string;
  name: string;
}

export interface WarehouseProjectSendInput {
  projectId: string;
  handoffAt: string;
  returnDate: string;
  returnTime: string;
}

interface WarehouseCartSheetProps {
  open: boolean;
  cart: Equipment[];
  projects: WarehouseCartProject[];
  equipmentCountByProject: Record<string, number>;
  canReserve: boolean;
  canRequestCheckout: boolean;
  sendToProjectId: string;
  handoffAt: string;
  returnDate: string;
  returnTime: string;
  passDirection: "in" | "out";
  passBasis: string;
  passResponsiblePhone: string;
  passPending: boolean;
  takePending: boolean;
  sendPending: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (equipmentId: string) => void;
  onClear: () => void;
  onSendToProjectIdChange: (value: string) => void;
  onHandoffAtChange: (value: string) => void;
  onReturnDateChange: (value: string) => void;
  onReturnTimeChange: (value: string) => void;
  onPassDirectionChange: (value: "in" | "out") => void;
  onPassBasisChange: (value: string) => void;
  onPassResponsiblePhoneChange: (value: string) => void;
  onDownloadPass: () => void;
  onTakeForSelf: () => void;
  onSendToProject: (input: WarehouseProjectSendInput) => void;
}

export function WarehouseCartSheet({
  open,
  cart,
  projects,
  equipmentCountByProject,
  canReserve,
  canRequestCheckout,
  sendToProjectId,
  handoffAt,
  returnDate,
  returnTime,
  passDirection,
  passBasis,
  passResponsiblePhone,
  passPending,
  takePending,
  sendPending,
  onOpenChange,
  onRemove,
  onClear,
  onSendToProjectIdChange,
  onHandoffAtChange,
  onReturnDateChange,
  onReturnTimeChange,
  onPassDirectionChange,
  onPassBasisChange,
  onPassResponsiblePhoneChange,
  onDownloadPass,
  onTakeForSelf,
  onSendToProject,
}: WarehouseCartSheetProps) {
  const selectedProject = projects.find((project) => project.id === sendToProjectId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative min-w-0 flex-1 border-border/50 bg-surface-raised sm:flex-none">
          <ShoppingCart className="mr-1.5 h-4 w-4 sm:mr-2" />
          Корзина
          {cart.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {cart.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="px-4 pt-4">Корзина оборудования</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Добавьте оборудование с карточек кнопкой «Корзина»</p>
          ) : cart.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 rounded-md border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium leading-snug">{item.name}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {[item.model, getEquipmentCategoryLabel(item)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                aria-label={`Убрать «${item.name}» из корзины`}
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="space-y-3 border-t bg-background px-4 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Позиций: {cart.length}</span>
              {selectedProject && <span className="ml-3 truncate">{selectedProject.name}</span>}
            </div>

            {canReserve && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Отправить на проект</label>
                  <Select value={sendToProjectId} onValueChange={onSendToProjectIdChange}>
                    <SelectTrigger aria-label="Проект для оборудования" className="bg-surface-base">
                      <SelectValue placeholder={projects.length > 0 ? "Выберите проект" : "Нет доступных проектов"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length > 0 ? projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                          {equipmentCountByProject[project.id] ? ` (${equipmentCountByProject[project.id]})` : ""}
                        </SelectItem>
                      )) : (
                        <SelectItem value="_empty" disabled>Нет доступных проектов</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {projects.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      В рабочем пространстве пока нет проектов. Можно забрать оборудование себе.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <StreamDateTimePicker
                      id="cart-handoff-at"
                      label="Выдать"
                      value={handoffAt}
                      onChange={onHandoffAtChange}
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <div>
                      <StreamDatePicker
                        id="cart-return-date"
                        label="Вернуть до *"
                        value={returnDate}
                        onChange={onReturnDateChange}
                        minValue={new Date().toISOString().slice(0, 10)}
                        className="px-2 [&>svg]:hidden"
                      />
                    </div>
                    <div>
                      <StreamTimePicker
                        id="cart-return-time"
                        label="Время"
                        value={returnTime}
                        onChange={onReturnTimeChange}
                        className="px-2 [&>svg]:hidden"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Пропуск на материальные ценности
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Направление</label>
                      <Select value={passDirection} onValueChange={(value) => onPassDirectionChange(value === "in" ? "in" : "out")}>
                        <SelectTrigger aria-label="Направление пропуска" className="bg-surface-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="out">Вынос</SelectItem>
                          <SelectItem value="in">Внос</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground" htmlFor="cart-responsible-phone">Телефон ответственного</label>
                      <Input
                        id="cart-responsible-phone"
                        value={passResponsiblePhone}
                        onChange={(event) => onPassResponsiblePhoneChange(event.target.value)}
                        placeholder="+7..."
                        className="bg-surface-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground" htmlFor="cart-pass-basis">Основание</label>
                    <Input
                      id="cart-pass-basis"
                      value={passBasis}
                      onChange={(event) => onPassBasisChange(event.target.value)}
                      placeholder="Например: работы по проекту"
                      className="bg-surface-base"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={passPending}
                    onClick={onDownloadPass}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {passPending ? "Формирование..." : "Скачать пропуск DOCX"}
                  </Button>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={onClear}>Очистить</Button>
              <Button
                variant="outline"
                disabled={!canRequestCheckout || takePending}
                onClick={onTakeForSelf}
              >
                {takePending ? "Оформление..." : (
                  <>
                    <User className="mr-2 h-4 w-4" />
                    {canReserve ? "Забрать себе" : "Запросить себе"}
                  </>
                )}
              </Button>
            </div>

            {canReserve && (
              <Button
                className="w-full min-w-0"
                disabled={!sendToProjectId || !returnDate || sendPending}
                onClick={() => onSendToProject({
                  projectId: sendToProjectId,
                  handoffAt,
                  returnDate,
                  returnTime,
                })}
              >
                {sendPending ? (
                  <span className="truncate">Отправка…</span>
                ) : (
                  <span className="flex min-w-0 items-center justify-center">
                    <Send className="mr-2 h-4 w-4" />
                    <span className="truncate">Отправить на проект</span>
                  </span>
                )}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
