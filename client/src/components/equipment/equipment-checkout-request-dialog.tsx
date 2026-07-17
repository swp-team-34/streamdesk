import type { Equipment } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StreamMultiSelect } from "@/components/ui/stream-multi-select";
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

  const changeCards = (nextCardIds: string[]) => {
    const addedCardId = nextCardIds.find((cardId) => !selectedCardIds.has(cardId));
    const addedCard = addedCardId ? cards.find((card) => card.id === addedCardId) : null;
    const cardProjectId = addedCard ? getCardProjectId(addedCard) : "";
    if (addedCard && projectId === "none" && cardProjectId) {
      onProjectIdChange(cardProjectId);
      onSelectedCardIdsChange(new Set([
        ...nextCardIds.filter((cardId) => {
          const selectedCard = cards.find((entry) => entry.id === cardId);
          return selectedCard && getCardProjectId(selectedCard) === cardProjectId;
        }),
      ]));
      return;
    }
    onSelectedCardIdsChange(new Set(nextCardIds));
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
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {requestType === "transfer"
              ? "Запросить перенос оборудования"
              : "Запросить выдачу оборудования"}
          </DialogTitle>
          <DialogDescription>
            {requestType === "transfer"
              ? "Запрос уйдёт главному по компании. После подтверждения оборудование будет перенесено на вас."
              : "Запрос уйдёт главному по компании. После подтверждения оборудование закрепится за вами."}
          </DialogDescription>
        </DialogHeader>

        {equipment && (
          <div className="space-y-4">
            <div className="rounded-control border border-border/50 bg-surface-subtle px-4 py-3">
              <div className="font-medium text-foreground">{equipment.name}</div>
              {equipment.model && (
                <div className="text-sm text-muted-foreground">{equipment.model}</div>
              )}
              <Badge className={`mt-2 ${getEquipmentOperabilityClass(getEquipmentOperabilityStatus(equipment))}`}>
                {getEquipmentOperabilityLabel(getEquipmentOperabilityStatus(equipment))}
              </Badge>
            </div>

            {requestType === "transfer" && assignedUserName && (
              <div className="rounded-control border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
                Сейчас у сотрудника: {assignedUserName}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {requestType === "transfer" ? "Куда переносите" : "Куда берёте"}
              </label>
              <Select
                value={locationChoice}
                onValueChange={(value) => {
                  onLocationChoiceChange(value);
                  if (value !== "manual") onManualLocationChange("");
                }}
              >
                <SelectTrigger aria-label="Место назначения">
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
              <p className="text-xs text-muted-foreground">
                Площадка и ручное место — взаимоисключающие варианты.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="checkout-quantity">
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
                <label className="text-sm font-medium text-foreground">Проект</label>
                <Select value={projectId} onValueChange={changeProject}>
                  <SelectTrigger aria-label="Проект запроса">
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
              <label className="text-sm font-medium text-foreground" htmlFor="checkout-kanban-cards">Карточки Kanban V2</label>
              <StreamMultiSelect
                id="checkout-kanban-cards"
                ariaLabel="Карточки Kanban V2"
                title="Выберите карточки Kanban V2"
                values={[...selectedCardIds]}
                options={visibleCards.slice(0, 100).map((card) => ({
                  value: card.id,
                  label: card.title || "Карточка",
                  description: [card.boardName, card.listName].filter(Boolean).join(" · "),
                }))}
                onValuesChange={changeCards}
                placeholder={projectId === "none"
                  ? "Выберите карточки компании"
                  : "Выберите карточки проекта"}
                searchPlaceholder="Поиск по карточкам"
                emptyMessage={projectId === "none"
                  ? "В компании нет доступных карточек Kanban V2"
                  : "У проекта нет доступных карточек Kanban V2"}
              />
              <p className="text-xs text-muted-foreground">
                Можно выбрать несколько карточек. Проект карточки подставляется автоматически.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="checkout-note">
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
