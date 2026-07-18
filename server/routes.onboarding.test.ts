import express from "express";
import { describe, expect, it } from "vitest";
import { registerRoutes } from "./routes";

async function createAppWithRoutes() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);
  return app;
}

function routeHandler(app: express.Express, method: string, path: string) {
  const layer = ((app as any)._router?.stack || [])
    .find((item: any) => item.route?.path === path && item.route?.methods?.[method.toLowerCase()]);
  return layer?.route?.stack?.[0]?.handle as ((req: any, res: any) => Promise<void>) | undefined;
}

function createJsonResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe("workspace onboarding state", () => {
  it("keeps a pending user in onboarding when the completion flag is null", async () => {
    const app = await createAppWithRoutes();
    const getOnboardingState = routeHandler(app, "GET", "/api/auth/onboarding-state");
    const response = createJsonResponse();

    expect(getOnboardingState).toBeTypeOf("function");
    await getOnboardingState!({
      user: {
        id: `pending-onboarding-${Date.now()}`,
        name: "Pending onboarding user",
        role: "employee",
        permissions: [],
        onboardingCompleted: null,
        workspaceMode: "pending",
      },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      user: {
        onboardingCompleted: false,
        workspaceMode: "pending",
      },
    });
  });
});
