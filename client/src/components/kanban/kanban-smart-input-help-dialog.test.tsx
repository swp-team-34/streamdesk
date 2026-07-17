import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanSmartInputHelpDialog } from "./kanban-smart-input-help-dialog";

afterEach(cleanup);

describe("KanbanSmartInputHelpDialog", () => {
  it("shows supported smart-input syntax and closes explicitly", () => {
    const onOpenChange = vi.fn();
    render(<KanbanSmartInputHelpDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByText(/Подготовить эфир завтра/)).toBeInTheDocument();
    expect(screen.getByText(/Приоритет: low\/medium\/high\/urgent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Понятно" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
