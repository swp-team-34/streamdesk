import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoardSettingsDialog } from "./kanban-board-settings-dialog";

afterEach(cleanup);

describe("KanbanBoardSettingsDialog", () => {
  it("renders board context and delegates closing", () => {
    const onOpenChange = vi.fn();
    render(
      <KanbanBoardSettingsDialog open boardName="Production" onOpenChange={onOpenChange}>
        <div>Settings sections</div>
      </KanbanBoardSettingsDialog>,
    );
    expect(screen.getByText("Production: участники и палитра меток.")).toBeInTheDocument();
    expect(screen.getByText("Settings sections")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
