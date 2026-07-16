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

function routeHandler(app: express.Express, method: string, path: string, position: "first" | "last" = "first") {
  const layer = ((app as any)._router?.stack || [])
    .find((item: any) => item.route?.path === path && item.route?.methods?.[method.toLowerCase()]);
  const stack = layer?.route?.stack || [];
  const selected = position === "last" ? stack[stack.length - 1] : stack[0];
  return selected?.handle as ((req: any, res: any) => Promise<void>) | undefined;
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

let sequence = 0;

async function createCompanyUser(membershipRole: "owner" | "admin" | "member" = "owner") {
  const suffix = `${Date.now()}-${++sequence}`;
  const user = await storage.createUser({
    username: `location-user-${suffix}`,
    password: "test-password",
    name: `Location User ${suffix}`,
    role: "employee",
    permissions: [],
    active: true,
  } as any);
  const company = await storage.createCompany({
    name: `Location Company ${suffix}`,
    ownerId: user.id,
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId: user.id,
    role: membershipRole,
    status: "active",
  } as any);
  return { company, user };
}

async function createLocation(companyId: string, overrides: Record<string, unknown> = {}) {
  const suffix = `${Date.now()}-${++sequence}`;
  return storage.createCustomLocation({
    companyId,
    name: `Location ${suffix}`,
    type: "recording",
    description: "Venue description",
    address: "Main hall",
    notes: "Technical notes",
    status: "available",
    ...overrides,
  } as any);
}

describe("location workspaces", () => {
  it("isolates location lists by selected company, including platform administrators", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "GET", "/api/locations");
    const first = await createCompanyUser();
    const second = await createCompanyUser();
    const firstLocation = await createLocation(first.company.id);
    const secondLocation = await createLocation(second.company.id);

    const memberResponse = createJsonResponse();
    await handler!({ user: first.user, query: { archive: "all" } }, memberResponse);

    expect(memberResponse.statusCode).toBe(200);
    const memberIds = (memberResponse.body as any[]).map((location) => location.id);
    expect(memberIds).toContain(firstLocation.id);
    expect(memberIds).not.toContain(secondLocation.id);

    const adminResponse = createJsonResponse();
    await handler!({
      user: {
        id: "admin-stub-default-id",
        role: "admin",
        name: "Administrator",
        permissions: ["platform:admin"],
        activeWorkspaceType: "company",
        activeCompanyId: first.company.id,
      },
      workspace: {
        type: "company",
        companyId: first.company.id,
        requiresSelection: false,
        source: "session",
      },
      query: { archive: "all" },
    }, adminResponse);
    const adminIds = (adminResponse.body as any[]).map((location) => location.id);
    expect(adminIds).toContain(firstLocation.id);
    expect(adminIds).not.toContain(secondLocation.id);
  });

  it("allows a company owner to edit maintained metadata and records the last updater", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "PUT", "/api/locations/:id");
    const { company, user } = await createCompanyUser("owner");
    const location = await createLocation(company.id);
    const res = createJsonResponse();

    await handler!({
      user,
      params: { id: location.id },
      body: {
        name: `${location.name} updated`,
        type: "forum",
        address: "Building 2, hall 5",
        description: "Updated operational context",
        notes: "Updated durable venue notes",
        status: "maintenance",
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: location.id,
      name: `${location.name} updated`,
      type: "forum",
      address: "Building 2, hall 5",
      description: "Updated operational context",
      notes: "Updated durable venue notes",
      status: "maintenance",
      updatedByUserId: user.id,
      updatedByName: user.name,
    });
    expect((await storage.getCustomLocationById(location.id))?.updatedAt).toBeDefined();
  });

  it("prevents a regular company member from changing protected location metadata", async () => {
    const app = await createAppWithRoutes();
    const updateHandler = routeHandler(app, "PUT", "/api/locations/:id");
    const archiveHandler = routeHandler(app, "POST", "/api/locations/:id/archive");
    const owner = await createCompanyUser("owner");
    const member = await createCompanyUser("member");
    await storage.createCompanyMember({
      companyId: owner.company.id,
      userId: member.user.id,
      role: "member",
      status: "active",
    } as any);
    const location = await createLocation(owner.company.id);

    const updateResponse = createJsonResponse();
    await updateHandler!({
      user: member.user,
      params: { id: location.id },
      body: { notes: "Unauthorized edit" },
    }, updateResponse);
    expect(updateResponse.statusCode).toBe(403);

    const archiveResponse = createJsonResponse();
    await archiveHandler!({
      user: member.user,
      params: { id: location.id },
      body: { confirmed: true },
    }, archiveResponse);
    expect(archiveResponse.statusCode).toBe(403);
    expect((await storage.getCustomLocationById(location.id))?.archivedAt).toBeFalsy();
  });

  it("requires confirmation when archiving a location with unresolved discussions and restores it later", async () => {
    const app = await createAppWithRoutes();
    const archiveHandler = routeHandler(app, "POST", "/api/locations/:id/archive");
    const restoreHandler = routeHandler(app, "POST", "/api/locations/:id/restore");
    const listHandler = routeHandler(app, "GET", "/api/locations");
    const { company, user } = await createCompanyUser("owner");
    const location = await createLocation(company.id);
    await storage.createLocationIssue({
      locationId: location.id,
      title: "Unresolved venue problem",
      description: "Needs attention",
      severity: "high",
      status: "reported",
      reportedByUserId: user.id,
      photos: [],
    } as any);

    const weakResponse = createJsonResponse();
    await archiveHandler!({
      user,
      params: { id: location.id },
      body: {},
    }, weakResponse);
    expect(weakResponse.statusCode).toBe(409);
    expect(weakResponse.body).toMatchObject({
      code: "LOCATION_ARCHIVE_CONFIRMATION_REQUIRED",
      activeLinks: {
        unresolvedDiscussions: 1,
        total: 1,
      },
    });
    expect((await storage.getCustomLocationById(location.id))?.archivedAt).toBeFalsy();

    const confirmedResponse = createJsonResponse();
    await archiveHandler!({
      user,
      params: { id: location.id },
      body: { confirmed: true },
    }, confirmedResponse);
    expect(confirmedResponse.statusCode).toBe(200);
    expect((confirmedResponse.body as any).location.archivedAt).toBeTruthy();

    const activeListResponse = createJsonResponse();
    await listHandler!({ user, query: {} }, activeListResponse);
    expect((activeListResponse.body as any[]).map((item) => item.id)).not.toContain(location.id);

    const archiveListResponse = createJsonResponse();
    await listHandler!({ user, query: { archive: "archived" } }, archiveListResponse);
    expect((archiveListResponse.body as any[]).map((item) => item.id)).toContain(location.id);

    const restoreResponse = createJsonResponse();
    await restoreHandler!({ user, params: { id: location.id }, body: {} }, restoreResponse);
    expect(restoreResponse.statusCode).toBe(200);
    expect(restoreResponse.body).toMatchObject({ id: location.id, archivedAt: null });
    expect(await storage.getLocationIssueById((await storage.getLocationIssues(location.id))[0].id)).toBeDefined();
  });

  it("stores and removes sanitized location attachment metadata without deleting the location", async () => {
    const app = await createAppWithRoutes();
    const uploadHandler = routeHandler(app, "POST", "/api/locations/:id/attachments", "last");
    const deleteHandler = routeHandler(app, "DELETE", "/api/locations/:id/attachments/:attachmentId");
    const { company, user } = await createCompanyUser("owner");
    const location = await createLocation(company.id);
    const uploadResponse = createJsonResponse();

    await uploadHandler!({
      user,
      params: { id: location.id },
      file: {
        originalname: "venue-specification.pdf",
        filename: "venue-specification-test.pdf",
        mimetype: "application/pdf",
        size: 1024,
      },
    }, uploadResponse);

    expect(uploadResponse.statusCode).toBe(201);
    expect(uploadResponse.body).toMatchObject({
      attachment: {
        fileName: "venue-specification.pdf",
        mimeType: "application/pdf",
        uploadedByUserId: user.id,
      },
    });
    const attachmentId = (uploadResponse.body as any).attachment.id;
    expect((await storage.getCustomLocationById(location.id))?.attachments).toHaveLength(1);

    const deleteResponse = createJsonResponse();
    await deleteHandler!({
      user,
      params: { id: location.id, attachmentId },
    }, deleteResponse);

    expect(deleteResponse.statusCode).toBe(200);
    expect((await storage.getCustomLocationById(location.id))?.attachments).toEqual([]);
    expect(await storage.getCustomLocationById(location.id)).toBeDefined();
  });
});
