import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WarehouseFilters } from "./warehouse-filters";

function createProps() {
  return {
    mobileOpen: false,
    searchTerm: "camera",
    status: "all",
    category: "all",
    operability: "all",
    employee: "all",
    activeFilterCount: 1,
    canFilterByEmployee: true,
    categoryOptions: [{ value: "category:camera", label: "Cameras" }],
    employeeOptions: [{ id: "user-1", label: "Tim", count: 2 }],
    unknownEmployeeOptions: [],
    selectedCount: 2,
    filteredCount: 3,
    exportCount: 3,
    printCount: 2,
    bundleCount: 2,
    printPending: false,
    bundlePending: false,
    onMobileOpenChange: vi.fn(),
    onSearchTermChange: vi.fn(),
    onStatusChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onOperabilityChange: vi.fn(),
    onEmployeeChange: vi.fn(),
    onReset: vi.fn(),
    onToggleSelectAll: vi.fn(),
    onExport: vi.fn(),
    onPrint: vi.fn(),
    onCreateBundle: vi.fn(),
  };
}

afterEach(cleanup);

describe("WarehouseFilters", () => {
  it("delegates search, reset and batch actions", () => {
    const props = createProps();
    render(<WarehouseFilters {...props} />);
    fireEvent.change(screen.getByLabelText("Поиск оборудования"), { target: { value: "audio" } });
    fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
    fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
    fireEvent.click(screen.getByRole("button", { name: "Выбрать все" }));
    fireEvent.click(screen.getByRole("button", { name: "Отчёт Excel (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Печать (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Собрать (2)" }));

    expect(props.onSearchTermChange).toHaveBeenNthCalledWith(1, "audio");
    expect(props.onSearchTermChange).toHaveBeenNthCalledWith(2, "");
    expect(props.onReset).toHaveBeenCalledOnce();
    expect(props.onToggleSelectAll).toHaveBeenCalledOnce();
    expect(props.onExport).toHaveBeenCalledOnce();
    expect(props.onPrint).toHaveBeenCalledOnce();
    expect(props.onCreateBundle).toHaveBeenCalledOnce();
  });

  it("disables unavailable batch operations", () => {
    render(
      <WarehouseFilters
        {...createProps()}
        selectedCount={0}
        exportCount={0}
        printCount={0}
        bundleCount={1}
      />,
    );
    expect(screen.getByRole("button", { name: "Отчёт в Excel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Печать этикеток" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Собрать комплект" })).toBeDisabled();
  });
});
