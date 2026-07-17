import type { Express } from "express";
import { insertNotificationSchema } from "@shared/schema";
import { withDbTimeout } from "../services/db-timeout";

export type NotificationRouteStorage = {
  getNotificationsByUser: (userId: string) => Promise<unknown[]>;
  createNotification: (data: any) => Promise<unknown>;
  markNotificationRead: (id: string) => Promise<boolean>;
  markAllNotificationsRead: (userId: string) => Promise<number>;
  deleteNotification: (id: string) => Promise<boolean>;
};

export function registerNotificationRoutes(app: Express, storage: NotificationRouteStorage) {
  app.get("/api/notifications/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!req.user?.id || String(userId) !== String(req.user.id)) {
      return res.status(404).json({ message: "Notifications not found" });
    }
    const notifications = await withDbTimeout(
      () => storage.getNotificationsByUser(userId),
      3000,
      [],
    );
    res.json(notifications);
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const notificationData = insertNotificationSchema.parse({ ...req.body, userId: req.user.id });
      res.json(await storage.createNotification(notificationData));
    } catch {
      res.status(400).json({ message: "Invalid notification data" });
    }
  });

  const markNotificationRead = async (req: any, res: any) => {
    try {
      const { id } = req.params;
      if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const ownNotifications = await storage.getNotificationsByUser(req.user.id);
      if (!ownNotifications.some((notification: any) => String(notification.id) === String(id))) {
        return res.status(404).json({ message: "Notification not found" });
      }
      if (!(await storage.markNotificationRead(id))) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  };
  app.patch("/api/notifications/:id/read", markNotificationRead);
  app.put("/api/notifications/:id/read", markNotificationRead);

  app.put("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Требуется авторизация" });
      res.json({ success: true, count: await storage.markAllNotificationsRead(userId) });
    } catch {
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const ownNotifications = await storage.getNotificationsByUser(req.user.id);
      if (!ownNotifications.some((notification: any) => String(notification.id) === String(id))) {
        return res.status(404).json({ message: "Notification not found" });
      }
      if (!(await storage.deleteNotification(id))) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });
}
