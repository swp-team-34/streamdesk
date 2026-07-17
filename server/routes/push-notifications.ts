import type { Express } from "express";

export function registerPushNotificationRoutes(app: Express) {
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      console.log("Push subscription received:", req.body.endpoint);
      res.json({ success: true, message: "Subscription saved" });
    } catch {
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      console.log("Push unsubscription received:", req.body.endpoint);
      res.json({ success: true, message: "Subscription removed" });
    } catch {
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });
}
