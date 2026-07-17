import { Building2, WandSparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StreamDateTimePicker } from "@/components/ui/stream-date-time-picker";
import { StreamSelect } from "@/components/ui/stream-select";
import { Textarea } from "@/components/ui/textarea";
import { KanbanUserMultiSelect } from "@/components/kanban/kanban-user-multi-select";
import {
  KANBAN_PANEL_INPUT_CLASS,
  KANBAN_PANEL_TEXTAREA_CLASS,
} from "@/components/kanban/kanban-styles";
import {
  normalizeLocationIds,
  type KanbanCardPriority,
  type KanbanListView,
} from "@/lib/kanban-board-model";
import type { KanbanCardDetailForm } from "@/lib/kanban-card-detail-state";
import { CARD_PRIORITY_LABELS } from "@/lib/kanban-presentation";
import type { KanbanSmartInputResult } from "@/lib/kanban-smart-input";
import { normalizeDateRange, toDateTimeLocalValue } from "@/lib/task-dates";
import { getKanbanCardAssigneeUserIds } from "@shared/kanban-card-roles";

interface KanbanDetailUser {
  id: string;
  name: string;
  username?: string | null;
}

interface KanbanDetailLocation {
  id: string;
  name: string;
  companyId?: string | null;
  archivedAt?: string | Date | null;
}

interface KanbanLinkedLocation {
  id: string;
  name: string;
}

interface KanbanCardDetailFieldsProps {
  form: KanbanCardDetailForm;
  canEdit: boolean;
  lists: KanbanListView[];
  users: KanbanDetailUser[];
  locations: KanbanDetailLocation[];
  linkedLocations: KanbanLinkedLocation[];
  boardCompanyId: string;
  smartInput: KanbanSmartInputResult;
  getUserName: (userId: string) => string;
  onChange: (form: KanbanCardDetailForm) => void;
  onCancelSmartToken: (tokenId: string) => void;
  onSmartInputApplied: () => void;
}

export function KanbanCardDetailFields({
  form,
  canEdit,
  lists,
  users,
  locations,
  linkedLocations,
  boardCompanyId,
  smartInput,
  getUserName,
  onChange,
  onCancelSmartToken,
  onSmartInputApplied,
}: KanbanCardDetailFieldsProps) {
  const selectedLocationIds = normalizeLocationIds(form.locationIds);
  const companyLocations = locations.filter((location) =>
    Boolean(boardCompanyId) &&
    String(location.companyId || "") === boardCompanyId &&
    (!location.archivedAt || selectedLocationIds.includes(location.id)),
  );

  const patchForm = (patch: Partial<KanbanCardDetailForm>) => onChange({ ...form, ...patch });

  const applySmartInput = () => {
    const assigneeUserIds = Array.from(new Set([
      ...getKanbanCardAssigneeUserIds(form),
      ...smartInput.assigneeUserIds,
    ]));
    onChange({
      ...form,
      title: smartInput.title || form.title,
      priority: (smartInput.priority || form.priority) as KanbanCardPriority,
      startDate: smartInput.startDate ?? form.startDate,
      startDateHasTime: smartInput.startDate
        ? smartInput.startDateHasTime
        : form.startDateHasTime,
      dueDate: smartInput.dueDate ?? form.dueDate,
      dueDateHasTime: smartInput.dueDate
        ? smartInput.dueDateHasTime
        : form.dueDateHasTime,
      assigneeUserIds,
      assigneeUserId: assigneeUserIds[0] || "",
    });
    onSmartInputApplied();
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kanban-detail-title">Название карточки</label>
          <Input
            id="kanban-detail-title"
            value={form.title}
            onChange={(event) => patchForm({ title: event.target.value })}
            disabled={!canEdit}
            className={KANBAN_PANEL_INPUT_CLASS}
          />
          {smartInput.tokens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {smartInput.tokens.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-xs text-primary"
                  title="Оставить эту фразу обычным текстом"
                  onClick={() => onCancelSmartToken(token.id)}
                >
                  <WandSparkles className="h-3 w-3" />
                  {token.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              {canEdit && smartInput.errors.length === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-2 text-xs"
                  onClick={applySmartInput}
                >
                  Применить
                </Button>
              )}
            </div>
          )}
          {smartInput.errors.map((error) => (
            <p key={error} className="text-xs text-destructive">{error}</p>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kanban-detail-list">Список</label>
          <StreamSelect
            id="kanban-detail-list"
            value={form.listId}
            options={lists.map((list) => ({ value: list.id, label: list.name }))}
            onValueChange={(listId) => patchForm({ listId })}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="kanban-detail-description">Описание</label>
        <Textarea
          id="kanban-detail-description"
          value={form.description}
          onChange={(event) => patchForm({ description: event.target.value })}
          rows={3}
          disabled={!canEdit}
          className={KANBAN_PANEL_TEXTAREA_CLASS}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kanban-detail-priority">Приоритет</label>
          <StreamSelect
            id="kanban-detail-priority"
            value={form.priority}
            options={Object.entries(CARD_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
            onValueChange={(priority) => patchForm({ priority: priority as KanbanCardPriority })}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kanban-detail-responsible">Ответственный</label>
          <StreamSelect
            id="kanban-detail-responsible"
            value={form.responsibleUserId}
            options={[
              { value: "", label: "Без ответственного" },
              ...(form.responsibleUserId && !users.some((user) => user.id === form.responsibleUserId)
                ? [{ value: form.responsibleUserId, label: `${getUserName(form.responsibleUserId)} (недоступен)` }]
                : []),
              ...users.map((user) => ({ value: user.id, label: user.name })),
            ]}
            onValueChange={(responsibleUserId) => patchForm({ responsibleUserId })}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kanban-detail-initiator">Инициатор</label>
          <StreamSelect
            id="kanban-detail-initiator"
            value={form.initiatorUserId}
            options={[
              ...(form.initiatorUserId && !users.some((user) => user.id === form.initiatorUserId)
                ? [{ value: form.initiatorUserId, label: `${getUserName(form.initiatorUserId)} (недоступен)` }]
                : []),
              ...users.map((user) => ({ value: user.id, label: user.name })),
              ...(users.length === 0 && !form.initiatorUserId
                ? [{ value: "", label: "Нет доступных пользователей", disabled: true }]
                : []),
            ]}
            onValueChange={(initiatorUserId) => patchForm({ initiatorUserId })}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kanban-detail-assignees">Исполнители</label>
          <KanbanUserMultiSelect
            id="kanban-detail-assignees"
            users={users}
            value={getKanbanCardAssigneeUserIds(form)}
            onChange={(assigneeUserIds) => patchForm({
              assigneeUserIds,
              assigneeUserId: assigneeUserIds[0] || "",
            })}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">Площадки</label>
            <span className="text-xs text-muted-foreground">{selectedLocationIds.length || "Нет связей"}</span>
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border/40 bg-background/55 p-2">
            {companyLocations.map((location) => {
              const checked = selectedLocationIds.includes(location.id);
              return (
                <label key={location.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                  <span className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      aria-label={`Связать площадку «${location.name}»`}
                      checked={checked}
                      disabled={!canEdit}
                      onCheckedChange={() => patchForm({
                        locationIds: checked
                          ? selectedLocationIds.filter((locationId) => locationId !== location.id)
                          : normalizeLocationIds([...selectedLocationIds, location.id]),
                      })}
                    />
                    <span className="truncate">{location.name}</span>
                  </span>
                  {location.archivedAt && <Badge variant="secondary">Архив</Badge>}
                </label>
              );
            })}
            {companyLocations.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Для этой компании нет активных площадок.</p>
            )}
          </div>
          {linkedLocations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {linkedLocations.map((location) => (
                <Button key={location.id} asChild variant="outline" size="sm" className="h-7 rounded-full px-2 text-xs">
                  <a href={`/locations?locationId=${encodeURIComponent(location.id)}`}>
                    <Building2 className="mr-1 h-3 w-3" />
                    {location.name}
                  </a>
                </Button>
              ))}
            </div>
          )}
        </div>

        <StreamDateTimePicker
          id="kanban-detail-start-date"
          label="Дата старта"
          value={form.startDate}
          allDay={Boolean(form.startDate) && !form.startDateHasTime}
          showAllDay
          minValue={null}
          onChange={(value) => {
            const startDateHasTime = value && !form.startDate ? true : form.startDateHasTime;
            if (!value || !form.dueDate || !startDateHasTime || !form.dueDateHasTime) {
              patchForm({ startDate: value, startDateHasTime });
              return;
            }
            const normalized = normalizeDateRange(new Date(value), new Date(form.dueDate), 60);
            patchForm({
              startDate: value,
              startDateHasTime,
              dueDate: toDateTimeLocalValue(normalized.end),
            });
          }}
          onAllDayChange={(allDay, nextValue) => {
            if (allDay || !form.dueDate || !form.dueDateHasTime) {
              patchForm({ startDate: nextValue, startDateHasTime: !allDay });
              return;
            }
            const normalized = normalizeDateRange(new Date(nextValue), new Date(form.dueDate), 60);
            patchForm({
              startDate: nextValue,
              startDateHasTime: true,
              dueDate: toDateTimeLocalValue(normalized.end),
            });
          }}
          disabled={!canEdit}
        />

        <StreamDateTimePicker
          id="kanban-detail-due-date"
          label="Срок"
          value={form.dueDate}
          allDay={Boolean(form.dueDate) && !form.dueDateHasTime}
          showAllDay
          minValue={form.startDate || null}
          onChange={(value) => {
            const dueDateHasTime = value && !form.dueDate ? true : form.dueDateHasTime;
            if (!value || !form.startDate || !form.startDateHasTime || !dueDateHasTime) {
              patchForm({ dueDate: value, dueDateHasTime });
              return;
            }
            const normalized = normalizeDateRange(new Date(form.startDate), new Date(value), 60);
            patchForm({
              dueDate: toDateTimeLocalValue(normalized.end),
              dueDateHasTime,
            });
          }}
          onAllDayChange={(allDay, nextValue) => {
            if (allDay || !form.startDate || !form.startDateHasTime) {
              patchForm({ dueDate: nextValue, dueDateHasTime: !allDay });
              return;
            }
            const normalized = normalizeDateRange(new Date(form.startDate), new Date(nextValue), 60);
            patchForm({
              dueDate: toDateTimeLocalValue(normalized.end),
              dueDateHasTime: true,
            });
          }}
          disabled={!canEdit}
        />
      </div>
    </>
  );
}
