import express from "express";
import { describe, expect, it } from "vitest";
import { registerRoutes } from "./routes";
import { storage } from "./database";

async function createAppWithRoutes() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);
  return app;
}

function registeredRoutes(app: express.Express) {
  return ((app as any)._router?.stack || [])
    .filter((layer: any) => layer.route)
    .flatMap((layer: any) => Object.keys(layer.route.methods).map((method) => ({
      method: method.toUpperCase(),
      path: layer.route.path,
    })));
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

describe("equipment detail route registration", () => {
  it("registers GET /api/equipment/:id for item details", async () => {
    const app = await createAppWithRoutes();

    expect(registeredRoutes(app)).toContainEqual({
      method: "GET",
      path: "/api/equipment/:id",
    });
  });

  it("returns equipment details with an operability fallback", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "GET", "/api/equipment/:id");
    const [item] = await storage.getEquipment();
    const res = createJsonResponse();

    await handler!({ user: { id: "admin-stub-default-id", role: "admin" }, params: { id: item.id } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: item.id,
      name: item.name,
      operabilityStatus: expect.any(String),
    });
  });

  it("returns 404 for missing equipment ids", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "GET", "/api/equipment/:id");
    const res = createJsonResponse();

    await handler!({ user: { id: "admin-stub-default-id", role: "admin" }, params: { id: "missing" } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      message: expect.any(String),
    });
  });
});

describe("equipment request actions", () => {
  it("normalizes direct take payloads from JSON before updating equipment", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const [item] = await storage.getEquipment();
    const res = createJsonResponse();
    const lastUsed = new Date("2026-07-01T20:00:00.000Z").toISOString();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      params: { id: item.id },
      body: {
        status: "in-use",
        assignedTo: "admin-stub-default-id",
        location: "У сотрудника Tim",
        lastUsed,
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: item.id,
      status: "in-use",
      assignedTo: "admin-stub-default-id",
      location: "У сотрудника Tim",
    });
    expect(res.body.lastUsed).toBeInstanceOf(Date);
  });

  it("blocks direct take actions for non-working equipment", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const [item] = await storage.getEquipment();
    await storage.updateEquipment(item.id, { status: "available", operabilityStatus: "broken" } as any);
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      params: { id: item.id },
      body: {
        status: "in-use",
        assignedTo: "admin-stub-default-id",
        lastUsed: new Date("2026-07-01T20:00:00.000Z").toISOString(),
      },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: expect.stringContaining("недоступно"),
    });

    await storage.updateEquipment(item.id, { status: "available", operabilityStatus: "working" } as any);
  });

  it("requires a positive integer quantity for checkout requests", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const [item] = await storage.getEquipment();
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        quantity: "",
      },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      message: expect.stringContaining("Количество"),
    });
  });

  it("stores checkout request quantity and task links", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const [item] = await storage.getEquipment();
    const board = await storage.createKanbanBoard({
      name: "Equipment request board",
      visibility: "personal",
      createdByUserId: "admin-stub-default-id",
    } as any);
    const list = await storage.createKanbanList({
      boardId: board.id,
      name: "Requests",
      type: "active",
      position: 0,
    } as any);
    const card = await storage.createKanbanCard({
      boardId: board.id,
      listId: list.id,
      title: "Linked Kanban card",
      creatorUserId: "admin-stub-default-id",
      position: 0,
    } as any);
    const task = await storage.createTask({
      title: "Linked legacy task",
      status: "todo",
      priority: "medium",
      creatorId: "admin-stub-default-id",
    } as any);
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        quantity: "2",
        kanbanCardId: card.id,
        taskId: task.id,
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      equipmentId: item.id,
      quantity: 2,
      kanbanCardId: card.id,
      taskId: task.id,
      status: "pending",
    });
  });

  it("allows checkout requests without task links", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const [item] = await storage.getEquipment();
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        quantity: 1,
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      equipmentId: item.id,
      quantity: 1,
      status: "pending",
    });
    expect((res.body as any).kanbanCardId ?? null).toBeNull();
    expect((res.body as any).taskId ?? null).toBeNull();
  });

  it("blocks checkout requests for broken or on-repair equipment", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const [item] = await storage.getEquipment();

    await storage.updateEquipment(item.id, { status: "available", operabilityStatus: "broken" } as any);
    const brokenResponse = createJsonResponse();
    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        quantity: 1,
      },
    }, brokenResponse);

    expect(brokenResponse.statusCode).toBe(400);
    expect(brokenResponse.body).toMatchObject({
      message: expect.stringContaining("неисправно"),
    });

    await storage.updateEquipment(item.id, { status: "available", operabilityStatus: "on_repair" } as any);
    const repairResponse = createJsonResponse();
    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        quantity: 1,
      },
    }, repairResponse);

    expect(repairResponse.statusCode).toBe(400);
    expect(repairResponse.body).toMatchObject({
      message: expect.stringContaining("ремонте"),
    });

    await storage.updateEquipment(item.id, { status: "available", operabilityStatus: "working" } as any);
  });

  it("rejects checkout requests with missing task or Kanban card links", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const [item] = await storage.getEquipment();
    const missingCardResponse = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        quantity: 1,
        kanbanCardId: "missing-card",
      },
    }, missingCardResponse);

    expect(missingCardResponse.statusCode).toBe(400);
    expect(missingCardResponse.body).toMatchObject({
      message: expect.stringContaining("карточ"),
    });

    const missingTaskResponse = createJsonResponse();
    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        quantity: 1,
        taskId: "missing-task",
      },
    }, missingTaskResponse);

    expect(missingTaskResponse.statusCode).toBe(400);
    expect(missingTaskResponse.body).toMatchObject({
      message: expect.stringContaining("задач"),
    });
  });
});
