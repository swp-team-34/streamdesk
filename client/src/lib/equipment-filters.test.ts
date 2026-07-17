import { describe, expect, it } from "vitest";
import type { Equipment } from "@shared/schema";
import {
  buildWarehouseCategoryFilterOptions,
  countActiveEquipmentFilters,
  matchesEquipmentBaseFilters,
  matchesEquipmentEmployeeFilter,
} from "./equipment-filters";

function equipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "equipment-1",
    name: "Cinema Camera",
    type: "camera",
    status: "available",
    categoryId: "camera-category",
    ...overrides,
  } as Equipment;
}

describe("equipment filters", () => {
  it("combines search, status, operability and taxonomy filters", () => {
    const item = equipment({
      serialNumber: "SER-42",
      operabilityStatus: "working",
    });
    expect(matchesEquipmentBaseFilters(item, {
      searchTerm: "ser-42",
      statuses: ["available", "in-use"],
      operabilities: ["working"],
      categories: ["category:camera-category"],
    })).toBe(true);
    expect(matchesEquipmentBaseFilters(item, {
      searchTerm: "ser-42",
      statuses: ["in-use"],
      operabilities: ["working"],
      categories: ["category:camera-category"],
    })).toBe(false);
  });

  it("supports canonical users, raw legacy assignees and unassigned items", () => {
    const users = [{ id: "user-1", name: "Tim", username: "tim" }];
    expect(matchesEquipmentEmployeeFilter(equipment({ assignedTo: "Tim" }), ["user-1", "unassigned"], true, users)).toBe(true);
    expect(matchesEquipmentEmployeeFilter(equipment({ assignedTo: "legacy" }), ["raw:legacy"], true, users)).toBe(true);
    expect(matchesEquipmentEmployeeFilter(equipment({ assignedTo: null }), ["unassigned"], true, users)).toBe(true);
    expect(matchesEquipmentEmployeeFilter(equipment({ assignedTo: "other" }), ["user-1"], false, users)).toBe(true);
  });

  it("orders active category paths without mutating the query result", () => {
    const categories = [
      { id: "child", parentId: "parent", name: "Cinema", position: 2 },
      { id: "archived", name: "Old", position: 0, archivedAt: "2026-01-01" },
      { id: "parent", name: "Cameras", position: 1 },
    ];
    const snapshot = categories.map((category) => ({ ...category }));
    expect(buildWarehouseCategoryFilterOptions(categories)).toEqual([
      { value: "category:parent", label: "Cameras" },
      { value: "category:child", label: "Cameras / Cinema" },
    ]);
    expect(categories).toEqual(snapshot);
  });

  it("counts only visible active filters", () => {
    const filters = {
      searchTerm: "camera",
      statuses: ["available"],
      operabilities: [],
      categories: [],
      employees: ["user-1"],
    };
    expect(countActiveEquipmentFilters(filters, true)).toBe(3);
    expect(countActiveEquipmentFilters(filters, false)).toBe(2);
  });
});
