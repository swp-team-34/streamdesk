const LIGHT_SURFACE = "#FAFAF8";
const DARK_SURFACE = "#111217";
const LIGHT_FOREGROUND = "#FFFFFF";
const DARK_FOREGROUND = "#111217";

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export type UiAccentAnalysis = {
  valid: boolean;
  normalized: string;
  suggestion: string;
  foreground: string;
  contrastOnLight: number;
  contrastOnDark: number;
  foregroundContrast: number;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function toHex(value: number) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!/^#[0-9a-f]{6}$/i.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function hexToRgb(value: string): Rgb {
  const normalized = normalizeHexColor(value) || "#000000";
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    if (max === green) hue = 60 * ((blue - red) / delta + 2);
    if (max === blue) hue = 60 * ((red - green) / delta + 4);
  }

  return { h: hue < 0 ? hue + 360 : hue, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = h / 60;
  const intermediate = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment < 1) [red, green] = [chroma, intermediate];
  else if (segment < 2) [red, green] = [intermediate, chroma];
  else if (segment < 3) [green, blue] = [chroma, intermediate];
  else if (segment < 4) [green, blue] = [intermediate, chroma];
  else if (segment < 5) [red, blue] = [intermediate, chroma];
  else [red, blue] = [chroma, intermediate];

  const match = l - chroma / 2;
  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  };
}

function relativeLuminance(value: string) {
  const rgb = hexToRgb(value);
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function colorContrast(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function accentMetrics(accent: string) {
  const lightForegroundContrast = colorContrast(accent, LIGHT_FOREGROUND);
  const darkForegroundContrast = colorContrast(accent, DARK_FOREGROUND);
  const foreground = lightForegroundContrast >= darkForegroundContrast
    ? LIGHT_FOREGROUND
    : DARK_FOREGROUND;
  return {
    foreground,
    contrastOnLight: colorContrast(accent, LIGHT_SURFACE),
    contrastOnDark: colorContrast(accent, DARK_SURFACE),
    foregroundContrast: Math.max(lightForegroundContrast, darkForegroundContrast),
  };
}

function metricsAreAccessible(metrics: ReturnType<typeof accentMetrics>) {
  return metrics.contrastOnLight >= 3
    && metrics.contrastOnDark >= 3
    && metrics.foregroundContrast >= 4.5;
}

export function analyzeUiAccent(value: string): UiAccentAnalysis {
  const normalized = normalizeHexColor(value) || "#5E6AD2";
  const metrics = accentMetrics(normalized);
  if (metricsAreAccessible(metrics)) {
    return { valid: true, normalized, suggestion: normalized, ...metrics };
  }

  const source = rgbToHsl(hexToRgb(normalized));
  let closest: { color: string; distance: number; metrics: ReturnType<typeof accentMetrics> } | null = null;
  for (let step = 0; step <= 160; step += 1) {
    const lightness = 0.1 + step * 0.005;
    const candidate = rgbToHex(hslToRgb({ ...source, l: lightness }));
    const candidateMetrics = accentMetrics(candidate);
    if (!metricsAreAccessible(candidateMetrics)) continue;
    const distance = Math.abs(lightness - source.l);
    if (!closest || distance < closest.distance) {
      closest = { color: candidate, distance, metrics: candidateMetrics };
    }
  }

  const fallback = closest || {
    color: "#5E6AD2",
    distance: 0,
    metrics: accentMetrics("#5E6AD2"),
  };
  return {
    valid: false,
    normalized,
    suggestion: fallback.color,
    ...fallback.metrics,
  };
}

export function buildUiAccentVariables(value: string) {
  const analysis = analyzeUiAccent(value);
  const accent = analysis.valid ? analysis.normalized : analysis.suggestion;
  const source = rgbToHsl(hexToRgb(accent));
  return {
    accent,
    foreground: analysis.valid
      ? analysis.foreground
      : accentMetrics(accent).foreground,
    hover: rgbToHex(hslToRgb({ ...source, l: clamp(source.l - 0.05) })),
    muted: rgbToHex(hslToRgb({ ...source, s: clamp(source.s * 0.55), l: 0.92 })),
  };
}
