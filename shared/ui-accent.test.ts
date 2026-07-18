import { describe, expect, it } from "vitest";
import {
  analyzeUiAccent,
  buildUiAccentVariables,
  colorContrast,
  normalizeHexColor,
} from "./ui-accent";

describe("UI accent accessibility", () => {
  it("accepts the approved Linear lavender on light and dark surfaces", () => {
    const result = analyzeUiAccent("#5e6ad2");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("#5E6AD2");
    expect(result.contrastOnLight).toBeGreaterThanOrEqual(3);
    expect(result.contrastOnDark).toBeGreaterThanOrEqual(3);
    expect(result.foregroundContrast).toBeGreaterThanOrEqual(4.5);
  });

  it("suggests a nearby accessible shade for an unreadable accent", () => {
    const result = analyzeUiAccent("#ffff00");
    expect(result.valid).toBe(false);
    expect(result.suggestion).toMatch(/^#[0-9A-F]{6}$/);
    expect(analyzeUiAccent(result.suggestion).valid).toBe(true);
  });

  it("builds stable hover and muted semantic variants", () => {
    expect(buildUiAccentVariables("#5E6AD2")).toMatchObject({
      accent: "#5E6AD2",
      foreground: "#FFFFFF",
    });
  });

  it("normalizes full hex values and calculates WCAG contrast", () => {
    expect(normalizeHexColor(" #7c6fe5 ")).toBe("#7C6FE5");
    expect(normalizeHexColor("#fff")).toBeNull();
    expect(colorContrast("#000000", "#FFFFFF")).toBeCloseTo(21, 4);
  });
});
