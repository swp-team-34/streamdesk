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

let kitSequence = 0;

async function createEquipmentKit(options: { active?: boolean; companyId?: string } = {}) {
  kitSequence += 1;
  const suffix = `${Date.now()}-${kitSequence}`;
  const component = await storage.createEquipment({
    name: `Kit component ${suffix}`,
    type: "camera",
    inventoryNumber: `KIT-C-${suffix}`,
    status: "in-use",
    operabilityStatus: "working",
    location: "В составе комплекта",
    specifications: options.companyId ? { companyId: options.companyId } : {},
  } as any);
  const bundle = await storage.createEquipment({
    name: `Kit ${suffix}`,
    type: "other",
    inventoryNumber: `KIT-B-${suffix}`,
    status: options.active ? "in-use" : "available",
    operabilityStatus: "working",
    location: "Склад A",
    specifications: {
      ...(options.companyId ? { companyId: options.companyId } : {}),
      isSuperPosition: true,
      bundleType: "super_position",
      bundleComponentIds: [component.id],
      bundleComponents: [{
        id: component.id,
        name: component.name,
        inventoryNumber: component.inventoryNumber,
        type: component.type,
      }],
    },
  } as any);
  const linkedComponent = await storage.updateEquipment(component.id, {
    specifications: {
      ...(options.companyId ? { companyId: options.companyId } : {}),
      parentBundleId: bundle.id,
      parentBundleName: bundle.name,
      parentBundleCreatedAt: new Date().toISOString(),
    },
  } as any);
  return { component: linkedComponent!, bundle };
}

async function createCompanyMember(role = "member") {
  const userId = `kit-user-${Date.now()}-${++kitSequence}`;
  const company = await storage.createCompany({
    name: `Kit company ${kitSequence}`,
    ownerId: "admin-stub-default-id",
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId,
    role,
    status: "active",
  } as any);
  return { company, user: { id: userId, role: "employee", name: "Kit employee" } };
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

describe("warehouse kit safety", () => {
  const admin = { id: "admin-stub-default-id", role: "admin", name: "Administrator" };

  it("cancels direct take without changing component or kit storage", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: component.id },
      body: { status: "in-use", assignedTo: admin.id },
    }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      code: "KIT_EXTRACTION_CONFIRMATION_REQUIRED",
      parentBundleId: bundle.id,
    });
    const storedComponent = await storage.getEquipmentById(component.id);
    const storedBundle = await storage.getEquipmentById(bundle.id);
    expect((storedComponent!.specifications as any).parentBundleId).toBe(bundle.id);
    expect((storedBundle!.specifications as any).bundleComponentIds).toContain(component.id);
    expect(storedComponent!.assignedTo).toBeFalsy();
  });

  it("extracts from an unused kit before direct take and writes both audit histories", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: component.id },
      body: {
        status: "in-use",
        assignedTo: admin.id,
        kitExtraction: {
          confirmed: true,
          override: false,
          bundleName: bundle.name,
          reason: "Direct take regression",
          context: "test-direct-take",
        },
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: "in-use", assignedTo: admin.id });
    const storedComponent = await storage.getEquipmentById(component.id);
    const storedBundle = await storage.getEquipmentById(bundle.id);
    expect((storedComponent!.specifications as any).parentBundleId).toBeUndefined();
    expect((storedBundle!.specifications as any).bundleComponentIds).not.toContain(component.id);
    expect((storedComponent!.specifications as any).kitExtractionHistory).toHaveLength(1);
    expect((storedBundle!.specifications as any).bundleExtractionHistory).toMatchObject([{
      componentId: component.id,
      parentBundleId: bundle.id,
      actorUserId: admin.id,
      managerOverride: false,
      reason: "Direct take regression",
    }]);
  });

  it("blocks individual return while the component belongs to a kit", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit({ active: true });
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: component.id },
      body: { status: "available", assignedTo: null },
    }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      code: "KIT_RETURN_VIA_PARENT_REQUIRED",
      componentId: component.id,
      parentBundleId: bundle.id,
      parentBundleName: bundle.name,
    });
    expect(await storage.getEquipmentById(component.id)).toMatchObject({ status: "in-use" });
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      parentBundleId: bundle.id,
    });
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [component.id],
    });
  });

  it("blocks the project-return endpoint before it can return a kit component", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-return");
    const { component, bundle } = await createEquipmentKit({ active: true });
    const res = createJsonResponse();

    await handler!({
      user: admin,
      body: { equipmentId: component.id, userId: admin.id },
    }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      code: "KIT_RETURN_VIA_PARENT_REQUIRED",
      parentBundleId: bundle.id,
    });
    expect(await storage.getEquipmentById(component.id)).toMatchObject({ status: "in-use" });
  });

  it("allows returning the whole kit without detaching its components", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit({ active: true });
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: bundle.id },
      body: { status: "available", assignedTo: null },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: bundle.id, status: "available" });
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      parentBundleId: bundle.id,
    });
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [component.id],
    });
  });

  it("allows returning a component after controlled extraction", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    const extractionResponse = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: component.id },
      body: {
        status: "in-use",
        assignedTo: admin.id,
        kitExtraction: {
          confirmed: true,
          override: false,
          bundleName: bundle.name,
          reason: "Take component before return",
        },
      },
    }, extractionResponse);
    expect(extractionResponse.statusCode).toBe(200);

    const returnResponse = createJsonResponse();
    await handler!({
      user: admin,
      params: { id: component.id },
      body: { status: "available", assignedTo: null },
    }, returnResponse);

    expect(returnResponse.statusCode).toBe(200);
    expect(returnResponse.body).toMatchObject({ id: component.id, status: "available", assignedTo: null });
    expect((await storage.getEquipmentById(component.id))!.specifications).not.toHaveProperty("parentBundleId");
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [],
    });
  });

  it("disassembles kit components before deleting the parent kit", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "DELETE", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit({ active: true });
    const res = createJsonResponse();

    await handler!({ user: admin, params: { id: bundle.id }, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      mode: "deleted",
      disassembledComponentIds: [component.id],
    });
    expect(await storage.getEquipmentById(bundle.id)).toBeUndefined();
    expect(await storage.getEquipmentById(component.id)).toMatchObject({
      status: "available",
      assignedTo: null,
    });
    expect((await storage.getEquipmentById(component.id))!.specifications).not.toHaveProperty("parentBundleId");
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      kitExtractionHistory: [expect.objectContaining({
        parentBundleId: bundle.id,
        context: "bundle-deleted",
      })],
    });
  });

  it("preserves repair status while disassembling a deleted kit", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "DELETE", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    await storage.updateEquipment(component.id, {
      status: "maintenance",
      operabilityStatus: "on_repair",
    } as any);
    const res = createJsonResponse();

    await handler!({ user: admin, params: { id: bundle.id }, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(await storage.getEquipmentById(component.id)).toMatchObject({
      status: "maintenance",
      operabilityStatus: "on_repair",
    });
    expect((await storage.getEquipmentById(component.id))!.specifications).not.toHaveProperty("parentBundleId");
  });

  it("recovers an orphaned component when its parent kit was already deleted", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit({ active: true });
    await storage.deleteEquipment(bundle.id);
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: component.id },
      body: { status: "available", assignedTo: null },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: component.id, status: "available", assignedTo: null });
    expect((await storage.getEquipmentById(component.id))!.specifications).not.toHaveProperty("parentBundleId");
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      kitExtractionHistory: [expect.objectContaining({
        parentBundleId: bundle.id,
        context: "orphaned-kit-membership-recovery",
      })],
    });
  });

  it("does not restore an orphaned kit link from a stale edit form", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    await storage.deleteEquipment(bundle.id);
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: component.id },
      body: {
        notes: "Recovered orphan",
        specifications: component.specifications,
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: component.id, notes: "Recovered orphan" });
    expect((await storage.getEquipmentById(component.id))!.specifications).not.toHaveProperty("parentBundleId");
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      kitExtractionHistory: [expect.objectContaining({
        parentBundleId: bundle.id,
        context: "orphaned-kit-membership-recovery",
      })],
    });
  });

  it("extracts before creating a cart-style checkout request", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const { component, bundle } = await createEquipmentKit();
    const res = createJsonResponse();

    await handler!({
      user: admin,
      body: {
        equipmentId: component.id,
        quantity: 1,
        location: "Studio B",
        kitExtraction: {
          confirmed: true,
          override: false,
          bundleName: bundle.name,
          reason: "Cart request",
          context: "cart-checkout-request",
        },
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ equipmentId: component.id, status: "pending" });
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      kitExtractionHistory: [expect.objectContaining({ context: "cart-checkout-request" })],
    });
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [],
    });
  });

  it("extracts before assigning a component to a project", async () => {
    const app = await createAppWithRoutes();
    const sendHandler = routeHandler(app, "POST", "/api/projects/:projectId/equipment-bundle");
    const listHandler = routeHandler(app, "GET", "/api/projects/:projectId/equipment-bundles");
    const { component, bundle } = await createEquipmentKit();
    const projectId = `project-kit-${Date.now()}`;
    const res = createJsonResponse();

    await sendHandler!({
      user: admin,
      params: { projectId },
      body: {
        equipmentIds: [component.id],
        returnDate: "2026-07-30",
        assignedByName: admin.name,
        kitExtractions: {
          [component.id]: {
            confirmed: true,
            override: false,
            bundleName: bundle.name,
            reason: "Project send",
            context: `project-send:${projectId}`,
          },
        },
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      kitExtractionHistory: [expect.objectContaining({ context: `project-send:${projectId}` })],
    });
    const listResponse = createJsonResponse();
    await listHandler!({ params: { projectId } }, listResponse);
    expect(listResponse.body).toEqual([
      expect.objectContaining({ projectId, equipmentIds: [component.id] }),
    ]);
  });

  it("rolls back an earlier extraction when a project batch later fails", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/projects/:projectId/equipment-bundle");
    const { component, bundle } = await createEquipmentKit();
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { projectId: `project-kit-failure-${Date.now()}` },
      body: {
        equipmentIds: [component.id, "missing-equipment"],
        returnDate: "2026-07-30",
        assignedByName: admin.name,
        kitExtractions: {
          [component.id]: {
            confirmed: true,
            override: false,
            bundleName: bundle.name,
            reason: "Rollback batch",
          },
        },
      },
    }, res);

    expect(res.statusCode).toBe(404);
    const storedComponent = await storage.getEquipmentById(component.id);
    const storedBundle = await storage.getEquipmentById(bundle.id);
    expect((storedComponent!.specifications as any).parentBundleId).toBe(bundle.id);
    expect((storedComponent!.specifications as any).kitExtractionHistory).toBeUndefined();
    expect((storedBundle!.specifications as any).bundleComponentIds).toEqual([component.id]);
    expect((storedBundle!.specifications as any).bundleExtractionHistory).toBeUndefined();
  });

  it("keeps an active kit unchanged for a regular user and creates a manager escalation", async () => {
    const app = await createAppWithRoutes();
    const directHandler = routeHandler(app, "PUT", "/api/equipment/:id");
    const requestHandler = routeHandler(app, "POST", "/api/equipment/:id/kit-extraction-request");
    const { company, user } = await createCompanyMember();
    const { component, bundle } = await createEquipmentKit({ active: true, companyId: company.id });
    const blockedResponse = createJsonResponse();

    await directHandler!({
      user,
      params: { id: component.id },
      body: {
        status: "in-use",
        assignedTo: user.id,
        kitExtraction: { confirmed: true, override: true, bundleName: bundle.name },
      },
    }, blockedResponse);

    expect(blockedResponse.statusCode).toBe(403);
    expect(blockedResponse.body).toMatchObject({
      code: "KIT_COMPONENT_REQUIRES_MANAGER",
      canEscalate: true,
    });
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      parentBundleId: bundle.id,
    });

    const requestResponse = createJsonResponse();
    await requestHandler!({
      user,
      params: { id: component.id },
      body: { reason: "Need a replacement component" },
    }, requestResponse);

    expect(requestResponse.statusCode).toBe(200);
    expect(requestResponse.body).toMatchObject({
      duplicate: false,
      request: {
        equipmentId: component.id,
        requestedBy: user.id,
        requestType: "kit-extraction",
        status: "pending",
      },
    });
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [component.id],
    });
  });

  it("requires strong manager approval and audits override of an active kit", async () => {
    const app = await createAppWithRoutes();
    const requestHandler = routeHandler(app, "POST", "/api/equipment/:id/kit-extraction-request");
    const approveHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests/:id/approve");
    const { company, user } = await createCompanyMember();
    const { component, bundle } = await createEquipmentKit({ active: true, companyId: company.id });
    const requestResponse = createJsonResponse();
    await requestHandler!({
      user,
      params: { id: component.id },
      body: { reason: "Approved replacement" },
    }, requestResponse);
    const requestId = (requestResponse.body as any).request.id;

    const weakResponse = createJsonResponse();
    await approveHandler!({ user: admin, params: { id: requestId }, body: {} }, weakResponse);
    expect(weakResponse.statusCode).toBe(409);
    expect(weakResponse.body).toMatchObject({ code: "KIT_OVERRIDE_CONFIRMATION_REQUIRED" });
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({ parentBundleId: bundle.id });

    const approvedResponse = createJsonResponse();
    await approveHandler!({
      user: admin,
      params: { id: requestId },
      body: { kitExtractionApproval: true },
    }, approvedResponse);

    expect(approvedResponse.statusCode).toBe(200);
    expect(approvedResponse.body).toMatchObject({
      request: { id: requestId, status: "approved", reviewedBy: admin.id },
      equipment: { id: component.id, status: "available" },
    });
    const storedBundle = await storage.getEquipmentById(bundle.id);
    expect((storedBundle!.specifications as any).bundleComponentIds).toEqual([]);
    expect((storedBundle!.specifications as any).bundleExtractionHistory).toMatchObject([{
      componentId: component.id,
      actorUserId: admin.id,
      managerOverride: true,
      reason: "Approved replacement",
    }]);
  });

  it("adds an available position to an unused kit and records the composition change", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment/:bundleId/components");
    const { bundle } = await createEquipmentKit();
    const suffix = `${Date.now()}-${++kitSequence}`;
    const candidate = await storage.createEquipment({
      name: `Additional component ${suffix}`,
      type: "camera",
      inventoryNumber: `KIT-A-${suffix}`,
      status: "available",
      operabilityStatus: "working",
      location: "Склад B",
      specifications: {},
    } as any);
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { bundleId: bundle.id },
      body: {
        equipmentIds: [candidate.id],
        reason: "Add component regression",
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      addedComponentIds: [candidate.id],
    });
    expect(await storage.getEquipmentById(candidate.id)).toMatchObject({
      status: "in-use",
      assignedTo: null,
      location: `В составе: ${bundle.name}`,
    });
    expect((await storage.getEquipmentById(candidate.id))!.specifications).toMatchObject({
      parentBundleId: bundle.id,
      parentBundleName: bundle.name,
      kitExtractionHistory: [expect.objectContaining({
        action: "added",
        reason: "Add component regression",
      })],
    });
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: expect.arrayContaining([candidate.id]),
      bundleExtractionHistory: [expect.objectContaining({
        action: "added",
        componentId: candidate.id,
      })],
    });
  });

  it("allows a nested kit and removes it without disassembling its own components", async () => {
    const app = await createAppWithRoutes();
    const addHandler = routeHandler(app, "POST", "/api/equipment/:bundleId/components");
    const removeHandler = routeHandler(app, "DELETE", "/api/equipment/:bundleId/components/:componentId");
    const inner = await createEquipmentKit();
    const outer = await createEquipmentKit();
    const addResponse = createJsonResponse();

    await addHandler!({
      user: admin,
      params: { bundleId: outer.bundle.id },
      body: { equipmentIds: [inner.bundle.id], reason: "Nest inner kit" },
    }, addResponse);
    expect(addResponse.statusCode).toBe(200);
    expect((await storage.getEquipmentById(inner.bundle.id))!.specifications).toMatchObject({
      parentBundleId: outer.bundle.id,
      bundleComponentIds: [inner.component.id],
    });

    const removeResponse = createJsonResponse();
    await removeHandler!({
      user: admin,
      params: { bundleId: outer.bundle.id, componentId: inner.bundle.id },
      body: {
        kitExtraction: {
          confirmed: true,
          override: false,
          bundleName: outer.bundle.name,
          reason: "Detach nested kit",
          context: "nested-kit-regression",
        },
      },
    }, removeResponse);

    expect(removeResponse.statusCode).toBe(200);
    expect(await storage.getEquipmentById(inner.bundle.id)).toMatchObject({
      status: "available",
      assignedTo: null,
    });
    expect((await storage.getEquipmentById(inner.bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [inner.component.id],
      kitExtractionHistory: expect.arrayContaining([expect.objectContaining({
        action: "removed",
        parentBundleId: outer.bundle.id,
      })]),
    });
    expect((await storage.getEquipmentById(inner.bundle.id))!.specifications).not.toHaveProperty("parentBundleId");
    expect((await storage.getEquipmentById(inner.component.id))!.specifications).toMatchObject({
      parentBundleId: inner.bundle.id,
    });
    expect((await storage.getEquipmentById(outer.bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [outer.component.id],
    });
  });

  it("rejects only the nested-kit link that would create a cycle", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment/:bundleId/components");
    const inner = await createEquipmentKit();
    const outer = await createEquipmentKit();
    const nestedResponse = createJsonResponse();

    await handler!({
      user: admin,
      params: { bundleId: outer.bundle.id },
      body: { equipmentIds: [inner.bundle.id] },
    }, nestedResponse);
    expect(nestedResponse.statusCode).toBe(200);

    const cycleResponse = createJsonResponse();
    await handler!({
      user: admin,
      params: { bundleId: inner.bundle.id },
      body: { equipmentIds: [outer.bundle.id] },
    }, cycleResponse);

    expect(cycleResponse.statusCode).toBe(409);
    expect(cycleResponse.body).toMatchObject({
      code: "KIT_NESTING_CYCLE",
      componentId: outer.bundle.id,
      parentBundleId: inner.bundle.id,
    });
    expect((await storage.getEquipmentById(inner.bundle.id))!.specifications).toMatchObject({
      parentBundleId: outer.bundle.id,
    });
    expect((await storage.getEquipmentById(outer.bundle.id))!.specifications).not.toHaveProperty("parentBundleId");
  });

  it("requires explicit manager approval before adding to an active kit", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment/:bundleId/components");
    const { bundle } = await createEquipmentKit({ active: true });
    const suffix = `${Date.now()}-${++kitSequence}`;
    const candidate = await storage.createEquipment({
      name: `Active kit addition ${suffix}`,
      type: "other",
      inventoryNumber: `KIT-ACTIVE-${suffix}`,
      status: "available",
      operabilityStatus: "working",
      location: "Склад",
      specifications: {},
    } as any);
    const weakResponse = createJsonResponse();

    await handler!({
      user: admin,
      params: { bundleId: bundle.id },
      body: { equipmentIds: [candidate.id] },
    }, weakResponse);
    expect(weakResponse.statusCode).toBe(409);
    expect(weakResponse.body).toMatchObject({ code: "KIT_OVERRIDE_CONFIRMATION_REQUIRED" });
    expect(await storage.getEquipmentById(candidate.id)).toMatchObject({ status: "available" });

    const approvedResponse = createJsonResponse();
    await handler!({
      user: admin,
      params: { bundleId: bundle.id },
      body: {
        equipmentIds: [candidate.id],
        activeKitApproval: true,
        reason: "Approved active addition",
      },
    }, approvedResponse);

    expect(approvedResponse.statusCode).toBe(200);
    expect((await storage.getEquipmentById(candidate.id))!.specifications).toMatchObject({
      parentBundleId: bundle.id,
      kitExtractionHistory: [expect.objectContaining({
        action: "added",
        managerOverride: true,
      })],
    });
  });

  it("serializes concurrent extraction attempts so only one can assign the component", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    const makeRequest = (assignedTo: string) => {
      const res = createJsonResponse();
      return handler!({
        user: admin,
        params: { id: component.id },
        body: {
          status: "in-use",
          assignedTo,
          kitExtraction: {
            confirmed: true,
            override: false,
            bundleName: bundle.name,
            reason: "Concurrent take",
          },
        },
      }, res).then(() => res);
    };

    const responses = await Promise.all([makeRequest("employee-a"), makeRequest("employee-b")]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.statusCode === 409)?.body).toMatchObject({
      code: "KIT_COMPONENT_BUSY",
    });
    const storedComponent = await storage.getEquipmentById(component.id);
    const storedBundle = await storage.getEquipmentById(bundle.id);
    expect(["employee-a", "employee-b"]).toContain(storedComponent!.assignedTo);
    expect((storedComponent!.specifications as any).kitExtractionHistory).toHaveLength(1);
    expect((storedBundle!.specifications as any).bundleExtractionHistory).toHaveLength(1);
  });

  it("changes repair status without silently removing kit membership", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { id: component.id },
      body: { status: "maintenance", operabilityStatus: "on_repair" },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: "maintenance", operabilityStatus: "on_repair" });
    expect((await storage.getEquipmentById(component.id))!.specifications).toMatchObject({
      parentBundleId: bundle.id,
      parentBundleName: bundle.name,
    });
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [component.id],
    });
  });

  it("blocks delete without confirmed extraction and preserves both records", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "DELETE", "/api/equipment/:id");
    const { component, bundle } = await createEquipmentKit();
    const res = createJsonResponse();

    await handler!({ user: admin, params: { id: component.id }, body: {} }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: "KIT_EXTRACTION_CONFIRMATION_REQUIRED" });
    expect(await storage.getEquipmentById(component.id)).toBeDefined();
    expect((await storage.getEquipmentById(bundle.id))!.specifications).toMatchObject({
      bundleComponentIds: [component.id],
    });
  });
});

describe("warehouse company scope", () => {
  it("does not expose another company's kit or components in the equipment list", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "GET", "/api/equipment");
    const firstMembership = await createCompanyMember();
    const secondMembership = await createCompanyMember();
    const visibleKit = await createEquipmentKit({ companyId: firstMembership.company.id });
    const hiddenKit = await createEquipmentKit({ companyId: secondMembership.company.id });
    const res = createJsonResponse();

    await handler!({ user: firstMembership.user, query: {} }, res);

    expect(res.statusCode).toBe(200);
    const ids = (res.body as any[]).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([visibleKit.bundle.id, visibleKit.component.id]));
    expect(ids).not.toEqual(expect.arrayContaining([hiddenKit.bundle.id, hiddenKit.component.id]));
  });
});
