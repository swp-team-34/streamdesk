import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  KanbanCustomFieldDefinition,
  KanbanLabelGroupView,
  KanbanLabelView,
  KanbanListView,
} from "@/lib/kanban-board-model";
import {
  KANBAN_EMPTY_FIELD_FILTER,
  getKanbanCustomFieldFilterHelp,
} from "@/lib/kanban-custom-field-filters";
import {
  CARD_PRIORITY_LABELS,
  CUSTOM_FIELD_TYPE_LABELS,
  LIST_TYPE_LABELS,
} from "@/lib/kanban-presentation";
import type { TaskManagerWorkloadFilter } from "@/lib/task-manager-filters";
import {
  KANBAN_PANEL_INPUT_CLASS,
  KANBAN_PANEL_SELECT_CLASS,
} from "./kanban-styles";

export interface KanbanCardFiltersState {
  search: string;
  status: string;
  assigneeUserId: string;
  responsibleUserId: string;
  initiatorUserId: string;
  priority: string;
  dueStatus: string;
  workload: TaskManagerWorkloadFilter;
  location: string;
  labelId: string;
  labelGroupId: string;
  customFieldValues: Record<string, string>;
}

export const EMPTY_KANBAN_CARD_FILTERS: KanbanCardFiltersState = {
  search: "",
  status: "all",
  assigneeUserId: "",
  responsibleUserId: "",
  initiatorUserId: "",
  priority: "all",
  dueStatus: "all",
  workload: "all",
  location: "",
  labelId: "",
  labelGroupId: "",
  customFieldValues: {},
};

interface UserOption {
  id: string;
  name: string;
}

interface KanbanCardFiltersDialogProps {
  open: boolean;
  filters: KanbanCardFiltersState;
  lists: KanbanListView[];
  users: UserOption[];
  locations: string[];
  labels: KanbanLabelView[];
  labelGroups: KanbanLabelGroupView[];
  customFields: KanbanCustomFieldDefinition[];
  hasActiveFilters: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (filters: KanbanCardFiltersState) => void;
  onReset: () => void;
}

export function KanbanCardFiltersDialog({
  open,
  filters,
  lists,
  users,
  locations,
  labels,
  labelGroups,
  customFields,
  hasActiveFilters,
  onOpenChange,
  onChange,
  onReset,
}: KanbanCardFiltersDialogProps) {
  const update = (patch: Partial<KanbanCardFiltersState>) => onChange({ ...filters, ...patch });
  const updateCustomField = (fieldId: string, value: string) => onChange({
    ...filters,
    customFieldValues: {
      ...filters.customFieldValues,
      [fieldId]: value,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50 bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>Фильтры</DialogTitle>
          <DialogDescription>Быстрые срезы по карточкам текущей доски.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-status">Статус / список</label>
            <select
              id="kanban-mobile-filter-status"
              className={KANBAN_PANEL_SELECT_CLASS}
              value={filters.status}
              onChange={(event) => update({ status: event.target.value })}
            >
              <option value="all">Все статусы</option>
              {Object.entries(LIST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={`type:${value}`}>{label}</option>
              ))}
              {lists.length > 0 && <option disabled>──────────</option>}
              {lists.map((list) => (
                <option key={list.id} value={`list:${list.id}`}>{list.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-assignee">Исполнитель</label>
            <select
              id="kanban-mobile-filter-assignee"
              className={KANBAN_PANEL_SELECT_CLASS}
              value={filters.assigneeUserId}
              onChange={(event) => update({ assigneeUserId: event.target.value })}
            >
              <option value="">Все</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-responsible">Ответственный</label>
              <select
                id="kanban-mobile-filter-responsible"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={filters.responsibleUserId}
                onChange={(event) => update({ responsibleUserId: event.target.value })}
              >
                <option value="">Все</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-initiator">Инициатор</label>
              <select
                id="kanban-mobile-filter-initiator"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={filters.initiatorUserId}
                onChange={(event) => update({ initiatorUserId: event.target.value })}
              >
                <option value="">Все</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-priority">Приоритет</label>
              <select
                id="kanban-mobile-filter-priority"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={filters.priority}
                onChange={(event) => update({ priority: event.target.value })}
              >
                <option value="all">Все</option>
                {Object.entries(CARD_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-due">Срок</label>
              <select
                id="kanban-mobile-filter-due"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={filters.dueStatus}
                onChange={(event) => update({ dueStatus: event.target.value })}
              >
                <option value="all">Все</option>
                <option value="overdue">Просрочено</option>
                <option value="soon">Скоро срок</option>
                <option value="upcoming">Запланировано</option>
                <option value="complete">Завершено</option>
                <option value="none">Без срока</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-workload">Нагрузка</label>
              <select
                id="kanban-mobile-filter-workload"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={filters.workload}
                onChange={(event) => update({
                  workload: event.target.value as TaskManagerWorkloadFilter,
                })}
              >
                <option value="all">Любая нагрузка</option>
                <option value="overdue">Просроченные</option>
                <option value="due-soon">Горят в 24 часа</option>
                <option value="in-progress">В работе</option>
                <option value="completed">Выполненные</option>
                <option value="unassigned">Без исполнителя</option>
                <option value="no-deadline">Без срока</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-location">Локация</label>
              <select
                id="kanban-mobile-filter-location"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={filters.location}
                onChange={(event) => update({ location: event.target.value })}
              >
                <option value="">Все локации</option>
                {locations.length === 0 ? (
                  <option value="__empty" disabled>Локации не найдены</option>
                ) : (
                  locations.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-label">Метка</label>
            <select
              id="kanban-mobile-filter-label"
              className={KANBAN_PANEL_SELECT_CLASS}
              value={filters.labelId}
              onChange={(event) => update({ labelId: event.target.value })}
            >
              <option value="">Все</option>
              {labels.filter((label) => !label.archivedAt).map((label) => (
                <option key={label.id} value={label.id}>{label.name}</option>
              ))}
            </select>
          </div>
          {labelGroups.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-label-group">Группа меток</label>
              <select
                id="kanban-mobile-filter-label-group"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={filters.labelGroupId}
                onChange={(event) => update({ labelGroupId: event.target.value })}
              >
                <option value="">Все группы</option>
                {labelGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          )}
          {customFields.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-border/30 bg-muted/15 p-3">
              <div>
                <h4 className="text-sm font-semibold">Поля карточек</h4>
                <p className="text-xs text-muted-foreground">Фильтр ищет по значениям выбранных custom fields.</p>
              </div>
              <div className="grid gap-2">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor={`kanban-filter-field-${field.id}`}>{field.name}</label>
                      <details className="text-xs text-muted-foreground">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted/50">
                          <HelpCircle className="h-3.5 w-3.5" />
                          Как работает
                        </summary>
                        <p className="mt-1 max-w-xs rounded-lg border border-border/35 bg-popover p-2 text-popover-foreground shadow-lg">
                          {getKanbanCustomFieldFilterHelp(field)}
                        </p>
                      </details>
                    </div>
                    {field.type === "select" || field.type === "multi-select" || field.type === "checkbox" ? (
                      <select
                        id={`kanban-filter-field-${field.id}`}
                        className={KANBAN_PANEL_SELECT_CLASS}
                        value={filters.customFieldValues[field.id] || ""}
                        onChange={(event) => updateCustomField(field.id, event.target.value)}
                      >
                        <option value="">Любое значение</option>
                        <option value={KANBAN_EMPTY_FIELD_FILTER}>Без значения</option>
                        {field.type === "checkbox" ? (
                          <>
                            <option value="true">Да</option>
                            <option value="false">Нет</option>
                          </>
                        ) : (
                          (field.options ?? []).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))
                        )}
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          id={`kanban-filter-field-${field.id}`}
                          value={
                            filters.customFieldValues[field.id] === KANBAN_EMPTY_FIELD_FILTER
                              ? ""
                              : filters.customFieldValues[field.id] || ""
                          }
                          onChange={(event) => updateCustomField(field.id, event.target.value)}
                          placeholder={CUSTOM_FIELD_TYPE_LABELS[field.type]}
                          className={KANBAN_PANEL_INPUT_CLASS}
                        />
                        <Button
                          type="button"
                          variant={
                            filters.customFieldValues[field.id] === KANBAN_EMPTY_FIELD_FILTER
                              ? "secondary"
                              : "outline"
                          }
                          className="shrink-0 rounded-xl"
                          onClick={() => updateCustomField(
                            field.id,
                            filters.customFieldValues[field.id] === KANBAN_EMPTY_FIELD_FILTER
                              ? ""
                              : KANBAN_EMPTY_FIELD_FILTER,
                          )}
                        >
                          Пусто
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" onClick={onReset}>
              Сбросить
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Применить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
