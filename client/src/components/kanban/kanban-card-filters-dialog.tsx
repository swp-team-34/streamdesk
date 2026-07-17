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
import { StreamSelect } from "@/components/ui/stream-select";
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
  const userOptions = [
    { value: "", label: "Все" },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50 bg-surface-overlay text-foreground shadow-overlay">
        <DialogHeader>
          <DialogTitle>Фильтры</DialogTitle>
          <DialogDescription>Быстрые срезы по карточкам текущей доски.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-status">Статус / список</label>
            <StreamSelect
              id="kanban-mobile-filter-status"
              value={filters.status}
              options={[
                { value: "all", label: "Все статусы" },
                ...Object.entries(LIST_TYPE_LABELS).map(([value, label]) => ({ value: `type:${value}`, label })),
                ...(lists.length > 0
                  ? [{ value: "__lists-divider__", label: "Списки доски", disabled: true }]
                  : []),
                ...lists.map((list) => ({ value: `list:${list.id}`, label: list.name })),
              ]}
              onValueChange={(status) => update({ status })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-assignee">Исполнитель</label>
            <StreamSelect
              id="kanban-mobile-filter-assignee"
              value={filters.assigneeUserId}
              options={userOptions}
              onValueChange={(assigneeUserId) => update({ assigneeUserId })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-responsible">Ответственный</label>
              <StreamSelect
                id="kanban-mobile-filter-responsible"
                value={filters.responsibleUserId}
                options={userOptions}
                onValueChange={(responsibleUserId) => update({ responsibleUserId })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-initiator">Инициатор</label>
              <StreamSelect
                id="kanban-mobile-filter-initiator"
                value={filters.initiatorUserId}
                options={userOptions}
                onValueChange={(initiatorUserId) => update({ initiatorUserId })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-priority">Приоритет</label>
              <StreamSelect
                id="kanban-mobile-filter-priority"
                value={filters.priority}
                options={[
                  { value: "all", label: "Все" },
                  ...Object.entries(CARD_PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
                ]}
                onValueChange={(priority) => update({ priority })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-due">Срок</label>
              <StreamSelect
                id="kanban-mobile-filter-due"
                value={filters.dueStatus}
                options={[
                  { value: "all", label: "Все" },
                  { value: "overdue", label: "Просрочено" },
                  { value: "soon", label: "Скоро срок" },
                  { value: "upcoming", label: "Запланировано" },
                  { value: "complete", label: "Завершено" },
                  { value: "none", label: "Без срока" },
                ]}
                onValueChange={(dueStatus) => update({ dueStatus })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-workload">Нагрузка</label>
              <StreamSelect
                id="kanban-mobile-filter-workload"
                value={filters.workload}
                options={[
                  { value: "all", label: "Любая нагрузка" },
                  { value: "overdue", label: "Просроченные" },
                  { value: "due-soon", label: "Горят в 24 часа" },
                  { value: "in-progress", label: "В работе" },
                  { value: "completed", label: "Выполненные" },
                  { value: "unassigned", label: "Без исполнителя" },
                  { value: "no-deadline", label: "Без срока" },
                ]}
                onValueChange={(workload) => update({ workload: workload as TaskManagerWorkloadFilter })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-location">Локация</label>
              <StreamSelect
                id="kanban-mobile-filter-location"
                value={filters.location}
                options={[
                  { value: "", label: "Все локации" },
                  ...(locations.length === 0
                    ? [{ value: "__empty", label: "Локации не найдены", disabled: true }]
                    : locations.map((location) => ({ value: location, label: location }))),
                ]}
                onValueChange={(location) => update({ location })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-label">Метка</label>
            <StreamSelect
              id="kanban-mobile-filter-label"
              value={filters.labelId}
              options={[
                { value: "", label: "Все" },
                ...labels.filter((label) => !label.archivedAt).map((label) => ({ value: label.id, label: label.name })),
              ]}
              onValueChange={(labelId) => update({ labelId })}
            />
          </div>
          {labelGroups.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-label-group">Группа меток</label>
              <StreamSelect
                id="kanban-mobile-filter-label-group"
                value={filters.labelGroupId}
                options={[
                  { value: "", label: "Все группы" },
                  ...labelGroups.map((group) => ({ value: group.id, label: group.name })),
                ]}
                onValueChange={(labelGroupId) => update({ labelGroupId })}
              />
            </div>
          )}
          {customFields.length > 0 && (
            <div className="space-y-2 rounded-surface border border-border/50 bg-surface-subtle p-3">
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
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-control px-1.5 py-0.5 hover:bg-surface-overlay">
                          <HelpCircle className="h-3.5 w-3.5" />
                          Как работает
                        </summary>
                        <p className="mt-1 max-w-xs rounded-control border border-border/50 bg-surface-overlay p-2 text-foreground shadow-overlay">
                          {getKanbanCustomFieldFilterHelp(field)}
                        </p>
                      </details>
                    </div>
                    {field.type === "select" || field.type === "multi-select" || field.type === "checkbox" ? (
                      <StreamSelect
                        id={`kanban-filter-field-${field.id}`}
                        value={filters.customFieldValues[field.id] || ""}
                        options={[
                          { value: "", label: "Любое значение" },
                          { value: KANBAN_EMPTY_FIELD_FILTER, label: "Без значения" },
                          ...(field.type === "checkbox"
                            ? [
                                { value: "true", label: "Да" },
                                { value: "false", label: "Нет" },
                              ]
                            : (field.options ?? []).map((option) => ({ value: option, label: option }))),
                        ]}
                        onValueChange={(value) => updateCustomField(field.id, value)}
                      />
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
                          className="shrink-0 rounded-control"
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
