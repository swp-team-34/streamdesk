import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StatusCards from "./status-cards";

afterEach(cleanup);

describe("StatusCards", () => {
  it("fills the configured widget height and keeps equal card padding", () => {
    const { container } = render(
      <StatusCards
        stats={{
          onlineSystems: "0/0",
          activeStreams: 0,
          networkMbps: 0,
          todayEvents: 0,
          kanbanCompletion: { percent: 17, completed: 2, total: 12 },
        }}
      />,
    );

    expect(container.firstElementChild).toHaveClass("h-full");
    const firstCard = screen.getByTestId("status-card-0");
    expect(firstCard).toHaveClass("h-full");
    expect(firstCard.firstElementChild).toHaveClass("h-full", "!p-3");
    expect(firstCard.closest("a")).toHaveAttribute("href", "/monitoring");
    expect(screen.getByText("Задачи").closest("a")).toHaveAttribute("href", "/tasks");
  });
});
