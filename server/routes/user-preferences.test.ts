import express from "express";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_UI_PREFERENCES } from "@shared/ui-preferences";
import {
  registerUserPreferenceRoutes,
  type UserPreferenceRouteStorage,
} from "./user-preferences";

function routeHandler(app: express.Express, method: string, path: string) {
  const layer = ((app as any)._router?.stack || [])
    .find((item: any) => item.route?.path === path && item.route?.methods?.[method.toLowerCase()]);
  return layer?.route?.stack?.[0]?.handle as ((req: any, res: any) => Promise<void>) | undefined;
}

function responseRecorder() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response;
}

describe("user UI preference routes", () => {
  it("requires the authenticated session user", async () => {
    const app = express();
    const storage: UserPreferenceRouteStorage = {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    };
    registerUserPreferenceRoutes(app, storage);
    const getPreferences = routeHandler(app, "GET", "/api/users/me/ui-preferences");
    const response = responseRecorder();

    await getPreferences?.({ user: null }, response);

    expect(response.statusCode).toBe(401);
    expect(storage.getUser).not.toHaveBeenCalled();
  });

  it("normalizes missing or corrupt stored preferences", async () => {
    const app = express();
    const storage: UserPreferenceRouteStorage = {
      getUser: vi.fn(async () => ({
        id: "user-1",
        uiPreferences: { theme: "dark", accent: "broken" },
      })),
      updateUser: vi.fn(),
    };
    registerUserPreferenceRoutes(app, storage);
    const getPreferences = routeHandler(app, "GET", "/api/users/me/ui-preferences");
    const response = responseRecorder();

    await getPreferences?.({ user: { id: "user-1" } }, response);

    expect(response.body).toEqual({
      preferences: {
        ...DEFAULT_USER_UI_PREFERENCES,
        theme: "dark",
      },
    });
  });

  it("persists only validated preferences for the session user", async () => {
    const app = express();
    const storage: UserPreferenceRouteStorage = {
      getUser: vi.fn(),
      updateUser: vi.fn(async (id, data) => ({ id, ...data })),
    };
    registerUserPreferenceRoutes(app, storage);
    const putPreferences = routeHandler(app, "PUT", "/api/users/me/ui-preferences");
    const response = responseRecorder();
    const preferences = {
      ...DEFAULT_USER_UI_PREFERENCES,
      theme: "sepia" as const,
      accent: "#7c6fe5",
      sidebarCollapsed: true,
    };

    await putPreferences?.({
      user: { id: "user-1" },
      body: { preferences, userId: "user-2" },
    }, response);

    expect(storage.updateUser).toHaveBeenCalledWith("user-1", {
      uiPreferences: { ...preferences, accent: "#7C6FE5" },
    });
    expect(response.body.preferences.accent).toBe("#7C6FE5");
  });

  it("rejects invalid accents without writing", async () => {
    const app = express();
    const storage: UserPreferenceRouteStorage = {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    };
    registerUserPreferenceRoutes(app, storage);
    const putPreferences = routeHandler(app, "PUT", "/api/users/me/ui-preferences");
    const response = responseRecorder();

    await putPreferences?.({
      user: { id: "user-1" },
      body: { preferences: { ...DEFAULT_USER_UI_PREFERENCES, accent: "purple" } },
    }, response);

    expect(response.statusCode).toBe(400);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });

  it("suggests an accessible replacement for a valid but unreadable color", async () => {
    const app = express();
    const storage: UserPreferenceRouteStorage = {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    };
    registerUserPreferenceRoutes(app, storage);
    const putPreferences = routeHandler(app, "PUT", "/api/users/me/ui-preferences");
    const response = responseRecorder();

    await putPreferences?.({
      user: { id: "user-1" },
      body: { preferences: { ...DEFAULT_USER_UI_PREFERENCES, accent: "#FFFF00" } },
    }, response);

    expect(response.statusCode).toBe(400);
    expect(response.body.suggestion).toMatch(/^#[0-9A-F]{6}$/);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });
});
