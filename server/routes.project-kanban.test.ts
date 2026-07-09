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

describe("project Kanban board actions", () => {
  it("registers POST /api/projects/:id/kanban-board", async () => {
    const app = await createAppWithRoutes();

    expect(registeredRoutes(app)).toContainEqual({
      method: "POST",
      path: "/api/projects/:id/kanban-board",
    });
  });

  it("creates or opens one project-specific Kanban board and syncs project members", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/projects/:id/kanban-board");
    const adminId = "admin-stub-default-id";
    const company = await storage.createCompany({
      name: "Phase 1 Project Boards",
      ownerId: adminId,
      status: "active",
    } as any);
    await storage.createCompanyMember({
      companyId: company.id,
      userId: adminId,
      role: "owner",
      status: "active",
    } as any);
    const assignee = await storage.createUser({
      username: "phase1-assignee",
      password: "test",
      name: "Phase 1 Assignee",
      email: "phase1-assignee@example.test",
      role: "employee",
      active: true,
    } as any);
    const participant = await storage.createUser({
      username: "phase1-participant",
      password: "test",
      name: "Phase 1 Participant",
      email: "phase1-participant@example.test",
      role: "employee",
      active: true,
    } as any);
    await storage.createCompanyMember({
      companyId: company.id,
      userId: assignee.id,
      role: "member",
      status: "active",
    } as any);
    await storage.createCompanyMember({
      companyId: company.id,
      userId: participant.id,
      role: "member",
      status: "active",
    } as any);
    const project = await storage.createProject({
      name: "Dedicated Kanban V2 Project",
      companyId: company.id,
      ownerId: adminId,
      assignedTo: assignee.id,
      participants: [participant.id],
      status: "planning",
      showInTaskManager: true,
    } as any);

    const firstResponse = createJsonResponse();
    await handler!({
      user: { id: adminId, role: "admin" },
      params: { id: project.id },
      body: {},
    }, firstResponse);

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.body).toMatchObject({
      created: true,
      board: {
        projectId: project.id,
        companyId: company.id,
        visibility: "members",
      },
    });

    const secondResponse = createJsonResponse();
    await handler!({
      user: { id: adminId, role: "admin" },
      params: { id: project.id },
      body: {},
    }, secondResponse);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.body).toMatchObject({
      created: false,
      board: {
        id: (firstResponse.body as any).board.id,
        projectId: project.id,
      },
    });

    const projectBoards = (await storage.getKanbanBoards()).filter((board: any) => board.projectId === project.id);
    expect(projectBoards).toHaveLength(1);

    const boardId = (firstResponse.body as any).board.id;
    const boardMembers = await storage.getKanbanBoardMembers(boardId);
    expect(boardMembers.map((member) => member.userId)).toEqual(
      expect.arrayContaining([adminId, assignee.id, participant.id]),
    );
    expect(boardMembers.filter((member) => member.boardId === boardId)).toHaveLength(3);

    const lists = await storage.getKanbanListsByBoardId(boardId);
    expect(lists.map((list) => list.name)).toEqual(["Активные", "В работе", "Готово"]);

    const createCardHandler = routeHandler(app, "POST", "/api/kanban/boards/:boardId/cards");
    const cardResponse = createJsonResponse();
    await createCardHandler!({
      user: { id: adminId, role: "admin" },
      params: { boardId },
      body: {
        listId: lists[0].id,
        title: "Project-linked card",
      },
    }, cardResponse);

    expect(cardResponse.statusCode).toBe(201);
    expect(cardResponse.body).toMatchObject({
      title: "Project-linked card",
      projectId: project.id,
    });

    const statsHandler = routeHandler(app, "GET", "/api/projects/:id/task-stats");
    const statsResponse = createJsonResponse();
    await statsHandler!({
      user: { id: adminId, role: "admin" },
      params: { id: project.id },
    }, statsResponse);

    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.body).toMatchObject({
      total: 1,
      done: 0,
    });
    expect((statsResponse.body as any).byStatus[lists[0].id]).toBe(1);
    expect((statsResponse.body as any).statusNames[lists[0].id]).toBe("Активные");
  });
});
