import type { Express } from "express";
import {
  normalizeUserUiPreferences,
  userUiPreferencesSchema,
  type UserUiPreferences,
} from "@shared/ui-preferences";
import { analyzeUiAccent } from "@shared/ui-accent";

export type UserPreferenceRow = {
  id: string;
  uiPreferences?: unknown;
};

export type UserPreferenceRouteStorage = {
  getUser: (id: string) => Promise<UserPreferenceRow | undefined>;
  updateUser: (
    id: string,
    data: { uiPreferences: UserUiPreferences },
  ) => Promise<UserPreferenceRow | undefined>;
};

export function registerUserPreferenceRoutes(
  app: Express,
  storage: UserPreferenceRouteStorage,
) {
  app.get("/api/users/me/ui-preferences", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Требуется авторизация" });
      const user = await storage.getUser(String(userId));
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      res.json({ preferences: normalizeUserUiPreferences(user.uiPreferences) });
    } catch {
      res.status(500).json({ message: "Не удалось загрузить настройки интерфейса" });
    }
  });

  app.put("/api/users/me/ui-preferences", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Требуется авторизация" });
      const parsed = userUiPreferencesSchema.safeParse(req.body?.preferences ?? req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Некорректные настройки интерфейса",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      const accent = analyzeUiAccent(parsed.data.accent);
      if (!accent.valid) {
        return res.status(400).json({
          message: "Цвет акцента не соответствует требованиям контраста",
          suggestion: accent.suggestion,
        });
      }
      const preferences = normalizeUserUiPreferences(parsed.data);
      const user = await storage.updateUser(String(userId), { uiPreferences: preferences });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      res.json({ preferences });
    } catch {
      res.status(500).json({ message: "Не удалось сохранить настройки интерфейса" });
    }
  });
}
