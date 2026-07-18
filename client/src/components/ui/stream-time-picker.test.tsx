import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseStreamSelectOption } from "@/test-utils/stream-select";
import { StreamTimePicker } from "./stream-time-picker";

afterEach(cleanup);

describe("StreamTimePicker", () => {
  it("updates hours and minutes through custom dropdowns", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("09:00");
      return (
        <StreamTimePicker
          value={value}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "09:00" }));
    chooseStreamSelectOption("Часы", "14");
    chooseStreamSelectOption("Минуты", "30");

    expect(onChange).toHaveBeenNthCalledWith(1, "14:00");
    expect(onChange).toHaveBeenNthCalledWith(2, "14:30");
  });
});
