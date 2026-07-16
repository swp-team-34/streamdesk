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

async function createCompanyWorkspace() {
  const suffix = `${Date.now()}-${++sequence}`;
  const user = await storage.createUser({
    username: `location-link-user-${suffix}`,
    password: "test-password",
    name: `Location Link User ${suffix}`,
    role: "employee",
    permissions: [],
    active: true,
  } as any);
  const company = await storage.createCompany({
    name: `Location Link Company ${suffix}`,
    ownerId: user.id,
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId: user.id,
    role: "owner",
    status: "active",
  } as any);
  return { company, user };
}

async function createLocation(companyId: string, name: string) {
  return storage.createCustomLocation({
    companyId,
    name: `${name} ${Date.now()}-${++sequence}`,
    type: "recording",
    status: "available",
  } as any);
}

async function createBoard(companyId: string, userId: string, projectId?: string) {
  const board = await storage.createKanbanBoard({
    companyId,
    projectId: projectId || null,
    name: `Board ${Date.now()}-${++sequence}`,
    visibility: "company",
    createdByUserId: userId,
  } as any);
  const activeList = await storage.createKanbanList({
    boardId: board.id,
    name: "Active",
    type: "active",
    position: 0,
  } as any);
  const closedList = await storage.createKanbanList({
    boardId: board.id,
    name: "Closed",
    type: "closed",
    position: 1,
  } as any);
  return { board, activeList, closedList };
}

describe("project and Kanban V2 location links", () => {
  it("stores multiple deduplicated card locations and returns high-severity warnings", async () => {
    const app = await createAppWithRoutes();
    const createCard = routeHandler(app, "POST", "/api/kanban/boards/:boardId/cards");
    const { company, user } = await createCompanyWorkspace();
    const firstLocation = await createLocation(company.id, "First");
    const secondLocation = await createLocation(company.id, "Second");
    const { board, activeList } = await createBoard(company.id, user.id);
    await storage.createLocationIssue({
      locationId: secondLocation.id,
      title: "Power failure",
      description: "Power circuit is unstable",
      severity: "high",
      status: "reported",
      reportedByUserId: user.id,
      photos: [],
    } as any);

    const response = createJsonResponse();
    await createCard!({
      user,
      params: { boardId: board.id },
      body: {
        listId: activeList.id,
        title: "Linked card",
        priority: "medium",
        locationIds: [firstLocation.id, secondLocation.id, firstLocation.id],
      },
    }, response);

    expect(response.statusCode).toBe(201);
    expect((response.body as any).locationIds).toEqual([firstLocation.id, secondLocation.id]);
    expect((response.body as any).locations.map((location: any) => location.id)).toEqual([
      firstLocation.id,
      secondLocation.id,
    ]);
    expect((response.body as any).locationWarnings).toEqual([
      expect.objectContaining({
        locationId: secondLocation.id,
        title: "Power failure",
        severity: "high",
      }),
    ]);
    expect((response.body as any).locationTopics).toEqual([
      expect.objectContaining({
        locationId: secondLocation.id,
        title: "Power failure",
        type: "issue",
        status: "active",
      }),
    ]);
    expect(await storage.getKanbanCardLocationLinks((response.body as any).id)).toHaveLength(2);
  });

  it("rejects cross-company and newly archived links without destroying existing card links", async () => {
    const app = await createAppWithRoutes();
    const createCard = routeHandler(app, "POST", "/api/kanban/boards/:boardId/cards");
    const updateCard = routeHandler(app, "PUT", "/api/kanban/boards/:boardId/cards/:cardId");
    const owner = await createCompanyWorkspace();
    const outsider = await createCompanyWorkspace();
    const activeLocation = await createLocation(owner.company.id, "Active");
    const archivedLocation = await createLocation(owner.company.id, "Archived");
    const foreignLocation = await createLocation(outsider.company.id, "Foreign");
    const { board, activeList } = await createBoard(owner.company.id, owner.user.id);

    const createResponse = createJsonResponse();
    await createCard!({
      user: owner.user,
      params: { boardId: board.id },
      body: {
        listId: activeList.id,
        title: "Existing link",
        priority: "medium",
        locationIds: [activeLocation.id],
      },
    }, createResponse);
    const cardId = (createResponse.body as any).id;

    const foreignResponse = createJsonResponse();
    await updateCard!({
      user: owner.user,
      params: { boardId: board.id, cardId },
      body: { locationIds: [foreignLocation.id] },
    }, foreignResponse);
    expect(foreignResponse.statusCode).toBe(403);
    expect((await storage.getKanbanCardLocationLinks(cardId)).map((link) => link.locationId)).toEqual([activeLocation.id]);

    await storage.updateCustomLocation(archivedLocation.id, { archivedAt: new Date() } as any);
    const archivedResponse = createJsonResponse();
    await updateCard!({
      user: owner.user,
      params: { boardId: board.id, cardId },
      body: { locationIds: [activeLocation.id, archivedLocation.id] },
    }, archivedResponse);
    expect(archivedResponse.statusCode).toBe(409);
    expect((await storage.getKanbanCardLocationLinks(cardId)).map((link) => link.locationId)).toEqual([activeLocation.id]);

    await storage.updateCustomLocation(activeLocation.id, { archivedAt: new Date() } as any);
    const retainedResponse = createJsonResponse();
    await updateCard!({
      user: owner.user,
      params: { boardId: board.id, cardId },
      body: { locationIds: [activeLocation.id] },
    }, retainedResponse);
    expect(retainedResponse.statusCode).toBe(200);
    expect((retainedResponse.body as any).locations[0]).toMatchObject({
      id: activeLocation.id,
    });
  });

  it("aggregates direct project locations with Kanban card locations and exposes reverse navigation data", async () => {
    const app = await createAppWithRoutes();
    const listProjects = routeHandler(app, "GET", "/api/projects");
    const getLocation = routeHandler(app, "GET", "/api/locations/:id");
    const archivePreview = routeHandler(app, "GET", "/api/locations/:id/archive-preview");
    const { company, user } = await createCompanyWorkspace();
    const directLocation = await createLocation(company.id, "Direct");
    const cardLocation = await createLocation(company.id, "Card");
    const project = await storage.createProject({
      companyId: company.id,
      ownerId: user.id,
      name: `Project ${Date.now()}-${++sequence}`,
      status: "planning",
    } as any);
    await storage.setProjectLocations(project.id, [directLocation.id, directLocation.id]);
    const { board, activeList, closedList } = await createBoard(company.id, user.id, project.id);
    const activeCard = await storage.createKanbanCard({
      boardId: board.id,
      projectId: project.id,
      listId: activeList.id,
      title: "Active card",
      priority: "medium",
      creatorUserId: user.id,
      position: 0,
    } as any);
    const completedCard = await storage.createKanbanCard({
      boardId: board.id,
      projectId: project.id,
      listId: closedList.id,
      title: "Completed card",
      priority: "medium",
      creatorUserId: user.id,
      position: 0,
    } as any);
    await storage.setKanbanCardLocations(activeCard.id, [cardLocation.id]);
    await storage.setKanbanCardLocations(completedCard.id, [cardLocation.id]);
    const topic = await storage.createLocationIssue({
      locationId: cardLocation.id,
      projectId: project.id,
      type: "note",
      title: "Venue access",
      description: "Use the service entrance",
      severity: null,
      status: "active",
      reportedByUserId: user.id,
      authorName: user.name,
      photos: [],
    } as any);

    const projectResponse = createJsonResponse();
    await listProjects!({ user }, projectResponse);
    const responseProject = (projectResponse.body as any[]).find((item) => item.id === project.id);
    expect(responseProject.directLocationIds).toEqual([directLocation.id]);
    expect(responseProject.locationIds).toEqual([directLocation.id, cardLocation.id]);
    expect(responseProject.locations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: directLocation.id, source: "direct" }),
      expect.objectContaining({ id: cardLocation.id, source: "cards" }),
    ]));
    expect(responseProject.locationTopics).toEqual([
      expect.objectContaining({
        id: topic.id,
        locationId: cardLocation.id,
        title: "Venue access",
        type: "note",
        status: "active",
      }),
    ]);

    const locationResponse = createJsonResponse();
    await getLocation!({ user, params: { id: cardLocation.id } }, locationResponse);
    expect((locationResponse.body as any).linkedWork.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: activeCard.id, status: "active" }),
      expect.objectContaining({ id: completedCard.id, status: "completed" }),
    ]));
    expect((locationResponse.body as any).linkedWork.projects).toEqual([
      expect.objectContaining({ id: project.id, source: "cards", completed: false }),
    ]);

    const previewResponse = createJsonResponse();
    await archivePreview!({ user, params: { id: cardLocation.id } }, previewResponse);
    expect(previewResponse.body).toMatchObject({
      activeLinks: {
        activeKanbanCards: 1,
        activeProjects: 1,
        unresolvedDiscussions: 1,
        total: 3,
      },
    });
  });

  it("validates project links by company and keeps archived existing locations removable", async () => {
    const app = await createAppWithRoutes();
    const updateProject = routeHandler(app, "PUT", "/api/projects/:id");
    const owner = await createCompanyWorkspace();
    const outsider = await createCompanyWorkspace();
    const retainedLocation = await createLocation(owner.company.id, "Retained");
    const foreignLocation = await createLocation(outsider.company.id, "Foreign project");
    const project = await storage.createProject({
      companyId: owner.company.id,
      ownerId: owner.user.id,
      name: `Project ${Date.now()}-${++sequence}`,
      status: "planning",
    } as any);
    await storage.setProjectLocations(project.id, [retainedLocation.id]);

    const foreignResponse = createJsonResponse();
    await updateProject!({
      user: owner.user,
      params: { id: project.id },
      body: { locationIds: [foreignLocation.id] },
    }, foreignResponse);
    expect(foreignResponse.statusCode).toBe(403);
    expect((await storage.getProjectLocationLinks(project.id)).map((link) => link.locationId)).toEqual([retainedLocation.id]);

    await storage.updateCustomLocation(retainedLocation.id, { archivedAt: new Date() } as any);
    const retainedResponse = createJsonResponse();
    await updateProject!({
      user: owner.user,
      params: { id: project.id },
      body: { locationIds: [retainedLocation.id] },
    }, retainedResponse);
    expect(retainedResponse.statusCode).toBe(200);

    const removeResponse = createJsonResponse();
    await updateProject!({
      user: owner.user,
      params: { id: project.id },
      body: { locationIds: [] },
    }, removeResponse);
    expect(removeResponse.statusCode).toBe(200);
    expect(await storage.getProjectLocationLinks(project.id)).toEqual([]);
  });
});
