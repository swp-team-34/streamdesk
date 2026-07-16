import express from "express";
import { describe, expect, it } from "vitest";
import { registerRoutes } from "./routes";
import { storage } from "./database";

async function createAppWithRoutes() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);
  const unscopedItems = (await storage.getEquipment()).filter((item) => {
    const specifications = item.specifications && typeof item.specifications === "object"
      ? item.specifications as any
      : {};
    return !String(specifications.companyId || "").trim();
  });
  if (unscopedItems.length > 0) {
    const company = await storage.createCompany({
      name: `Equipment regression company ${Date.now()}-${++kitSequence}`,
      ownerId: "admin-stub-default-id",
      status: "active",
    } as any);
    await Promise.all(unscopedItems.map((item) =>
      storage.updateEquipment(item.id, {
        specifications: {
          ...(item.specifications && typeof item.specifications === "object" ? item.specifications : {}),
          companyId: company.id,
        },
      } as any),
    ));
  }
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

function routeHandler(
  app: express.Express,
  method: string,
  path: string,
  position: "first" | "last" = "first",
) {
  const layer = ((app as any)._router?.stack || [])
    .find((item: any) => item.route?.path === path && item.route?.methods?.[method.toLowerCase()]);
  const stack = layer?.route?.stack || [];
  const selected = position === "last" ? stack[stack.length - 1] : stack[0];
  const handler = selected?.handle as ((req: any, res: any) => Promise<void>) | undefined;
  if (!handler) return undefined;
  return async (req: any, res: any) => {
    if (req.user?.id && !req.workspace) {
      const equipmentId = String(
        req.params?.id ||
        req.params?.bundleId ||
        req.params?.componentId ||
        req.body?.equipmentId ||
        req.body?.equipmentIds?.[0] ||
        "",
      ).trim();
      const item = equipmentId
        ? await storage.getEquipmentById(equipmentId).catch(() => undefined)
        : undefined;
      const project = req.params?.projectId
        ? await storage.getProjectById(String(req.params.projectId)).catch(() => undefined)
        : undefined;
      const checkoutRequest = path.includes("/api/equipment-checkout-requests/:id") && req.params?.id
        ? await storage.getEquipmentCheckoutRequestById(String(req.params.id)).catch(() => undefined)
        : undefined;
      const specifications = item?.specifications && typeof item.specifications === "object"
        ? item.specifications as any
        : {};
      const companyId = String(
        req.body?.companyId ||
        specifications.companyId ||
        project?.companyId ||
        checkoutRequest?.companyId ||
        "",
      ).trim();
      if (companyId) {
        const membership = await storage.getCompanyMembershipByUser(companyId, req.user.id).catch(() => undefined);
        if (!membership) {
          await storage.createCompanyMember({
            companyId,
            userId: req.user.id,
            role: req.user.role === "admin" ? "admin" : "member",
            status: "active",
          } as any);
        }
        req.workspace = {
          type: "company",
          companyId,
          requiresSelection: false,
          source: "session",
        };
        req.user = {
          ...req.user,
          activeWorkspaceType: "company",
          activeCompanyId: companyId,
        };
      }
    }
    return handler(req, res);
  };
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
let defaultKitCompanyId = "";

async function getDefaultKitCompanyId() {
  if (defaultKitCompanyId) return defaultKitCompanyId;
  const company = await storage.createCompany({
    name: `Kit default company ${Date.now()}-${++kitSequence}`,
    ownerId: "admin-stub-default-id",
    status: "active",
  } as any);
  defaultKitCompanyId = company.id;
  return defaultKitCompanyId;
}

async function createEquipmentKit(options: { active?: boolean; companyId?: string } = {}) {
  kitSequence += 1;
  const suffix = `${Date.now()}-${kitSequence}`;
  const companyId = options.companyId || await getDefaultKitCompanyId();
  const component = await storage.createEquipment({
    name: `Kit component ${suffix}`,
    type: "camera",
    inventoryNumber: `KIT-C-${suffix}`,
    status: "in-use",
    operabilityStatus: "working",
    location: "В составе комплекта",
    specifications: { companyId },
  } as any);
  const bundle = await storage.createEquipment({
    name: `Kit ${suffix}`,
    type: "other",
    inventoryNumber: `KIT-B-${suffix}`,
    status: options.active ? "in-use" : "available",
    operabilityStatus: "working",
    location: "Склад A",
    specifications: {
      companyId,
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
      companyId,
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

async function createEquipmentContextFixture() {
  const suffix = `${Date.now()}-${++kitSequence}`;
  const company = await storage.createCompany({
    name: `Equipment context company ${suffix}`,
    ownerId: "admin-stub-default-id",
    status: "active",
  } as any);
  const project = await storage.createProject({
    name: `Equipment context project ${suffix}`,
    companyId: company.id,
    ownerId: "admin-stub-default-id",
    status: "planning",
  } as any);
  const location = await storage.createCustomLocation({
    name: `Equipment context location ${suffix}`,
    companyId: company.id,
    status: "available",
  } as any);
  const board = await storage.createKanbanBoard({
    name: `Equipment context board ${suffix}`,
    companyId: company.id,
    projectId: project.id,
    visibility: "company",
    createdByUserId: "admin-stub-default-id",
  } as any);
  const list = await storage.createKanbanList({
    boardId: board.id,
    name: "Requests",
    type: "active",
    position: 0,
  } as any);
  const cards = await Promise.all(["First", "Second"].map((title, position) =>
    storage.createKanbanCard({
      boardId: board.id,
      projectId: project.id,
      listId: list.id,
      title: `${title} ${suffix}`,
      creatorUserId: "admin-stub-default-id",
      position,
    } as any),
  ));
  const item = await storage.createEquipment({
    name: `Equipment context item ${suffix}`,
    type: "camera",
    status: "available",
    operabilityStatus: "working",
    specifications: { companyId: company.id },
  } as any);
  return { company, project, location, board, list, cards, item };
}

async function createEquipmentActivityFixture(prefix = "activity") {
  const suffix = `${Date.now()}-${++kitSequence}`;
  const user = await storage.createUser({
    username: `${prefix}-user-${suffix}`,
    password: "test-password",
    name: `${prefix} User`,
    role: "employee",
    permissions: [],
    active: true,
    workspaceMode: "company_member",
  } as any);
  const company = await storage.createCompany({
    name: `${prefix} Company ${suffix}`,
    ownerId: user.id,
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId: user.id,
    role: "member",
    status: "active",
  } as any);
  const activeUser = await storage.updateUser(user.id, {
    activeWorkspaceType: "company",
    activeCompanyId: company.id,
  } as any) || {
    ...user,
    activeWorkspaceType: "company",
    activeCompanyId: company.id,
  };
  const item = await storage.createEquipment({
    name: `${prefix} Camera ${suffix}`,
    type: "camera",
    status: "available",
    notes: "Static equipment notes",
    specifications: {
      companyId: company.id,
      sensor: "full-frame",
      equipmentComments: [{
        id: "legacy-comment",
        text: "Legacy equipment observation",
        authorId: user.id,
        authorName: "Legacy Author",
        createdAt: "2026-07-01T09:00:00.000Z",
      }],
    },
  } as any);
  return { user: activeUser, company, item };
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

describe("equipment activity comments", () => {
  it("stores attributed comments and validated files separately from static equipment data", async () => {
    const app = await createAppWithRoutes();
    const createComment = routeHandler(app, "POST", "/api/equipment/:id/comments", "last");
    const listComments = routeHandler(app, "GET", "/api/equipment/:id/comments");
    const listEquipment = routeHandler(app, "GET", "/api/equipment");
    const { user, company, item } = await createEquipmentActivityFixture("activity-store");
    const createResponse = createJsonResponse();

    await createComment!({
      user,
      params: { id: item.id },
      body: { content: "Minor connector wear" },
      files: [{
        originalname: "connector.jpg",
        filename: "connector-test.jpg",
        mimetype: "image/jpeg",
        size: 2048,
      }],
    }, createResponse);

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body).toMatchObject({
      equipmentId: item.id,
      companyId: company.id,
      userId: user.id,
      authorName: user.name,
      content: "Minor connector wear",
      attachments: [{
        fileName: "connector.jpg",
        mimeType: "image/jpeg",
        fileUrl: "/uploads/equipment-comments/connector-test.jpg",
      }],
    });

    await storage.updateEquipment(item.id, {
      status: "in-use",
      assignedTo: user.id,
    } as any);
    await storage.updateEquipment(item.id, {
      status: "available",
      assignedTo: null,
    } as any);

    const commentsResponse = createJsonResponse();
    await listComments!({
      user,
      params: { id: item.id },
    }, commentsResponse);

    expect(commentsResponse.statusCode).toBe(200);
    expect(commentsResponse.body).toEqual([
      expect.objectContaining({
        id: `legacy:${item.id}:legacy-comment`,
        authorName: "Legacy Author",
        content: "Legacy equipment observation",
        legacy: true,
      }),
      expect.objectContaining({
        authorName: user.name,
        content: "Minor connector wear",
        attachments: [expect.objectContaining({ fileName: "connector.jpg" })],
      }),
    ]);
    const storedItem = await storage.getEquipmentById(item.id);
    expect(storedItem?.notes).toBe("Static equipment notes");
    expect(storedItem?.specifications).toMatchObject({
      sensor: "full-frame",
      equipmentComments: [expect.objectContaining({ id: "legacy-comment" })],
    });

    const equipmentResponse = createJsonResponse();
    await listEquipment!({
      user,
      workspace: {
        type: "company",
        companyId: company.id,
        requiresSelection: false,
        source: "session",
      },
      query: {},
    }, equipmentResponse);
    const serialized = (equipmentResponse.body as any[]).find((entry) => entry.id === item.id);
    expect(serialized).toMatchObject({
      activitySummary: {
        commentCount: 2,
        attachmentCount: 1,
        latestAuthorName: user.name,
      },
    });
    expect(serialized.specifications).not.toHaveProperty("equipmentComments");
  });

  it("rejects unsupported files and isolates equipment activity between companies", async () => {
    const app = await createAppWithRoutes();
    const createComment = routeHandler(app, "POST", "/api/equipment/:id/comments", "last");
    const listComments = routeHandler(app, "GET", "/api/equipment/:id/comments");
    const owner = await createEquipmentActivityFixture("activity-owner");
    const outsider = await createEquipmentActivityFixture("activity-outsider");

    const rejectedResponse = createJsonResponse();
    await createComment!({
      user: owner.user,
      params: { id: owner.item.id },
      body: { content: "Executable attachment" },
      files: [],
      equipmentCommentAttachmentRejected: true,
    }, rejectedResponse);
    expect(rejectedResponse.statusCode).toBe(400);
    expect(await storage.getEquipmentComments(owner.item.id)).toHaveLength(0);

    const outsiderReadResponse = createJsonResponse();
    await listComments!({
      user: outsider.user,
      workspace: {
        type: "company",
        companyId: outsider.company.id,
        requiresSelection: false,
        source: "session",
      },
      params: { id: owner.item.id },
    }, outsiderReadResponse);
    expect(outsiderReadResponse.statusCode).toBe(403);

    const outsiderWriteResponse = createJsonResponse();
    await createComment!({
      user: outsider.user,
      workspace: {
        type: "company",
        companyId: outsider.company.id,
        requiresSelection: false,
        source: "session",
      },
      params: { id: owner.item.id },
      body: { content: "Cross-company write" },
      files: [],
    }, outsiderWriteResponse);
    expect(outsiderWriteResponse.statusCode).toBe(403);
    expect(await storage.getEquipmentComments(owner.item.id)).toHaveLength(0);
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

  it("stores checkout destination, project and multiple Kanban V2 cards", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const { company, project, location, cards, item } = await createEquipmentContextFixture();
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: "2",
        physicalDestination: { locationId: location.id },
        workContext: { kanbanCardIds: [cards[0].id, cards[1].id, cards[0].id] },
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      equipmentId: item.id,
      quantity: 2,
      locationId: location.id,
      projectId: project.id,
      kanbanCardId: cards[0].id,
      kanbanCardIds: [cards[0].id, cards[1].id],
      taskId: null,
      status: "pending",
    });
    const links = await storage.getEquipmentContextLinks(item.id);
    expect(links).toHaveLength(2);
    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "checkout", projectId: project.id, kanbanCardId: cards[0].id, active: true }),
      expect.objectContaining({ source: "checkout", projectId: project.id, kanbanCardId: cards[1].id, active: true }),
    ]));
  });

  it("allows checkout requests without work-context links", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const { company, item } = await createEquipmentContextFixture();
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: 1,
        physicalDestination: { manualLocation: "Выездная площадка" },
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
    expect(res.body).toMatchObject({
      manualLocation: "Выездная площадка",
      physicalDestination: { displayName: "Выездная площадка" },
    });
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

  it("rejects missing Kanban cards and all new Legacy Task links", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const { company, item } = await createEquipmentContextFixture();
    const missingCardResponse = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: 1,
        physicalDestination: { manualLocation: "Studio" },
        workContext: { kanbanCardIds: ["missing-card"] },
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
        companyId: company.id,
        quantity: 1,
        taskId: "missing-task",
      },
    }, missingTaskResponse);

    expect(missingTaskResponse.statusCode).toBe(400);
    expect(missingTaskResponse.body).toMatchObject({
      code: "LEGACY_TASK_LINK_FORBIDDEN",
      message: expect.stringContaining("Legacy Task Manager"),
    });
  });

  it("rejects a project that conflicts with the selected Kanban V2 card", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const { company, location, cards, item } = await createEquipmentContextFixture();
    const otherProject = await storage.createProject({
      name: `Other equipment project ${Date.now()}-${++kitSequence}`,
      companyId: company.id,
      ownerId: "admin-stub-default-id",
      status: "planning",
    } as any);
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: 1,
        physicalDestination: { locationId: location.id },
        workContext: { projectId: otherProject.id, kanbanCardIds: [cards[0].id] },
      },
    }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      code: "EQUIPMENT_PROJECT_CARD_CONFLICT",
      message: expect.stringContaining("проект"),
    });
  });

  it("updates manual context without changing equipment workflow state", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/equipment/:id");
    const summaryHandler = routeHandler(app, "GET", "/api/equipment-on-projects");
    const { company, project, location, cards, item } = await createEquipmentContextFixture();
    await storage.updateEquipment(item.id, {
      status: "in-use",
      assignedTo: "admin-stub-default-id",
      operabilityStatus: "working",
    } as any);
    const res = createJsonResponse();

    await handler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      params: { id: item.id },
      body: {
        physicalDestination: { locationId: location.id },
        workContext: { projectId: project.id, kanbanCardIds: [cards[0].id, cards[1].id, cards[0].id] },
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: "in-use",
      assignedTo: "admin-stub-default-id",
      operabilityStatus: "working",
      locationId: location.id,
    });
    const links = await storage.getEquipmentContextLinks(item.id);
    expect(links.filter((link) => link.active && link.source === "manual")).toHaveLength(2);
    const summaryResponse = createJsonResponse();
    await summaryHandler!({
      user: {
        id: "admin-stub-default-id",
        role: "admin",
        activeWorkspaceType: "company",
        activeCompanyId: company.id,
      },
      workspace: {
        type: "company",
        companyId: company.id,
        requiresSelection: false,
        source: "session",
      },
    }, summaryResponse);
    expect((summaryResponse.body as any[]).filter((row) =>
      row.equipmentId === item.id && row.projectId === project.id,
    )).toHaveLength(1);
  });

  it("rejects archived locations for a new checkout but preserves them historically", async () => {
    const app = await createAppWithRoutes();
    const checkoutHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const detailHandler = routeHandler(app, "GET", "/api/equipment/:id");
    const { company, location, item } = await createEquipmentContextFixture();
    await storage.updateCustomLocation(location.id, { archivedAt: new Date() } as any);
    await storage.updateEquipment(item.id, {
      locationId: location.id,
      location: location.name,
    } as any);
    const checkoutResponse = createJsonResponse();

    await checkoutHandler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: 1,
        physicalDestination: { locationId: location.id },
      },
    }, checkoutResponse);
    expect(checkoutResponse.statusCode).toBe(409);
    expect(checkoutResponse.body).toMatchObject({ code: "EQUIPMENT_LOCATION_ARCHIVED" });

    const detailResponse = createJsonResponse();
    await detailHandler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      params: { id: item.id },
    }, detailResponse);
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body).toMatchObject({
      physicalDestination: {
        locationId: location.id,
        displayName: location.name,
        archived: true,
      },
    });
  });

  it("deactivates automatic checkout links when a request is rejected", async () => {
    const app = await createAppWithRoutes();
    const createHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const rejectHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests/:id/reject");
    const { company, project, location, cards, item } = await createEquipmentContextFixture();
    const createResponse = createJsonResponse();
    await createHandler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: 1,
        physicalDestination: { locationId: location.id },
        workContext: { projectId: project.id, kanbanCardIds: [cards[0].id] },
      },
    }, createResponse);
    expect(createResponse.statusCode).toBe(200);

    const rejectResponse = createJsonResponse();
    await rejectHandler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      params: { id: (createResponse.body as any).id },
      body: {},
    }, rejectResponse);
    expect(rejectResponse.statusCode).toBe(200);
    expect((await storage.getEquipmentContextLinks(item.id))).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "checkout", active: false }),
    ]));
  });

  it("applies the structured destination and keeps automatic links on approval", async () => {
    const app = await createAppWithRoutes();
    const createHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const approveHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests/:id/approve");
    const updateHandler = routeHandler(app, "PUT", "/api/equipment/:id");
    const { company, project, location, cards, item } = await createEquipmentContextFixture();
    const createResponse = createJsonResponse();
    await createHandler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: 1,
        physicalDestination: { locationId: location.id },
        workContext: { projectId: project.id, kanbanCardIds: [cards[0].id] },
      },
    }, createResponse);
    expect(createResponse.statusCode).toBe(200);

    const approveResponse = createJsonResponse();
    await approveHandler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      params: { id: (createResponse.body as any).id },
      body: {},
    }, approveResponse);

    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.body).toMatchObject({
      request: { status: "approved" },
      equipment: {
        id: item.id,
        status: "in-use",
        locationId: location.id,
        physicalDestination: { displayName: location.name },
      },
    });
    expect(await storage.getEquipmentContextLinks(item.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "checkout",
        projectId: project.id,
        kanbanCardId: cards[0].id,
        active: true,
      }),
    ]));

    const returnResponse = createJsonResponse();
    await updateHandler!({
      user: { id: "admin-stub-default-id", role: "admin" },
      params: { id: item.id },
      body: { status: "available", assignedTo: null },
    }, returnResponse);
    expect(returnResponse.statusCode).toBe(200);
    expect(await storage.getEquipmentContextLinks(item.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "checkout", active: false }),
    ]));
  });

  it("manually links and unlinks equipment from a Kanban V2 card without changing Warehouse state", async () => {
    const app = await createAppWithRoutes();
    const attachHandler = routeHandler(
      app,
      "POST",
      "/api/kanban/boards/:boardId/cards/:cardId/equipment-links",
    );
    const detachHandler = routeHandler(
      app,
      "DELETE",
      "/api/kanban/boards/:boardId/cards/:cardId/equipment-links/:equipmentId",
    );
    const boardLinksHandler = routeHandler(
      app,
      "GET",
      "/api/kanban/boards/:boardId/equipment-links",
    );
    const { company, project, board, cards, item } = await createEquipmentContextFixture();
    const user = {
      id: "admin-stub-default-id",
      role: "admin",
      activeWorkspaceType: "company",
      activeCompanyId: company.id,
    };
    const before = await storage.getEquipmentById(item.id);
    const firstAttachResponse = createJsonResponse();

    await attachHandler!({
      user,
      params: { boardId: board.id, cardId: cards[0].id },
      body: { equipmentId: item.id },
    }, firstAttachResponse);

    expect(firstAttachResponse.statusCode).toBe(200);
    expect((firstAttachResponse.body as any).items).toHaveLength(1);
    expect((firstAttachResponse.body as any).items[0]).toMatchObject({
      source: "manual",
      workflowStatus: "linked",
      projectId: project.id,
      equipment: { id: item.id, name: item.name },
    });

    const repeatedAttachResponse = createJsonResponse();
    await attachHandler!({
      user,
      params: { boardId: board.id, cardId: cards[0].id },
      body: { equipmentId: item.id },
    }, repeatedAttachResponse);
    expect(repeatedAttachResponse.statusCode).toBe(200);
    expect((await storage.getEquipmentContextLinks(item.id)).filter((link) =>
      link.active && link.source === "manual" && link.kanbanCardId === cards[0].id,
    )).toHaveLength(1);

    const boardResponse = createJsonResponse();
    await boardLinksHandler!({
      user,
      params: { boardId: board.id },
    }, boardResponse);
    expect((boardResponse.body as any).cards[cards[0].id]).toHaveLength(1);

    const detachResponse = createJsonResponse();
    await detachHandler!({
      user,
      params: {
        boardId: board.id,
        cardId: cards[0].id,
        equipmentId: item.id,
      },
      body: {},
    }, detachResponse);
    expect(detachResponse.statusCode).toBe(200);
    expect(detachResponse.body).toMatchObject({ items: [] });

    const after = await storage.getEquipmentById(item.id);
    expect(after?.status).toBe(before?.status);
    expect(after?.operabilityStatus).toBe(before?.operabilityStatus);
    expect(after?.assignedTo ?? null).toBe(before?.assignedTo ?? null);
    expect(after?.location ?? null).toBe(before?.location ?? null);
  });

  it("shows requested, issued and returned checkout workflow states on the linked card", async () => {
    const app = await createAppWithRoutes();
    const createHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests");
    const approveHandler = routeHandler(app, "POST", "/api/equipment-checkout-requests/:id/approve");
    const updateHandler = routeHandler(app, "PUT", "/api/equipment/:id");
    const boardLinksHandler = routeHandler(
      app,
      "GET",
      "/api/kanban/boards/:boardId/equipment-links",
    );
    const { company, project, location, board, cards, item } = await createEquipmentContextFixture();
    const user = {
      id: "admin-stub-default-id",
      role: "admin",
      activeWorkspaceType: "company",
      activeCompanyId: company.id,
    };
    const createResponse = createJsonResponse();
    await createHandler!({
      user,
      body: {
        equipmentId: item.id,
        companyId: company.id,
        quantity: 1,
        physicalDestination: { locationId: location.id },
        workContext: { projectId: project.id, kanbanCardIds: [cards[0].id] },
      },
    }, createResponse);

    const requestedResponse = createJsonResponse();
    await boardLinksHandler!({
      user,
      params: { boardId: board.id },
    }, requestedResponse);
    expect((requestedResponse.body as any).cards[cards[0].id]).toHaveLength(1);
    expect((requestedResponse.body as any).cards[cards[0].id][0]).toMatchObject({
      source: "checkout",
      workflowStatus: "requested",
      request: { id: (createResponse.body as any).id, status: "pending" },
    });

    const approveResponse = createJsonResponse();
    await approveHandler!({
      user,
      params: { id: (createResponse.body as any).id },
      body: {},
    }, approveResponse);
    expect(approveResponse.statusCode).toBe(200);

    const issuedResponse = createJsonResponse();
    await boardLinksHandler!({
      user,
      params: { boardId: board.id },
    }, issuedResponse);
    expect((issuedResponse.body as any).cards[cards[0].id]).toHaveLength(1);
    expect((issuedResponse.body as any).cards[cards[0].id][0]).toMatchObject({
      workflowStatus: "issued",
    });

    const returnResponse = createJsonResponse();
    await updateHandler!({
      user,
      params: { id: item.id },
      body: { status: "available", assignedTo: null },
    }, returnResponse);
    expect(returnResponse.statusCode).toBe(200);

    const returnedResponse = createJsonResponse();
    await boardLinksHandler!({
      user,
      params: { boardId: board.id },
    }, returnedResponse);
    expect((returnedResponse.body as any).cards[cards[0].id]).toHaveLength(1);
    expect((returnedResponse.body as any).cards[cards[0].id][0]).toMatchObject({
      workflowStatus: "returned",
      active: false,
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
        physicalDestination: { manualLocation: "Studio B" },
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
    const companyId = String((component.specifications as any).companyId);
    const project = await storage.createProject({
      name: `Project kit ${Date.now()}`,
      companyId,
      ownerId: admin.id,
      status: "planning",
    } as any);
    const projectId = project.id;
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
    await listHandler!({
      user: admin,
      params: { projectId },
    }, listResponse);
    expect(listResponse.body).toEqual([
      expect.objectContaining({ projectId, equipmentIds: [component.id] }),
    ]);
  });

  it("rolls back an earlier extraction when a project batch later fails", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/projects/:projectId/equipment-bundle");
    const { component, bundle } = await createEquipmentKit();
    const project = await storage.createProject({
      name: `Project kit failure ${Date.now()}`,
      companyId: String((component.specifications as any).companyId),
      ownerId: admin.id,
      status: "planning",
    } as any);
    const res = createJsonResponse();

    await handler!({
      user: admin,
      params: { projectId: project.id },
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
      specifications: { companyId: (bundle.specifications as any).companyId },
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
      specifications: { companyId: (bundle.specifications as any).companyId },
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
