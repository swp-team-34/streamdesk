import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_UI_PREFERENCES,
  normalizeUserUiPreferences,
  userUiPreferencesSchema,
} from "./ui-preferences";

describe("user UI preferences", () => {
  it("recovers malformed stored values field by field", () => {
    expect(normalizeUserUiPreferences({
      theme: "dark",
      autoTheme: "yes",
      accent: "not-a-color",
      sidebarCollapsed: true,
    })).toEqual({
      ...DEFAULT_USER_UI_PREFERENCES,
      theme: "dark",
      sidebarCollapsed: true,
    });
  });

  it("normalizes a valid custom accent for stable cache comparisons", () => {
    expect(normalizeUserUiPreferences({
      theme: "warm",
      autoTheme: true,
      accent: "#7c6fe5",
      sidebarCollapsed: false,
    }).accent).toBe("#7C6FE5");
  });

  it("rejects unsupported themes and short hex colors at the API boundary", () => {
    expect(userUiPreferencesSchema.safeParse({
      ...DEFAULT_USER_UI_PREFERENCES,
      theme: "neon",
    }).success).toBe(false);
    expect(userUiPreferencesSchema.safeParse({
      ...DEFAULT_USER_UI_PREFERENCES,
      accent: "#fff",
    }).success).toBe(false);
  });
});
