import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User | null;
      workspace?: {
        type: "company" | "personal" | null;
        companyId: string | null;
        requiresSelection: boolean;
        source: "session" | "persisted" | "automatic" | "none";
      };
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activeWorkspaceType?: "company" | "personal";
    activeCompanyId?: string | null;
  }
}

export {};
