import type { Equipment } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  getEquipmentOperabilityClass,
  getEquipmentOperabilityLabel,
  getEquipmentOperabilityStatus,
  getInoperableEquipmentMessage,
  isEquipmentOperable,
} from "@/lib/equipment-view-model";

export interface EquipmentCheckoutLocationOption {
  id: string;
  name: string;
}

export interface EquipmentCheckoutProjectOption {
  id: string;
  name: string;
}

export interface EquipmentCheckoutCardOption {
  id: string;
  title: string;
  boardName?: string | null;
  projectId?: string | null;
  boardProjectId?: string | null;
  listName?: string | null;
}

export interface EquipmentCheckoutRequestInput {
  physicalDestination: { locationId?: string; manualLocation?: string };
  workContext: { projectId?: string; kanbanCardIds: string[] };
  note: string;
  requestType: "checkout" | "transfer";
  quantity: number;
}

interface ValidationError {
  title: string;
  description: string;
}

interface EquipmentCheckoutRequestDialogProps {
  equipment: Equipment | null;
  requestType: "checkout" | "transfer";
  companyId: string;
  assignedUserName: string;
  locations: EquipmentCheckoutLocationOption[];
  projects: EquipmentCheckoutProjectOption[];
  cards: EquipmentCheckoutCardOption[];
  locationChoice: string;
  manualLocation: string;
  quantity: string;
  projectId: string;
  selectedCardIds: Set<string>;
  note: string;
  pending: boolean;
  onClose: () => void;
  onLocationChoiceChange: (value: string) => void;
  onManualLocationChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onProjectIdChange: (value: string) => void;
  onSelectedCardIdsChange: (value: Set<string>) => void;
  onNoteChange: (value: string) => void;
  onValidationError: (error: ValidationError) => void;
  onSubmit: (input: EquipmentCheckoutRequestInput) => void;
}

function getCardProjectId(card: EquipmentCheckoutCardOption): string {
  return String(card.projectId || card.boardProjectId || "").trim();
}

export function EquipmentCheckoutRequestDialog({
  equipment,
  requestType,
  companyId,
  assignedUserName,
  locations,
  projects,
  cards,
  locationChoice,
  manualLocation,
  quantity,
  projectId,
  selectedCardIds,
  note,
  pending,
  onClose,
  onLocationChoiceChange,
  onManualLocationChange,
  onQuantityChange,
  onProjectIdChange,
  onSelectedCardIdsChange,
  onNoteChange,
  onValidationError,
  onSubmit,
}: EquipmentCheckoutRequestDialogProps) {
  const visibleCards = cards.filter((card) =>
    projectId === "none" || getCardProjectId(card) === projectId,
  );

  const changeProject = (nextProjectId: string) => {
    onProjectIdChange(nextProjectId);
    if (nextProjectId === "none") return;
    onSelectedCardIdsChange(new Set(
      [...selectedCardIds].filter((cardId) => {
        const card = cards.find((entry) => entry.id === cardId);
        return card && getCardProjectId(card) === nextProjectId;
      }),
    ));
  };

  const toggleCard = (card: EquipmentCheckoutCardOption, checked: boolean) => {
    const cardProjectId = getCardProjectId(card);
    if (checked && projectId === "none" && cardProjectId) {
      onProjectIdChange(cardProjectId);
      onSelectedCardIdsChange(new Set([
        ...[...selectedCardIds].filter((cardId) => {
          const selectedCard = cards.find((entry) => entry.id === cardId);
          return selectedCard && getCardProjectId(selectedCard) === cardProjectId;
        }),
        card.id,
      ]));
      return;
    }

    const next = new Set(selectedCardIds);
    if (checked) next.add(card.id);
    else next.delete(card.id);
    onSelectedCardIdsChange(next);
  };

  const submit = () => {
    if (!equipment) return;
    if (!isEquipmentOperable(equipment)) {
      onValidationError({
        title: "Недоступно для выдачи",
        description: getInoperableEquipmentMessage(equipment),
      });
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!quantity.trim() || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      onValidationError({
        title: "Проверьте количество",
        description: "Укажите положительное целое число.",
      });
      return;
    }
    if (!locationChoice || (locationChoice === "manual" && !manualLocation.trim())) {
      onValidationError({
        title: "Укажите место",
        description: "Выберите площадку или заполните ручное местоположение.",
      });
      return;
    }

    onSubmit({
      physicalDestination: locationChoice === "manual"
        ? { manualLocation: manualLocation.trim() }
        : { locationId: locationChoice },
      workContext: {
        projectId: projectId === "none" ? undefined : projectId,
        kanbanCardIds: [...selectedCardIds],
      },
      note,
      requestType,
      quantity: parsedQuantity,
    });
  };

  return (
    <Dialog open={Boolean(equipment)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            {requestType === "transfer"
              ? "Запросить перенос оборудования"
              : "Запросить выдачу оборудования"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            {requestType === "transfer"
              ? "Запрос уйдёт главному по компании. После подтверждения оборудование будет перенесено на вас."
              : "Запрос уйдёт главному по компании. После подтверждения оборудование закрепится за вами."}
          </DialogDescription>
        </DialogHeader>

        {equipment && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="font-medium text-slate-900 dark:text-white">{equipment.name}</div>
              {equipment.model && (
                <div className="text-sm text-slate-500 dark:text-slate-400">{equipment.model}</div>
              )}
              <Badge className={`mt-2 ${getEquipmentOperabilityClass(getEquipmentOperabilityStatus(equipment))}`}>
                {getEquipmentOperabilityLabel(getEquipmentOperabilityStatus(equipment))}
              </Badge>
            </div>

            {requestType === "transfer" && assignedUserName && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                Сейчас у сотрудника: {assignedUserName}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {requestType === "transfer" ? "Куда переносите" : "Куда берёте"}
              </label>
              <Select
                value={locationChoice}
                onValueChange={(value) => {
                  onLocationChoiceChange(value);
                  if (value !== "manual") onManualLocationChange("");
                }}
              >
                <SelectTrigger aria-label="Место назначения" className="bg-white dark:bg-slate-800">
                  <SelectValue placeholder="Выберите площадку или ручной ввод" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="manual">Указать место вручную</SelectItem>
                </SelectContent>
              </Select>
              {locationChoice === "manual" && (
                <Input
                  aria-label="Место назначения вручную"
                  value={manualLocation}
                  onChange={(event) => onManualLocationChange(event.target.value)}
                  placeholder="Например: выездная площадка, монтажная 2"
                />
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Площадка и ручное место — взаимоисключающие варианты.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="checkout-quantity">
                  Количество *
                </label>
                <Input
                  id="checkout-quantity"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => onQuantityChange(event.target.value)}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Проект</label>
                <Select value={projectId} onValueChange={changeProject}>
                  <SelectTrigger aria-label="Проект запроса" className="bg-white dark:bg-slate-800">
                    <SelectValue placeholder="Без проекта" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без проекта</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Карточки Kanban V2</label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {visibleCards.length > 0 ? visibleCards.slice(0, 100).map((card) => (
                  <label key={card.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Checkbox
                      aria-label={`Выбрать карточку «${card.title || "Карточка"}»`}
                      checked={selectedCardIds.has(card.id)}
                      onCheckedChange={(checked) => toggleCard(card, checked === true)}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block break-words font-medium text-slate-800 dark:text-slate-200">
                        {card.title || "Карточка"}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {[card.boardName, card.listName].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                )) : (
                  <div className="py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                    {projectId === "none"
                      ? "В компании нет доступных карточек Kanban V2"
                      : "У проекта нет доступных карточек Kanban V2"}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Можно выбрать несколько карточек. Проект карточки подставляется автоматически.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="checkout-note">
                Комментарий
              </label>
              <Input
                id="checkout-note"
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder={requestType === "transfer"
                  ? "Например: для моей смены, под эфир, под монтаж"
                  : "Если нужно, уточните задачу или проект"}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Отмена
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!companyId || pending || !isEquipmentOperable(equipment)}
                onClick={submit}
              >
                {pending
                  ? "Отправка..."
                  : requestType === "transfer"
                    ? "Отправить запрос на перенос"
                    : "Отправить"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
