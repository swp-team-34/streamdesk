import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StreamMultiSelect } from "./stream-multi-select";

describe("StreamMultiSelect", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterAll(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("adds options without closing the list and exposes selected values as removable chips", () => {
    const onValuesChange = vi.fn();
    render(
      <StreamMultiSelect
        ariaLabel="Этапы"
        values={["alpha"]}
        options={[
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ]}
        onValuesChange={onValuesChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Этапы" }));
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));

    expect(onValuesChange).toHaveBeenCalledWith(["alpha", "beta"]);
    expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Убрать Alpha" }));
    expect(onValuesChange).toHaveBeenLastCalledWith([]);
  });

  it("collapses long selections after five chips", () => {
    render(
      <StreamMultiSelect
        ariaLabel="Участники"
        values={["1", "2", "3", "4", "5", "6"]}
        options={["1", "2", "3", "4", "5", "6"].map((value) => ({ value, label: `Option ${value}` }))}
        onValuesChange={vi.fn()}
      />,
    );

    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("Option 6")).not.toBeInTheDocument();
  });

  it("keeps filter selections inside the dropdown when external chips are disabled", () => {
    render(
      <StreamMultiSelect
        ariaLabel="Статусы"
        values={["maintenance", "broken"]}
        options={[
          { value: "maintenance", label: "Обслуживание" },
          { value: "broken", label: "Сломано" },
        ]}
        onValuesChange={vi.fn()}
        showSelectionChips={false}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Статусы" })).toHaveTextContent("Выбрано: 2");
    expect(screen.queryByRole("button", { name: "Убрать Обслуживание" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Статусы" }));
    expect(screen.getByRole("option", { name: "Обслуживание" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Сломано" })).toBeInTheDocument();
  });
});
