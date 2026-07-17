import { z } from "zod";
import {
  calendarEventTypeListSchema,
  DEFAULT_CALENDAR_EVENT_TYPES,
  normalizeCalendarEventTypes,
} from "./calendar-event-types";

export const UI_THEME_MODES = [
  "system",
  "light",
  "dark",
  "warm",
  "high-contrast",
  "sepia",
] as const;

export type UiThemeMode = (typeof UI_THEME_MODES)[number];

export const DEFAULT_UI_ACCENT = "#5E6AD2";

export const userUiPreferencesSchema = z.object({
  theme: z.enum(UI_THEME_MODES),
  autoTheme: z.boolean(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  sidebarCollapsed: z.boolean(),
  calendarEventTypes: calendarEventTypeListSchema.default(DEFAULT_CALENDAR_EVENT_TYPES),
});

export type UserUiPreferences = z.infer<typeof userUiPreferencesSchema>;

export const DEFAULT_USER_UI_PREFERENCES: UserUiPreferences = {
  theme: "system",
  autoTheme: false,
  accent: DEFAULT_UI_ACCENT,
  sidebarCollapsed: false,
  calendarEventTypes: DEFAULT_CALENDAR_EVENT_TYPES,
};

export function normalizeUserUiPreferences(value: unknown): UserUiPreferences {
  const input = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  const theme = UI_THEME_MODES.includes(input.theme as UiThemeMode)
    ? input.theme as UiThemeMode
    : DEFAULT_USER_UI_PREFERENCES.theme;
  const accent = typeof input.accent === "string" && /^#[0-9a-f]{6}$/i.test(input.accent)
    ? input.accent.toUpperCase()
    : DEFAULT_USER_UI_PREFERENCES.accent;

  return {
    theme,
    autoTheme: typeof input.autoTheme === "boolean"
      ? input.autoTheme
      : DEFAULT_USER_UI_PREFERENCES.autoTheme,
    accent,
    sidebarCollapsed: typeof input.sidebarCollapsed === "boolean"
      ? input.sidebarCollapsed
      : DEFAULT_USER_UI_PREFERENCES.sidebarCollapsed,
    calendarEventTypes: normalizeCalendarEventTypes(input.calendarEventTypes),
  };
}
