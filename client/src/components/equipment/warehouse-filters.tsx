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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          aria-label="Поиск оборудования"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Поиск: название, модель, серийник, штрихкод"
          className="border-slate-200 bg-white pl-9 pr-9 dark:border-slate-700 dark:bg-slate-800"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchTermChange("")}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Очистить поиск"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className={mobile
          ? "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          : "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 sm:w-[150px]"}>
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
          ? "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          : "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 sm:w-[140px]"}>
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
          ? "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          : "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 sm:w-[155px]"}>
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
            ? "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
            : "w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 sm:w-[190px]"}>
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
    <div className={mobile ? "grid grid-cols-1 gap-2" : "contents"}>
      <Button
        variant="outline"
        className={mobile ? "border-slate-200 dark:border-slate-700" : "border-slate-300 dark:border-slate-600"}
        onClick={onReset}
      >
        Сбросить
      </Button>
      <Button
        variant="outline"
        size={mobile ? "default" : "sm"}
        className={mobile ? "border-slate-200 dark:border-slate-700" : "border-slate-300 dark:border-slate-600"}
        onClick={onToggleSelectAll}
      >
        {allSelected ? "Снять выбор" : "Выбрать все"}
      </Button>
      <Button
        variant="outline"
        className={mobile ? "border-slate-200 dark:border-slate-700" : "border-slate-300 dark:border-slate-600"}
        onClick={onExport}
        disabled={exportCount === 0}
        title={selectedCount > 0 ? "Выгрузить отмеченное оборудование в Excel" : "Выгрузить текущий список оборудования в Excel"}
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        {selectedCount > 0 ? `Отчёт Excel (${selectedCount})` : "Отчёт в Excel"}
      </Button>
      <Button
        variant="outline"
        className={mobile ? "border-slate-200 dark:border-slate-700" : "border-slate-300 dark:border-slate-600"}
        onClick={onPrint}
        disabled={printCount === 0 || printPending}
        title="Выберите карточки галочками, чтобы напечатать пачку этикеток"
      >
        <Printer className="mr-2 h-4 w-4" />
        {printCount > 0 ? `Печать (${printCount})` : "Печать этикеток"}
      </Button>
      <Button
        variant="outline"
        className={mobile ? "border-slate-200 dark:border-slate-700" : "border-slate-300 dark:border-slate-600"}
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
              className="w-full justify-between border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-900/50"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Фильтры и поиск
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeFilterCount > 0 ? `${activeFilterCount} активно` : "Все позиции"}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl border-slate-200 bg-white px-4 pb-6 pt-4 dark:border-slate-700 dark:bg-slate-950">
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

      <div className="hidden flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50 sm:flex sm:flex-row sm:flex-wrap">
        {renderFilterFields(false)}
        {renderActions(false)}
      </div>
    </>
  );
}
