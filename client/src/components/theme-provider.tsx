import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_USER_UI_PREFERENCES,
  normalizeUserUiPreferences,
  type UserUiPreferences,
  type UiThemeMode,
} from "@shared/ui-preferences";
import { analyzeUiAccent, buildUiAccentVariables } from "@shared/ui-accent";
import { apiUrl } from "@/lib/queryClient";

export type Theme = UiThemeMode;

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  userId?: string | null;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
  autoTheme: boolean;
  setAutoTheme: (enabled: boolean) => void;
  preferences: UserUiPreferences;
  savedPreferences: UserUiPreferences;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isHydratingPreferences: boolean;
  isSavingPreferences: boolean;
  preferencesError: string | null;
  previewPreferences: (preferences: UserUiPreferences) => void;
  clearPreferencesPreview: () => void;
  savePreferences: (preferences: UserUiPreferences) => Promise<boolean>;
  resetPreferences: () => Promise<boolean>;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  resolvedTheme: "light",
  autoTheme: false,
  setAutoTheme: () => null,
  preferences: DEFAULT_USER_UI_PREFERENCES,
  savedPreferences: DEFAULT_USER_UI_PREFERENCES,
  sidebarCollapsed: false,
  setSidebarCollapsed: () => null,
  isHydratingPreferences: false,
  isSavingPreferences: false,
  preferencesError: null,
  previewPreferences: () => null,
  clearPreferencesPreview: () => null,
  savePreferences: async () => false,
  resetPreferences: async () => false,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const UI_THEME_CLASSES = ["light", "dark", "warm", "high-contrast", "sepia"];

function getPreferenceCacheKey(storageKey: string, userId?: string | null) {
  return `${storageKey}-preferences:${userId || "last"}`;
}

function readCachedPreferences(
  storageKey: string,
  userId: string | null | undefined,
  defaultTheme: Theme,
) {
  if (typeof window === "undefined") {
    return { ...DEFAULT_USER_UI_PREFERENCES, theme: defaultTheme };
  }
  try {
    const cached = localStorage.getItem(getPreferenceCacheKey(storageKey, userId))
      || localStorage.getItem(getPreferenceCacheKey(storageKey, null));
    if (cached) return normalizeUserUiPreferences(JSON.parse(cached));

    const legacyTheme = localStorage.getItem(storageKey);
    const legacyAuto = localStorage.getItem(`${storageKey}-auto`) === "true";
    const legacyColors = localStorage.getItem(`${storageKey}-colors`);
    let legacyAccent = DEFAULT_USER_UI_PREFERENCES.accent;
    if (legacyColors) {
      const parsed = JSON.parse(legacyColors);
      if (typeof parsed?.primary === "string" && analyzeUiAccent(parsed.primary).valid) {
        legacyAccent = parsed.primary;
      }
    }
    return normalizeUserUiPreferences({
      ...DEFAULT_USER_UI_PREFERENCES,
      theme: legacyTheme?.startsWith("neon") ? "dark" : legacyTheme || defaultTheme,
      autoTheme: legacyAuto,
      accent: legacyAccent,
      sidebarCollapsed: localStorage.getItem("sidebar_collapsed") === "true",
    });
  } catch {
    return { ...DEFAULT_USER_UI_PREFERENCES, theme: defaultTheme };
  }
}

function writeCachedPreferences(
  storageKey: string,
  userId: string | null | undefined,
  preferences: UserUiPreferences,
) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(preferences);
    localStorage.setItem(getPreferenceCacheKey(storageKey, userId), serialized);
    localStorage.setItem(getPreferenceCacheKey(storageKey, null), serialized);
    localStorage.setItem(storageKey, preferences.theme);
    localStorage.setItem(`${storageKey}-auto`, String(preferences.autoTheme));
    localStorage.setItem("sidebar_collapsed", String(preferences.sidebarCollapsed));
    window.dispatchEvent(new Event("sidebar-collapse-change"));
  } catch {
    // Local storage is only a cache. Server persistence remains authoritative.
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "streamstudio-theme",
  userId = null,
  ...props
}: ThemeProviderProps) {
  const [savedPreferences, setSavedPreferences] = useState<UserUiPreferences>(() =>
    readCachedPreferences(storageKey, userId, defaultTheme));
  const [preferencesPreview, setPreferencesPreview] = useState<UserUiPreferences | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("light");
  const [isHydratingPreferences, setIsHydratingPreferences] = useState(Boolean(userId));
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const preferences = preferencesPreview || savedPreferences;

  const applyPreferences = useCallback(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const hour = new Date().getHours();
    let effectiveTheme: "dark" | "light";

    if (preferences.autoTheme) {
      effectiveTheme = hour >= 6 && hour < 20 ? "light" : "dark";
    } else if (preferences.theme === "system" || preferences.theme === "high-contrast") {
      effectiveTheme = systemIsDark ? "dark" : "light";
    } else if (preferences.theme === "warm" || preferences.theme === "sepia") {
      effectiveTheme = "light";
    } else {
      effectiveTheme = preferences.theme;
    }

    root.classList.remove(...UI_THEME_CLASSES);
    root.classList.add(effectiveTheme);
    if (["warm", "high-contrast", "sepia"].includes(preferences.theme)) {
      root.classList.add(preferences.theme);
    }
    root.dataset.theme = effectiveTheme;
    root.dataset.uiTheme = preferences.theme;
    root.style.colorScheme = effectiveTheme;

    const accent = buildUiAccentVariables(preferences.accent);
    root.style.setProperty("--primary", accent.accent);
    root.style.setProperty("--primary-hover", accent.hover);
    root.style.setProperty("--primary-muted", accent.muted);
    root.style.setProperty("--primary-foreground", accent.foreground);
    root.style.setProperty("--ring", accent.accent);
    root.style.setProperty("--sidebar-primary", accent.accent);
    root.style.setProperty("--sidebar-primary-foreground", accent.foreground);
    root.style.setProperty("--sidebar-ring", accent.accent);
    root.style.setProperty("--brand-accent", accent.accent);
    setResolvedTheme(effectiveTheme);
  }, [preferences]);

  useEffect(() => {
    applyPreferences();
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemTheme = () => applyPreferences();
    mediaQuery.addEventListener("change", handleSystemTheme);
    const interval = preferences.autoTheme
      ? window.setInterval(applyPreferences, 60_000)
      : undefined;
    return () => {
      mediaQuery.removeEventListener("change", handleSystemTheme);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [applyPreferences, preferences.autoTheme]);

  useEffect(() => {
    const cached = readCachedPreferences(storageKey, userId, defaultTheme);
    setSavedPreferences(cached);
    setPreferencesPreview(null);
    setPreferencesError(null);
    if (!userId) {
      setIsHydratingPreferences(false);
      return;
    }

    const controller = new AbortController();
    setIsHydratingPreferences(true);
    fetch(apiUrl("/api/users/me/ui-preferences"), {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message || "Не удалось загрузить настройки интерфейса");
        return normalizeUserUiPreferences(body?.preferences);
      })
      .then((serverPreferences) => {
        if (controller.signal.aborted) return;
        setSavedPreferences(serverPreferences);
        writeCachedPreferences(storageKey, userId, serverPreferences);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPreferencesError(error?.message || "Не удалось загрузить настройки интерфейса");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsHydratingPreferences(false);
      });

    return () => controller.abort();
  }, [defaultTheme, storageKey, userId]);

  const savePreferences = useCallback(async (nextValue: UserUiPreferences) => {
    const nextPreferences = normalizeUserUiPreferences(nextValue);
    const accent = analyzeUiAccent(nextPreferences.accent);
    if (!accent.valid) {
      setPreferencesError("Выбранный акцент не соответствует требованиям контраста");
      return false;
    }

    const previousPreferences = savedPreferences;
    setSavedPreferences(nextPreferences);
    setPreferencesPreview(null);
    setPreferencesError(null);
    writeCachedPreferences(storageKey, userId, nextPreferences);
    if (!userId) return true;

    setIsSavingPreferences(true);
    try {
      const response = await fetch(apiUrl("/api/users/me/ui-preferences"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: nextPreferences }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Не удалось сохранить настройки интерфейса");
      const persistedPreferences = normalizeUserUiPreferences(body?.preferences);
      setSavedPreferences(persistedPreferences);
      writeCachedPreferences(storageKey, userId, persistedPreferences);
      return true;
    } catch (error: any) {
      setSavedPreferences(previousPreferences);
      writeCachedPreferences(storageKey, userId, previousPreferences);
      setPreferencesError(error?.message || "Не удалось сохранить настройки интерфейса");
      return false;
    } finally {
      setIsSavingPreferences(false);
    }
  }, [savedPreferences, storageKey, userId]);

  const previewPreferences = useCallback((nextPreferences: UserUiPreferences) => {
    setPreferencesPreview(normalizeUserUiPreferences(nextPreferences));
    setPreferencesError(null);
  }, []);
  const clearPreferencesPreview = useCallback(() => setPreferencesPreview(null), []);
  const resetPreferences = useCallback(
    () => savePreferences(DEFAULT_USER_UI_PREFERENCES),
    [savePreferences],
  );

  const value = useMemo<ThemeProviderState>(() => ({
    theme: preferences.theme,
    setTheme: (newTheme: Theme) => {
      void savePreferences({ ...savedPreferences, theme: newTheme });
    },
    resolvedTheme,
    autoTheme: preferences.autoTheme,
    setAutoTheme: (enabled: boolean) => {
      void savePreferences({ ...savedPreferences, autoTheme: enabled });
    },
    preferences,
    savedPreferences,
    sidebarCollapsed: preferences.sidebarCollapsed,
    setSidebarCollapsed: (collapsed: boolean) => {
      void savePreferences({ ...savedPreferences, sidebarCollapsed: collapsed });
    },
    isHydratingPreferences,
    isSavingPreferences,
    preferencesError,
    previewPreferences,
    clearPreferencesPreview,
    savePreferences,
    resetPreferences,
  }), [
    clearPreferencesPreview,
    isHydratingPreferences,
    isSavingPreferences,
    preferences,
    preferencesError,
    previewPreferences,
    resetPreferences,
    resolvedTheme,
    savePreferences,
    savedPreferences,
  ]);

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
