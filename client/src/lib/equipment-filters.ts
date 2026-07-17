import type { Equipment } from "@shared/schema";
import { getEquipmentOperabilityStatus } from "./equipment-view-model";

export interface EquipmentFilterState {
  searchTerm: string;
  status: string;
  operability: string;
  category: string;
  employee: string;
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
  employeeFilter: string,
  canFilterByEmployee: boolean,
  users: EquipmentFilterUser[],
) {
  if (!canFilterByEmployee || employeeFilter === "all") return true;
  const assignedTo = String(item.assignedTo ?? "").trim();
  if (employeeFilter === "unassigned") return !assignedTo;
  if (employeeFilter.startsWith("raw:")) return assignedTo === employeeFilter.slice(4);
  const user = users.find((entry) => entry.id === employeeFilter);
  return user ? matchesAssignedUser(assignedTo, user) : assignedTo === employeeFilter;
}

export function matchesEquipmentBaseFilters(
  item: Equipment,
  filters: Pick<EquipmentFilterState, "searchTerm" | "status" | "operability" | "category">,
) {
  const searchLower = filters.searchTerm.toLowerCase();
  const matchesSearch = [item.name, item.model, item.serialNumber, item.inventoryNumber, item.barcode]
    .some((value) => String(value || "").toLowerCase().includes(searchLower));
  const matchesStatus = filters.status === "all" || item.status === filters.status;
  const matchesOperability = filters.operability === "all" ||
    getEquipmentOperabilityStatus(item) === filters.operability;
  const matchesCategory = filters.category === "all" || (
    filters.category.startsWith("category:") &&
    String(item.categoryId || "") === filters.category.slice("category:".length)
  );

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
  return Number(filters.status !== "all") +
    Number(filters.operability !== "all") +
    Number(filters.category !== "all") +
    Number(Boolean(filters.searchTerm.trim())) +
    Number(includeEmployee && filters.employee !== "all");
}
