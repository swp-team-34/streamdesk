import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StreamColorPicker } from "./stream-color-picker";

afterEach(cleanup);

describe("StreamColorPicker", () => {
  it("chooses presets and adjusts colors without a native color dialog or HEX field", () => {
    const onChange = vi.fn();
    const { container } = render(
      <StreamColorPicker
        value="#5E6AD2"
        onChange={onChange}
        ariaLabel="Цвет зоны"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Цвет зоны" }));
    fireEvent.click(screen.getByRole("radio", { name: "Бирюзовый" }));
    expect(onChange).toHaveBeenCalledWith("#0F766E");

    fireEvent.change(screen.getByRole("slider", { name: "Оттенок" }), { target: { value: "120" } });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(container.querySelector('input[type="color"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
