import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceEditForm, ZoneEditForm } from "./schema-edit-forms";

afterEach(cleanup);

describe("connection schema edit forms", () => {
  it("trims and saves zone values", () => {
    const onSave = vi.fn();
    render(
      <ZoneEditForm
        zone={{ id: "zone-1", name: "Stage", position: { x: 0, y: 0 }, width: 300, height: 200 }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Название"), { target: { value: "  Main stage  " } });
    fireEvent.click(screen.getByText("Сохранить"));

    expect(onSave).toHaveBeenCalledWith("Main stage", "#3b82f6");
  });

  it("converts multiline device ports into typed port collections", () => {
    const onSave = vi.fn();
    render(
      <DeviceEditForm
        device={{
          id: "device-1",
          name: "Switcher",
          type: "video",
          position: { x: 0, y: 0 },
          portsIn: [{ id: "old-in", name: "HDMI", type: "in" }],
          portsOut: [{ id: "old-out", name: "SDI", type: "out" }],
        }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "HDMI\nSDI" } });
    fireEvent.click(screen.getByText("Сохранить"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      portsIn: [
        { id: "in-0", name: "HDMI", type: "in" },
        { id: "in-1", name: "SDI", type: "in" },
      ],
    }));
  });
});
