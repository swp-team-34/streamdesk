import { FileSpreadsheet, Package, Printer, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface FilterOption {
  id: string;
  label: string;
  count: number;
}

interface CategoryFilterOption {
  value: string;
  label: string;
}

interface WarehouseFiltersProps {
  mobileOpen: boolean;
  searchTerm: string;
  status: string;
  category: string;
  operability: string;
  employee: string;
  activeFilterCount: number;
  canFilterByEmployee: boolean;
  categoryOptions: CategoryFilterOption[];
  employeeOptions: FilterOption[];
  unknownEmployeeOptions: FilterOption[];
  selectedCount: number;
  filteredCount: number;
  exportCount: number;
  printCount: number;
  bundleCount: number;
  printPending: boolean;
  bundlePending: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onSearchTermChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onOperabilityChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
  onReset: () => void;
  onToggleSelectAll: () => void;
  onExport: () => void;
  onPrint: () => void;
  onCreateBundle: () => void;
}

export function WarehouseFilters({
  mobileOpen,
  searchTerm,
  status,
  category,
  operability,
  employee,
  activeFilterCount,
  canFilterByEmployee,
  categoryOptions,
  employeeOptions,
  unknownEmployeeOptions,
  selectedCount,
  filteredCount,
  exportCount,
  printCount,
  bundleCount,
  printPending,
  bundlePending,
  onMobileOpenChange,
  onSearchTermChange,
  onStatusChange,
  onCategoryChange,
  onOperabilityChange,
  onEmployeeChange,
  onReset,
  onToggleSelectAll,
  onExport,
  onPrint,
  onCreateBundle,
}: WarehouseFiltersProps) {
  const allSelected = selectedCount >= filteredCount && filteredCount > 0;

  const renderFilterFields = (mobile: boolean) => (
    <>
      <div className={mobile ? "relative" : "relative w-full sm:min-w-[260px] sm:flex-1"}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Поиск оборудования"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Поиск: название, модель, серийник, штрихкод"
          className="border-input/50 bg-surface-base pl-9 pr-9"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchTermChange("")}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Очистить поиск"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className={mobile
          ? "w-full border-input/50 bg-surface-base"
          : "w-full border-input/50 bg-surface-base sm:w-[150px]"}>
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          <SelectItem value="available">Доступно</SelectItem>
          <SelectItem value="in-use">Используется</SelectItem>
          <SelectItem value="maintenance">Обслуживание</SelectItem>
          <SelectItem value="broken">Сломано</SelectItem>
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className={mobile
          ? "w-full border-input/50 bg-surface-base"
          : "w-full border-input/50 bg-surface-base sm:w-[140px]"}>
          <SelectValue placeholder="Тип" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все категории</SelectItem>
          {categoryOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={operability} onValueChange={onOperabilityChange}>
        <SelectTrigger className={mobile
          ? "w-full border-input/50 bg-surface-base"
          : "w-full border-input/50 bg-surface-base sm:w-[155px]"}>
          <SelectValue placeholder="Исправность" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{mobile ? "Любая исправность" : "Исправность"}</SelectItem>
          <SelectItem value="working">Исправно</SelectItem>
          <SelectItem value="broken">Неисправно</SelectItem>
          <SelectItem value="on_repair">В ремонте</SelectItem>
        </SelectContent>
      </Select>

      {canFilterByEmployee && (
        <Select value={employee} onValueChange={onEmployeeChange}>
          <SelectTrigger className={mobile
            ? "w-full border-input/50 bg-surface-base"
            : "w-full border-input/50 bg-surface-base sm:w-[190px]"}>
            <SelectValue placeholder="Сотрудник" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все сотрудники</SelectItem>
            <SelectItem value="unassigned">Без сотрудника</SelectItem>
            {employeeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label} ({option.count})
              </SelectItem>
            ))}
            {unknownEmployeeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label} ({option.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );

  const renderActions = (mobile: boolean) => (
    <div className={mobile
      ? "grid grid-cols-1 gap-2"
      : "flex flex-wrap items-center gap-2 border-t border-border/40 pt-3"}>
      <Button
        variant="ghost"
        size={mobile ? "default" : "sm"}
        className="text-muted-foreground"
        onClick={onReset}
      >
        <X className="mr-2 h-4 w-4" />
        Сбросить
      </Button>
      <Button
        variant="outline"
        size={mobile ? "default" : "sm"}
        className="border-border/50 bg-surface-base"
        onClick={onToggleSelectAll}
      >
        {allSelected ? "Снять выбор" : "Выбрать все"}
      </Button>
      <Button
        variant="outline"
        size={mobile ? "default" : "sm"}
        className="border-border/50 bg-surface-base"
        onClick={onExport}
        disabled={exportCount === 0}
        title={selectedCount > 0 ? "Выгрузить отмеченное оборудование в Excel" : "Выгрузить текущий список оборудования в Excel"}
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        {selectedCount > 0 ? `Отчёт Excel (${selectedCount})` : "Отчёт в Excel"}
      </Button>
      <Button
        variant="outline"
        size={mobile ? "default" : "sm"}
        className="border-border/50 bg-surface-base"
        onClick={onPrint}
        disabled={printCount === 0 || printPending}
        title="Выберите карточки галочками, чтобы напечатать пачку этикеток"
      >
        <Printer className="mr-2 h-4 w-4" />
        {printCount > 0 ? `Печать (${printCount})` : "Печать этикеток"}
      </Button>
      <Button
        variant="outline"
        size={mobile ? "default" : "sm"}
        className="border-border/50 bg-surface-base"
        onClick={onCreateBundle}
        disabled={bundleCount < 2 || bundlePending}
        title="Отметьте комплектующие и соберите их в одну складскую позицию"
      >
        <Package className="mr-2 h-4 w-4" />
        {bundleCount >= 2 ? `Собрать (${bundleCount})` : "Собрать комплект"}
      </Button>
    </div>
  );

  return (
    <>
      <div className="sm:hidden">
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between border-border/50 bg-surface-raised text-left"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Фильтры и поиск
              </span>
              <span className="text-xs text-muted-foreground">
                {activeFilterCount > 0 ? `${activeFilterCount} активно` : "Все позиции"}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-dialog border-border/50 bg-surface-overlay px-4 pb-6 pt-4">
            <SheetHeader>
              <SheetTitle>Фильтры склада</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {renderFilterFields(true)}
              {renderActions(true)}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden flex-col gap-3 rounded-surface border border-border/50 bg-surface-raised p-3 shadow-xs sm:flex">
        <div className="flex flex-wrap items-center gap-2">
          {renderFilterFields(false)}
        </div>
        {renderActions(false)}
      </div>
    </>
  );
}
