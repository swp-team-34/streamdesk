import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WarehouseHistorySheet } from "./warehouse-history-sheet";

afterEach(cleanup);

describe("WarehouseHistorySheet", () => {
  it("shows an empty history state", () => {
    render(<WarehouseHistorySheet open groups={[]} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Пока нет выдач и запросов.")).toBeInTheDocument();
  });

  it("renders grouped equipment and return state", () => {
    render(
      <WarehouseHistorySheet
        open
        onOpenChange={vi.fn()}
        groups={[{
          id: "group-1",
          status: "Сейчас у вас",
          tone: "current",
          date: new Date("2026-07-16T18:38:00.000Z"),
          location: "Studio",
          note: "For recording",
          items: [
            { id: "one", equipmentName: "Camera", model: "C100" },
            { id: "two", equipmentName: "Lens" },
          ],
        }]}
      />,
    );
    expect(screen.getByText("2 позиций оборудования")).toBeInTheDocument();
    expect(screen.getByText("Camera · C100")).toBeInTheDocument();
    expect(screen.getByText(/Вернул: пока на руках/)).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
    expect(screen.getByText("For recording")).toBeInTheDocument();
  });
});
