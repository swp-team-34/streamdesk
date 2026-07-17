import type { Equipment } from "@shared/schema";
import { getEquipmentOperabilityStatus } from "./equipment-view-model";

export interface EquipmentFilterState {
  searchTerm: string;
  statuses: string[];
  operabilities: string[];
  categories: string[];
  employees: string[];
}

export interface EquipmentFilterUser {
  id?: string | null;
  name?: string | null;
  username?: string | null;
}

export interface EquipmentFilterCategory {
  id: string;
  parentId?: string | null;
  name: string;
  position?: number | null;
  archivedAt?: unknown;
}

export function matchesAssignedUser(
  assignedTo: string | null | undefined,
  user: EquipmentFilterUser,
) {
  const normalized = String(assignedTo ?? "").trim();
  if (!normalized) return false;
  return [user.id, user.name, user.username]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .includes(normalized);
}

export function matchesEquipmentEmployeeFilter(
  item: Equipment,
  employeeFilters: string[],
  canFilterByEmployee: boolean,
  users: EquipmentFilterUser[],
) {
  if (!canFilterByEmployee || employeeFilters.length === 0) return true;
  const assignedTo = String(item.assignedTo ?? "").trim();
  return employeeFilters.some((employeeFilter) => {
    if (employeeFilter === "unassigned") return !assignedTo;
    if (employeeFilter.startsWith("raw:")) return assignedTo === employeeFilter.slice(4);
    const user = users.find((entry) => entry.id === employeeFilter);
    return user ? matchesAssignedUser(assignedTo, user) : assignedTo === employeeFilter;
  });
}

export function matchesEquipmentBaseFilters(
  item: Equipment,
  filters: Pick<EquipmentFilterState, "searchTerm" | "statuses" | "operabilities" | "categories">,
) {
  const searchLower = filters.searchTerm.toLowerCase();
  const matchesSearch = [item.name, item.model, item.serialNumber, item.inventoryNumber, item.barcode]
    .some((value) => String(value || "").toLowerCase().includes(searchLower));
  const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(String(item.status || ""));
  const matchesOperability = filters.operabilities.length === 0 ||
    filters.operabilities.includes(getEquipmentOperabilityStatus(item));
  const matchesCategory = filters.categories.length === 0 || filters.categories.some((category) => (
    category.startsWith("category:") &&
    String(item.categoryId || "") === category.slice("category:".length)
  ));

  return matchesSearch && matchesStatus && matchesOperability && matchesCategory;
}

export function buildWarehouseCategoryFilterOptions(categories: EquipmentFilterCategory[]) {
  const categoryById = new Map(categories.map((category) => [String(category.id), category]));
  return categories
    .filter((category) => !category.archivedAt)
    .sort((left, right) =>
      Number(left.position || 0) - Number(right.position || 0) ||
      left.name.localeCompare(right.name, "ru"),
    )
    .map((category) => ({
      value: `category:${category.id}`,
      label: category.parentId
        ? `${categoryById.get(String(category.parentId))?.name || "Категория"} / ${category.name}`
        : category.name,
    }));
}

export function countActiveEquipmentFilters(
  filters: EquipmentFilterState,
  includeEmployee: boolean,
) {
  return Number(filters.statuses.length > 0) +
    Number(filters.operabilities.length > 0) +
    Number(filters.categories.length > 0) +
    Number(Boolean(filters.searchTerm.trim())) +
    Number(includeEmployee && filters.employees.length > 0);
}
