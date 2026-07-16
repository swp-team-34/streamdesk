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
      user: {
        id: adminId,
        role: "admin",
        activeWorkspaceType: "company",
        activeCompanyId: company.id,
      },
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
      project: {
        id: project.id,
        showInTaskManager: true,
      },
    });

    const secondResponse = createJsonResponse();
    await handler!({
      user: {
        id: adminId,
        role: "admin",
        activeWorkspaceType: "company",
        activeCompanyId: company.id,
      },
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
      source: {
        type: "kanban-v2",
        boardIds: [boardId],
      },
      tasks: {
        total: 1,
        active: 1,
        completed: 0,
      },
    });
    expect((statsResponse.body as any).byStatus[lists[0].id]).toBe(1);
    expect((statsResponse.body as any).statusNames[lists[0].id]).toBe("Активные");
    expect((statsResponse.body as any).tasks.deadlines.noDeadline).toBe(1);
  });

  it("builds company-isolated project readiness statistics from Kanban V2 and linked records", async () => {
    const app = await createAppWithRoutes();
    const statsHandler = routeHandler(app, "GET", "/api/projects/:id/task-stats");
    const adminId = "admin-stub-default-id";
    const suffix = `${Date.now()}-project-stats`;
    const company = await storage.createCompany({
      name: `Unified stats ${suffix}`,
      ownerId: adminId,
      status: "active",
    } as any);
    await storage.createCompanyMember({
      companyId: company.id,
      userId: adminId,
      role: "owner",
      status: "active",
    } as any);
    const project = await storage.createProject({
      name: `Unified stats project ${suffix}`,
      companyId: company.id,
      ownerId: adminId,
      status: "planning",
      participants: [],
    } as any);
    const board = await storage.createKanbanBoard({
      companyId: company.id,
      projectId: project.id,
      name: `Unified stats board ${suffix}`,
      visibility: "company",
      createdByUserId: adminId,
    } as any);
    const activeList = await storage.createKanbanList({
      boardId: board.id,
      name: "Активные",
      type: "active",
      position: 0,
    } as any);
    const progressList = await storage.createKanbanList({
      boardId: board.id,
      name: "В работе",
      type: "active",
      position: 1,
    } as any);
    const doneList = await storage.createKanbanList({
      boardId: board.id,
      name: "Готово",
      type: "closed",
      position: 2,
    } as any);
    const futureCard = await storage.createKanbanCard({
      boardId: board.id,
      projectId: project.id,
      listId: activeList.id,
      title: "Future task",
      assigneeUserId: adminId,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      position: 0,
    } as any);
    const overdueCard = await storage.createKanbanCard({
      boardId: board.id,
      projectId: project.id,
      listId: progressList.id,
      title: "Overdue task",
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      position: 0,
    } as any);
    await storage.createKanbanCard({
      boardId: board.id,
      projectId: project.id,
      listId: doneList.id,
      title: "Completed task",
      assigneeUserId: adminId,
      position: 0,
    } as any);

    const activeLocation = await storage.createCustomLocation({
      companyId: company.id,
      name: `Active location ${suffix}`,
      status: "available",
    } as any);
    const archivedLocation = await storage.createCustomLocation({
      companyId: company.id,
      name: `Archived location ${suffix}`,
      status: "available",
      archivedAt: new Date(),
    } as any);
    await storage.setProjectLocations(project.id, [activeLocation.id, archivedLocation.id]);
    await storage.createLocationIssue({
      locationId: activeLocation.id,
      projectId: project.id,
      type: "issue",
      title: "Power risk",
      description: "Needs backup",
      severity: "high",
      status: "active",
      reportedByUserId: adminId,
      photos: [],
    } as any);

    const linkedEquipment = await storage.createEquipment({
      name: `Linked camera ${suffix}`,
      type: "camera",
      status: "available",
      operabilityStatus: "broken",
      specifications: { companyId: company.id },
    } as any);
    await storage.replaceEquipmentContextLinks({
      equipmentId: linkedEquipment.id,
      source: "manual",
      projectId: project.id,
      kanbanCardIds: [futureCard.id],
      createdByUserId: adminId,
    });
    const requestedEquipment = await storage.createEquipment({
      name: `Requested camera ${suffix}`,
      type: "camera",
      status: "available",
      operabilityStatus: "working",
      specifications: { companyId: company.id },
    } as any);
    await storage.createEquipmentCheckoutRequest({
      companyId: company.id,
      equipmentId: requestedEquipment.id,
      requestedBy: adminId,
      kanbanCardId: overdueCard.id,
      kanbanCardIds: [overdueCard.id],
      projectId: project.id,
      quantity: 1,
      requestType: "checkout",
      status: "pending",
    } as any);

    const response = createJsonResponse();
    await statsHandler!({
      user: {
        id: adminId,
        role: "admin",
        activeWorkspaceType: "company",
        activeCompanyId: company.id,
      },
      params: { id: project.id },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      tasks: {
        total: 3,
        active: 2,
        inProgress: 1,
        completed: 1,
        overdue: 1,
        unassigned: 1,
        deadlines: {
          overdue: 1,
          future: 1,
          noDeadline: 0,
        },
      },
      locations: {
        total: 2,
        active: 1,
        archived: 1,
        unresolvedIssues: 1,
        bySeverity: {
          high: 1,
        },
      },
      equipment: {
        total: 2,
        linked: 1,
        requested: 1,
        brokenOrRepair: 1,
      },
    });
  });

  it("coalesces concurrent project board creation requests", async () => {
    const app = await createAppWithRoutes();
    const handler = routeHandler(app, "POST", "/api/projects/:id/kanban-board");
    const adminId = "admin-stub-default-id";
    const company = await storage.createCompany({
      name: "Concurrent Project Boards",
      ownerId: adminId,
      status: "active",
    } as any);
    await storage.createCompanyMember({
      companyId: company.id,
      userId: adminId,
      role: "owner",
      status: "active",
    } as any);
    const project = await storage.createProject({
      name: "Concurrent Kanban Project",
      companyId: company.id,
      ownerId: adminId,
      status: "planning",
      showInTaskManager: false,
    } as any);
    const firstResponse = createJsonResponse();
    const secondResponse = createJsonResponse();
    const request = {
      user: {
        id: adminId,
        role: "admin",
        activeWorkspaceType: "company",
        activeCompanyId: company.id,
      },
      params: { id: project.id },
      body: {},
    };

    await Promise.all([
      handler!({ ...request }, firstResponse),
      handler!({ ...request }, secondResponse),
    ]);

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect((firstResponse.body as any).board.id).toBe((secondResponse.body as any).board.id);
    expect([(firstResponse.body as any).created, (secondResponse.body as any).created].sort())
      .toEqual([false, true]);
    expect((await storage.getKanbanBoards()).filter((board) => board.projectId === project.id))
      .toHaveLength(1);
    expect(await storage.getKanbanListsByBoardId((firstResponse.body as any).board.id))
      .toHaveLength(3);
  });
});
