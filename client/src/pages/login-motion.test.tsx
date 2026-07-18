import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "./login";

describe("login ambient motion", () => {
  afterEach(cleanup);

  it("keeps the ambient pulse without animating a filtered compositor layer", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Login onLogin={vi.fn()} />
      </QueryClientProvider>,
    );

    const ambientLayer = container.querySelector(
      ".pointer-events-none.absolute.inset-0.overflow-hidden",
    );

    expect(ambientLayer).toBeInTheDocument();
    const pulsingLayers = Array.from(
      ambientLayer?.querySelectorAll(".animate-pulse") ?? [],
    );

    expect(pulsingLayers.length).toBeGreaterThan(0);
    expect(
      pulsingLayers.every((node) =>
        Array.from(node.classList).every((className) => !className.startsWith("blur-")),
      ),
    ).toBe(true);
    expect(
      pulsingLayers.every((node) => {
        const style = node.getAttribute("style") || "";
        return style.includes("color-mix") && !style.includes("hsl(var(--primary)");
      }),
    ).toBe(true);
  });
});
