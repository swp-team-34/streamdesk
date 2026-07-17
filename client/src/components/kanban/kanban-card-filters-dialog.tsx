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
import { StreamMultiSelect } from "@/components/ui/stream-multi-select";
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
  statuses: string[];
  assigneeUserIds: string[];
  responsibleUserIds: string[];
  initiatorUserIds: string[];
  priorities: string[];
  dueStatuses: string[];
  workloads: TaskManagerWorkloadFilter[];
  locations: string[];
  labelIds: string[];
  labelGroupIds: string[];
  customFieldValues: Record<string, string | string[]>;
}

export const EMPTY_KANBAN_CARD_FILTERS: KanbanCardFiltersState = {
  search: "",
  statuses: [],
  assigneeUserIds: [],
  responsibleUserIds: [],
  initiatorUserIds: [],
  priorities: [],
  dueStatuses: [],
  workloads: [],
  locations: [],
  labelIds: [],
  labelGroupIds: [],
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
  const updateCustomField = (fieldId: string, value: string | string[]) => onChange({
    ...filters,
    customFieldValues: {
      ...filters.customFieldValues,
      [fieldId]: value,
    },
  });
  const userOptions = users.map((user) => ({ value: user.id, label: user.name }));

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
            <StreamMultiSelect
              id="kanban-mobile-filter-status"
              showSelectionChips={false}
              values={filters.statuses}
              options={[
                ...Object.entries(LIST_TYPE_LABELS).map(([value, label]) => ({ value: `type:${value}`, label })),
                ...(lists.length > 0
                  ? [{ value: "__lists-divider__", label: "Списки доски", disabled: true }]
                  : []),
                ...lists.map((list) => ({ value: `list:${list.id}`, label: list.name })),
              ]}
              onValuesChange={(statuses) => update({ statuses })}
              placeholder="Все статусы"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-assignee">Исполнитель</label>
            <StreamMultiSelect
              id="kanban-mobile-filter-assignee"
              showSelectionChips={false}
              values={filters.assigneeUserIds}
              options={userOptions}
              onValuesChange={(assigneeUserIds) => update({ assigneeUserIds })}
              placeholder="Все исполнители"
              searchable
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-responsible">Ответственный</label>
              <StreamMultiSelect
                id="kanban-mobile-filter-responsible"
                showSelectionChips={false}
                values={filters.responsibleUserIds}
                options={userOptions}
                onValuesChange={(responsibleUserIds) => update({ responsibleUserIds })}
                placeholder="Все ответственные"
                searchable
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-initiator">Инициатор</label>
              <StreamMultiSelect
                id="kanban-mobile-filter-initiator"
                showSelectionChips={false}
                values={filters.initiatorUserIds}
                options={userOptions}
                onValuesChange={(initiatorUserIds) => update({ initiatorUserIds })}
                placeholder="Все инициаторы"
                searchable
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-priority">Приоритет</label>
              <StreamMultiSelect
                id="kanban-mobile-filter-priority"
                showSelectionChips={false}
                values={filters.priorities}
                options={Object.entries(CARD_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                onValuesChange={(priorities) => update({ priorities })}
                placeholder="Все приоритеты"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-due">Срок</label>
              <StreamMultiSelect
                id="kanban-mobile-filter-due"
                showSelectionChips={false}
                values={filters.dueStatuses}
                options={[
                  { value: "overdue", label: "Просрочено" },
                  { value: "soon", label: "Скоро срок" },
                  { value: "upcoming", label: "Запланировано" },
                  { value: "complete", label: "Завершено" },
                  { value: "none", label: "Без срока" },
                ]}
                onValuesChange={(dueStatuses) => update({ dueStatuses })}
                placeholder="Любой срок"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-workload">Нагрузка</label>
              <StreamMultiSelect
                id="kanban-mobile-filter-workload"
                showSelectionChips={false}
                values={filters.workloads}
                options={[
                  { value: "overdue", label: "Просроченные" },
                  { value: "due-soon", label: "Горят в 24 часа" },
                  { value: "in-progress", label: "В работе" },
                  { value: "completed", label: "Выполненные" },
                  { value: "unassigned", label: "Без исполнителя" },
                  { value: "no-deadline", label: "Без срока" },
                ]}
                onValuesChange={(workloads) => update({ workloads: workloads as TaskManagerWorkloadFilter[] })}
                placeholder="Любая нагрузка"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-location">Локация</label>
              <StreamMultiSelect
                id="kanban-mobile-filter-location"
                showSelectionChips={false}
                values={filters.locations}
                options={locations.length === 0
                    ? [{ value: "__empty", label: "Локации не найдены", disabled: true }]
                    : locations.map((location) => ({ value: location, label: location }))}
                onValuesChange={(locations) => update({ locations })}
                placeholder="Все локации"
                searchable
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-label">Метка</label>
            <StreamMultiSelect
              id="kanban-mobile-filter-label"
              showSelectionChips={false}
              values={filters.labelIds}
              options={labels.filter((label) => !label.archivedAt).map((label) => ({ value: label.id, label: label.name }))}
              onValuesChange={(labelIds) => update({ labelIds })}
              placeholder="Все метки"
              searchable
            />
          </div>
          {labelGroups.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kanban-mobile-filter-label-group">Группа меток</label>
              <StreamMultiSelect
                id="kanban-mobile-filter-label-group"
                showSelectionChips={false}
                values={filters.labelGroupIds}
                options={labelGroups.map((group) => ({ value: group.id, label: group.name }))}
                onValuesChange={(labelGroupIds) => update({ labelGroupIds })}
                placeholder="Все группы"
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
                    {field.type === "multi-select" ? (
                      <StreamMultiSelect
                        id={`kanban-filter-field-${field.id}`}
                        showSelectionChips={false}
                        values={Array.isArray(filters.customFieldValues[field.id])
                          ? filters.customFieldValues[field.id] as string[]
                          : filters.customFieldValues[field.id]
                            ? [String(filters.customFieldValues[field.id])]
                            : []}
                        options={[
                          { value: KANBAN_EMPTY_FIELD_FILTER, label: "Без значения" },
                          ...(field.options ?? []).map((option) => ({ value: option, label: option })),
                        ]}
                        onValuesChange={(value) => updateCustomField(field.id, value)}
                        placeholder="Любые значения"
                      />
                    ) : field.type === "select" || field.type === "checkbox" ? (
                      <StreamSelect
                        id={`kanban-filter-field-${field.id}`}
                        value={Array.isArray(filters.customFieldValues[field.id])
                          ? ""
                          : String(filters.customFieldValues[field.id] || "")}
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
                            !Array.isArray(filters.customFieldValues[field.id]) &&
                            filters.customFieldValues[field.id] === KANBAN_EMPTY_FIELD_FILTER
                              ? ""
                              : String(filters.customFieldValues[field.id] || "")
                          }
                          onChange={(event) => updateCustomField(field.id, event.target.value)}
                          placeholder={CUSTOM_FIELD_TYPE_LABELS[field.type]}
                          className={KANBAN_PANEL_INPUT_CLASS}
                        />
                        <Button
                          type="button"
                          variant={
                            !Array.isArray(filters.customFieldValues[field.id]) &&
                            filters.customFieldValues[field.id] === KANBAN_EMPTY_FIELD_FILTER
                              ? "secondary"
                              : "outline"
                          }
                          className="shrink-0 rounded-control"
                          onClick={() => updateCustomField(
                            field.id,
                            !Array.isArray(filters.customFieldValues[field.id]) &&
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
