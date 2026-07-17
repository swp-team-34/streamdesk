import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EquipmentStatus from "./equipment-status";
import QuickCalendar from "./quick-calendar";

describe("dashboard entity navigation", () => {
  it("links equipment rows to the selected warehouse item", () => {
    render(<EquipmentStatus equipment={[{
      id: "equipment-1",
      name: "Камера",
      type: "camera",
      status: "in-use",
    }]} />);

    expect(screen.getByText("Камера").closest("a")?.getAttribute("href"))
      .toBe("/equipment?equipmentId=equipment-1");
  });

  it("links calendar rows to the selected event and day", () => {
    const today = new Date();
    today.setHours(14, 0, 0, 0);
    render(<QuickCalendar events={[{
      id: "event-1",
      title: "Съёмка",
      startTime: today.toISOString(),
      location: "Студия",
      type: "recording",
    }]} />);

    const expectedDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    expect(screen.getByText("Съёмка").closest("a")?.getAttribute("href"))
      .toBe(`/calendar?date=${expectedDate}&view=day&eventId=event-1`);
  });
});
