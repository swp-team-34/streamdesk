import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StreamDatePicker } from "./stream-date-picker";

afterEach(cleanup);

describe("StreamDatePicker", () => {
  it("formats date-only values without a timezone shift and can clear them", () => {
    const onChange = vi.fn();
    render(
      <StreamDatePicker
        value="2026-07-17"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("button", { name: /17 июля 2026/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /17 июля 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: "Очистить" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
