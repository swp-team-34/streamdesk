import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EventForm } from "./event-form";

describe("EventForm selectors", () => {
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
    Object.defineProperties(HTMLElement.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      setPointerCapture: { configurable: true, value: () => undefined },
      releasePointerCapture: { configurable: true, value: () => undefined },
      scrollIntoView: { configurable: true, value: () => undefined },
    });
  });

  afterAll(() => vi.unstubAllGlobals());

  it("selects a synced location and keeps the participant list open for multiple choices", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { queryFn: async () => [], retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(["/api/users"], [
      { id: "user-1", name: "Tim", email: "tim@example.test", position: "Producer", department: "Studio" },
      { id: "user-2", name: "Alex", email: "alex@example.test", position: "Operator", department: "Studio" },
    ]);
    queryClient.setQueryData(["/api/locations"], [
      { id: "location-1", name: "Main Stage", status: "available", archivedAt: null },
    ]);
    queryClient.setQueryData(["/api/calendar/event-types"], {
      eventTypes: [{ value: "rehearsal", label: "Репетиция" }],
      canManage: true,
      scope: "company",
    });
    queryClient.setQueryData(["/api/kanban/boards"], []);

    render(
      <QueryClientProvider client={queryClient}>
        <EventForm
          isOpen
          onClose={vi.fn()}
          selectedDate={new Date("2026-07-17T12:00:00")}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Место проведения" }));
    fireEvent.click(screen.getByRole("option", { name: "Main Stage" }));
    expect(screen.getByRole("combobox", { name: "Место проведения" })).toHaveTextContent("Main Stage");

    fireEvent.click(screen.getByRole("combobox", { name: "Участники события" }));
    fireEvent.click(screen.getByRole("option", { name: /Tim/ }));
    fireEvent.click(screen.getByRole("option", { name: /Alex/ }));

    expect(screen.getByRole("combobox", { name: "Участники события" })).toHaveTextContent("Выбрано: 2");
    expect(screen.getByRole("button", { name: "Убрать Tim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Убрать Alex" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Тип события" })).toHaveTextContent("Репетиция");
    expect(screen.getByRole("button", { name: "Цвет события" })).toBeInTheDocument();
  });
});
