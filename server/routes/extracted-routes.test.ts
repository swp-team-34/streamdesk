import express from "express";
import { describe, expect, it, vi } from "vitest";
import { registerNotificationRoutes, type NotificationRouteStorage } from "./notifications";
import { registerPushNotificationRoutes } from "./push-notifications";
import { registerRoomRoutes } from "./rooms";

function registeredRoutes(app: express.Express) {
  return ((app as any)._router?.stack || [])
    .filter((layer: any) => layer.route)
    .flatMap((layer: any) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));
}

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

describe("extracted route registrars", () => {
  it("registers room and push routes without sharing room mutations between apps", async () => {
    const firstApp = express();
    const secondApp = express();
    registerRoomRoutes(firstApp);
    registerRoomRoutes(secondApp);
    registerPushNotificationRoutes(firstApp);

    expect(registeredRoutes(firstApp)).toEqual(expect.arrayContaining([
      "GET /api/rooms",
      "PUT /api/rooms/:id",
      "POST /api/push/subscribe",
      "POST /api/push/unsubscribe",
    ]));

    const updateRoom = routeHandler(firstApp, "PUT", "/api/rooms/:id");
    const getSecondRoom = routeHandler(secondApp, "GET", "/api/rooms/:id");
    const updated = responseRecorder();
    const untouched = responseRecorder();
    await updateRoom?.({ params: { id: "100" }, body: { capacity: 99 } }, updated);
    await getSecondRoom?.({ params: { id: "100" } }, untouched);

    expect(updated.body.capacity).toBe(99);
    expect(untouched.body.capacity).toBe(4);
  });

  it("keeps notification reads scoped to the authenticated user", async () => {
    const app = express();
    const storage: NotificationRouteStorage = {
      getNotificationsByUser: vi.fn(async () => [{ id: "notification-1" }]),
      createNotification: vi.fn(),
      markNotificationRead: vi.fn(async () => true),
      markAllNotificationsRead: vi.fn(async () => 1),
      deleteNotification: vi.fn(async () => true),
    };
    registerNotificationRoutes(app, storage);
    const listNotifications = routeHandler(app, "GET", "/api/notifications/:userId");

    const denied = responseRecorder();
    await listNotifications?.({ params: { userId: "user-2" }, user: { id: "user-1" } }, denied);
    expect(denied.statusCode).toBe(404);
    expect(storage.getNotificationsByUser).not.toHaveBeenCalled();

    const allowed = responseRecorder();
    await listNotifications?.({ params: { userId: "user-1" }, user: { id: "user-1" } }, allowed);
    expect(allowed.body).toEqual([{ id: "notification-1" }]);
  });
});
