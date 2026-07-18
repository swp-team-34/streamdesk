import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StreamSelect } from "./stream-select";

describe("StreamSelect", () => {
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

  it("selects an item from a searchable list and closes it", () => {
    const onValueChange = vi.fn();
    render(
      <StreamSelect
        value="medium"
        ariaLabel="Приоритет"
        searchable
        options={[
          { value: "low", label: "Низкий" },
          { value: "medium", label: "Средний" },
          { value: "high", label: "Высокий" },
        ]}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Приоритет" }));
    fireEvent.change(screen.getByPlaceholderText("Поиск…"), { target: { value: "Выс" } });
    fireEvent.click(screen.getByRole("option", { name: "Высокий" }));

    expect(onValueChange).toHaveBeenCalledWith("high");
    expect(screen.queryByPlaceholderText("Поиск…")).not.toBeInTheDocument();
  });

  it("selects an item from a compact list", () => {
    const onValueChange = vi.fn();
    render(
      <StreamSelect
        value="medium"
        ariaLabel="Компактный приоритет"
        options={[
          { value: "medium", label: "Средний" },
          { value: "high", label: "Высокий" },
        ]}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Компактный приоритет" }));
    fireEvent.click(screen.getByText("Высокий"));

    expect(onValueChange).toHaveBeenCalledWith("high");
  });
});
