import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_UI_PREFERENCES } from "@shared/ui-preferences";
import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeProbe() {
  const {
    theme,
    preferences,
    isHydratingPreferences,
    preferencesError,
    savePreferences,
  } = useTheme();
  const [saveResult, setSaveResult] = useState<string>("");
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="accent">{preferences.accent}</span>
      <span data-testid="hydrating">{String(isHydratingPreferences)}</span>
      <span data-testid="error">{preferencesError || ""}</span>
      <span data-testid="save-result">{saveResult}</span>
      <button
        type="button"
        onClick={async () => {
          const saved = await savePreferences({ ...preferences, theme: "dark" });
          setSaveResult(String(saved));
        }}
      >
        Save dark
      </button>
    </div>
  );
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the server profile as source of truth and refreshes the local cache", async () => {
    const serverPreferences = {
      ...DEFAULT_USER_UI_PREFERENCES,
      theme: "dark" as const,
      accent: "#0F766E",
      sidebarCollapsed: true,
    };
    localStorage.setItem("streamstudio-theme-preferences:user-1", JSON.stringify({
      ...DEFAULT_USER_UI_PREFERENCES,
      theme: "light",
    }));
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ preferences: serverPreferences })));

    render(
      <ThemeProvider userId="user-1">
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("hydrating")).toHaveTextContent("false"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("accent")).toHaveTextContent("#0F766E");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#0F766E");
    expect(JSON.parse(localStorage.getItem("streamstudio-theme-preferences:user-1") || "{}"))
      .toMatchObject(serverPreferences);
  });

  it("rolls an optimistic preview back when server persistence fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ preferences: DEFAULT_USER_UI_PREFERENCES }))
      .mockResolvedValueOnce(jsonResponse({ message: "Save failed" }, false));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ThemeProvider userId="user-1">
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("hydrating")).toHaveTextContent("false"));
    fireEvent.click(screen.getByRole("button", { name: "Save dark" }));

    await waitFor(() => expect(screen.getByTestId("save-result")).toHaveTextContent("false"));
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("error")).toHaveTextContent("Save failed");
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/users/me/ui-preferences"),
      expect.objectContaining({ method: "PUT", credentials: "include" }),
    );
  });
});
