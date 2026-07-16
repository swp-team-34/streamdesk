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

let sequence = 0;

async function createUser(prefix: string, overrides: Record<string, unknown> = {}) {
  const suffix = `${Date.now()}-${++sequence}`;
  return storage.createUser({
    username: `${prefix}-${suffix}`,
    password: "test-password",
    name: `${prefix} ${suffix}`,
    role: "employee",
    permissions: [],
    active: true,
    onboardingCompleted: true,
    ...overrides,
  } as any);
}

async function createCompanyFor(userId: string, prefix: string) {
  const company = await storage.createCompany({
    name: `${prefix} ${Date.now()}-${++sequence}`,
    ownerId: userId,
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId,
    role: "owner",
    status: "active",
  } as any);
  return company;
}

function companyRequest(user: any, companyId: string) {
  return {
    user: {
      ...user,
      activeWorkspaceType: "company",
      activeCompanyId: companyId,
    },
    workspace: {
      type: "company",
      companyId,
      requiresSelection: false,
      source: "session",
    },
  };
}

describe("active workspace isolation", () => {
  it("requires an explicit selection for multiple companies and persists a valid choice", async () => {
    const app = await createAppWithRoutes();
    const getWorkspace = routeHandler(app, "GET", "/api/workspace-context");
    const selectWorkspace = routeHandler(app, "POST", "/api/workspace-context");
    const user = await createUser("multi-company-user");
    const firstCompany = await createCompanyFor(user.id, "First workspace");
    const secondCompany = await createCompanyFor(user.id, "Second workspace");

    const initialResponse = createJsonResponse();
    await getWorkspace!({ user, session: {} }, initialResponse);
    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.body).toMatchObject({
      workspace: {
        type: null,
        companyId: null,
        requiresSelection: true,
      },
    });
    expect((initialResponse.body as any).companies.map((company: any) => company.id))
      .toEqual(expect.arrayContaining([firstCompany.id, secondCompany.id]));

    const session: Record<string, unknown> = {};
    const selectionResponse = createJsonResponse();
    await selectWorkspace!({
      user,
      session,
      body: { type: "company", companyId: secondCompany.id },
    }, selectionResponse);
    expect(selectionResponse.statusCode).toBe(200);
    expect(selectionResponse.body).toMatchObject({
      workspace: {
        type: "company",
        companyId: secondCompany.id,
        requiresSelection: false,
      },
    });
    expect(session).toMatchObject({
      activeWorkspaceType: "company",
      activeCompanyId: secondCompany.id,
    });
    expect(await storage.getUser(user.id)).toMatchObject({
      activeWorkspaceType: "company",
      activeCompanyId: secondCompany.id,
    });

    const restoredUser = await storage.getUser(user.id);
    const restoredResponse = createJsonResponse();
    await getWorkspace!({ user: restoredUser, session: {} }, restoredResponse);
    expect(restoredResponse.body).toMatchObject({
      workspace: {
        type: "company",
        companyId: secondCompany.id,
        requiresSelection: false,
        source: "persisted",
      },
    });
  });

  it("selects one company automatically and rejects a revoked persisted company", async () => {
    const app = await createAppWithRoutes();
    const getWorkspace = routeHandler(app, "GET", "/api/workspace-context");
    const automaticUser = await createUser("automatic-company-user");
    const automaticCompany = await createCompanyFor(automaticUser.id, "Automatic workspace");
    const automaticSession: Record<string, unknown> = {};
    const automaticResponse = createJsonResponse();

    await getWorkspace!({ user: automaticUser, session: automaticSession }, automaticResponse);
    expect(automaticResponse.body).toMatchObject({
      workspace: {
        type: "company",
        companyId: automaticCompany.id,
        requiresSelection: false,
        source: "automatic",
      },
    });
    expect(automaticSession).toMatchObject({
      activeWorkspaceType: "company",
      activeCompanyId: automaticCompany.id,
    });

    const revokedUser = await createUser("revoked-company-user");
    const revokedCompany = await createCompanyFor(revokedUser.id, "Revoked workspace");
    const remainingCompanyA = await createCompanyFor(revokedUser.id, "Remaining workspace A");
    const remainingCompanyB = await createCompanyFor(revokedUser.id, "Remaining workspace B");
    await storage.updateUser(revokedUser.id, {
      activeWorkspaceType: "company",
      activeCompanyId: revokedCompany.id,
    } as any);
    const membership = await storage.getCompanyMembershipByUser(revokedCompany.id, revokedUser.id);
    expect(membership).toBeTruthy();
    await storage.updateCompanyMember(membership!.id, { status: "revoked" } as any);
    const refreshedUser = await storage.getUser(revokedUser.id);
    const revokedResponse = createJsonResponse();

    await getWorkspace!({ user: refreshedUser, session: {} }, revokedResponse);
    expect(revokedResponse.body).toMatchObject({
      workspace: {
        type: null,
        companyId: null,
        requiresSelection: true,
        source: "none",
      },
    });
    const selectableIds = (revokedResponse.body as any).companies.map((company: any) => company.id);
    expect(selectableIds).toEqual(expect.arrayContaining([remainingCompanyA.id, remainingCompanyB.id]));
    expect(selectableIds).not.toContain(revokedCompany.id);
  });

  it("separates company projects from personal projects and other users", async () => {
    const app = await createAppWithRoutes();
    const listProjects = routeHandler(app, "GET", "/api/projects");
    const firstUser = await createUser("first-project-user");
    const secondUser = await createUser("second-project-user");
    const firstCompany = await createCompanyFor(firstUser.id, "First project company");
    const secondCompany = await createCompanyFor(secondUser.id, "Second project company");
    const firstCompanyProject = await storage.createProject({
      name: "First company project",
      companyId: firstCompany.id,
      ownerId: firstUser.id,
      status: "planning",
    } as any);
    const secondCompanyProject = await storage.createProject({
      name: "Second company project",
      companyId: secondCompany.id,
      ownerId: secondUser.id,
      status: "planning",
    } as any);
    const firstPersonalProject = await storage.createProject({
      name: "First personal project",
      companyId: null,
      visibility: "personal",
      ownerId: firstUser.id,
      status: "planning",
    } as any);
    const secondPersonalProject = await storage.createProject({
      name: "Second personal project",
      companyId: null,
      visibility: "personal",
      ownerId: secondUser.id,
      status: "planning",
    } as any);

    const companyResponse = createJsonResponse();
    await listProjects!({
      ...companyRequest(firstUser, firstCompany.id),
    }, companyResponse);
    const companyIds = (companyResponse.body as any[]).map((project) => project.id);
    expect(companyIds).toContain(firstCompanyProject.id);
    expect(companyIds).not.toContain(secondCompanyProject.id);
    expect(companyIds).not.toContain(firstPersonalProject.id);

    const personalResponse = createJsonResponse();
    await listProjects!({
      user: {
        ...firstUser,
        activeWorkspaceType: "personal",
        activeCompanyId: null,
      },
      workspace: {
        type: "personal",
        companyId: null,
        requiresSelection: false,
        source: "session",
      },
    }, personalResponse);
    const personalIds = (personalResponse.body as any[]).map((project) => project.id);
    expect(personalIds).toContain(firstPersonalProject.id);
    expect(personalIds).not.toContain(secondPersonalProject.id);
    expect(personalIds).not.toContain(firstCompanyProject.id);
  });

  it("blocks direct task access and Warehouse reads across selected companies", async () => {
    const app = await createAppWithRoutes();
    const getTask = routeHandler(app, "GET", "/api/tasks/:id");
    const listEquipment = routeHandler(app, "GET", "/api/equipment");
    const firstUser = await createUser("first-data-user");
    const secondUser = await createUser("second-data-user");
    const firstCompany = await createCompanyFor(firstUser.id, "First data company");
    const secondCompany = await createCompanyFor(secondUser.id, "Second data company");
    const foreignTask = await storage.createTask({
      title: "Foreign task",
      creatorId: secondUser.id,
      companyId: secondCompany.id,
      status: "todo",
      priority: "medium",
    } as any);
    const firstEquipment = await storage.createEquipment({
      name: "First company camera",
      type: "camera",
      status: "available",
      specifications: { companyId: firstCompany.id },
    } as any);
    const secondEquipment = await storage.createEquipment({
      name: "Second company camera",
      type: "camera",
      status: "available",
      specifications: { companyId: secondCompany.id },
    } as any);

    const taskResponse = createJsonResponse();
    await getTask!({
      ...companyRequest(firstUser, firstCompany.id),
      params: { id: foreignTask.id },
    }, taskResponse);
    expect(taskResponse.statusCode).toBe(404);

    const equipmentResponse = createJsonResponse();
    await listEquipment!({
      ...companyRequest(firstUser, firstCompany.id),
      query: {},
    }, equipmentResponse);
    const equipmentIds = (equipmentResponse.body as any[]).map((item) => item.id);
    expect(equipmentIds).toContain(firstEquipment.id);
    expect(equipmentIds).not.toContain(secondEquipment.id);
  });

  it("keeps platform administrators and manager statistics inside the selected company", async () => {
    const app = await createAppWithRoutes();
    const listProjects = routeHandler(app, "GET", "/api/projects");
    const managerStats = routeHandler(app, "GET", "/api/manager/stats");
    const firstOwner = await createUser("platform-first-owner");
    const secondOwner = await createUser("platform-second-owner");
    const platformAdmin = await createUser("platform-admin", {
      role: "admin",
      permissions: ["platform:admin", "tasks:view_all"],
    });
    const firstCompany = await createCompanyFor(firstOwner.id, "Platform first company");
    const secondCompany = await createCompanyFor(secondOwner.id, "Platform second company");
    const firstProject = await storage.createProject({
      name: "Platform first project",
      companyId: firstCompany.id,
      ownerId: firstOwner.id,
      status: "planning",
    } as any);
    const secondProject = await storage.createProject({
      name: "Platform second project",
      companyId: secondCompany.id,
      ownerId: secondOwner.id,
      status: "planning",
    } as any);
    await storage.createTask({
      title: "First company manager task",
      creatorId: firstOwner.id,
      companyId: firstCompany.id,
      status: "todo",
      priority: "medium",
    } as any);
    await storage.createTask({
      title: "Second company manager task",
      creatorId: secondOwner.id,
      companyId: secondCompany.id,
      status: "done",
      priority: "high",
    } as any);

    const platformResponse = createJsonResponse();
    await listProjects!({
      ...companyRequest(platformAdmin, firstCompany.id),
    }, platformResponse);
    const projectIds = (platformResponse.body as any[]).map((project) => project.id);
    expect(projectIds).toContain(firstProject.id);
    expect(projectIds).not.toContain(secondProject.id);

    const statsResponse = createJsonResponse();
    await managerStats!({
      ...companyRequest(firstOwner, firstCompany.id),
    }, statsResponse);
    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.body).toMatchObject({
      totalTasks: 1,
      completedTasks: 0,
      inProgressTasks: 0,
    });
  });

  it("blocks production participant profiles and markers through a foreign event", async () => {
    const app = await createAppWithRoutes();
    const getProfiles = routeHandler(app, "GET", "/api/events/:eventId/participant-profiles");
    const updateProfile = routeHandler(app, "PUT", "/api/participant-profiles/:id");
    const getMarkers = routeHandler(app, "GET", "/api/events/:eventId/markers");
    const updateMarker = routeHandler(app, "PUT", "/api/markers/:id");
    const firstUser = await createUser("production-first-user");
    const secondUser = await createUser("production-second-user");
    const firstCompany = await createCompanyFor(firstUser.id, "Production first company");
    const secondCompany = await createCompanyFor(secondUser.id, "Production second company");
    const foreignEvent = await storage.createEvent({
      companyId: secondCompany.id,
      title: "Foreign production event",
      startTime: new Date(),
      endTime: new Date(Date.now() + 60_000),
      location: "Studio",
      organizerId: secondUser.id,
      status: "scheduled",
      type: "stream",
    } as any);
    const foreignProfile = await storage.createShowParticipantProfile({
      eventId: foreignEvent.id,
      name: "Foreign guest",
      contacts: {},
      extra: {},
      order: 0,
    } as any);
    const foreignMarker = await storage.createShowMarker({
      eventId: foreignEvent.id,
      timecode: "00:00:10",
      type: "note",
      editorId: secondUser.id,
    } as any);
    const requestContext = companyRequest(firstUser, firstCompany.id);

    const profilesResponse = createJsonResponse();
    await getProfiles!({
      ...requestContext,
      params: { eventId: foreignEvent.id },
    }, profilesResponse);
    expect(profilesResponse.statusCode).toBe(403);

    const profileUpdateResponse = createJsonResponse();
    await updateProfile!({
      ...requestContext,
      params: { id: foreignProfile.id },
      body: { name: "Leaked update" },
    }, profileUpdateResponse);
    expect(profileUpdateResponse.statusCode).toBe(403);

    const markersResponse = createJsonResponse();
    await getMarkers!({
      ...requestContext,
      params: { eventId: foreignEvent.id },
    }, markersResponse);
    expect(markersResponse.statusCode).toBe(403);

    const markerUpdateResponse = createJsonResponse();
    await updateMarker!({
      ...requestContext,
      params: { id: foreignMarker.id },
      body: { note: "Leaked update" },
    }, markerUpdateResponse);
    expect(markerUpdateResponse.statusCode).toBe(403);
  });
});
