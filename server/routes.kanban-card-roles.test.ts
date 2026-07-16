import express from "express";
import { beforeAll, describe, expect, it } from "vitest";
import { registerRoutes } from "./routes";
import { storage } from "./database";

let app: express.Express;
let sequence = 0;

function routeHandler(method: string, path: string) {
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

async function createUser(prefix: string) {
  const suffix = `${Date.now()}-${++sequence}`;
  return await storage.createUser({
    username: `${prefix}-${suffix}`,
    password: "test-password",
    name: `${prefix} ${suffix}`,
    role: "employee",
    permissions: [],
    active: true,
  } as any);
}

async function createCompanyWorkspace(prefix: string) {
  const owner = await createUser(`${prefix}-owner`);
  const company = await storage.createCompany({
    name: `${prefix} Company ${Date.now()}-${sequence}`,
    ownerId: owner.id,
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId: owner.id,
    role: "owner",
    status: "active",
  } as any);
  return { owner, company };
}

async function addCompanyUser(companyId: string, prefix: string) {
  const user = await createUser(prefix);
  await storage.createCompanyMember({
    companyId,
    userId: user.id,
    role: "member",
    status: "active",
  } as any);
  return user;
}

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);
});

describe("Kanban V2 card roles and date precision", () => {
  it("stores distinct initiator, responsible and multiple assignees with legacy compatibility", async () => {
    const { owner, company } = await createCompanyWorkspace("kanban-roles");
    const initiator = await addCompanyUser(company.id, "kanban-initiator");
    const responsible = await addCompanyUser(company.id, "kanban-responsible");
    const firstAssignee = await addCompanyUser(company.id, "kanban-assignee-one");
    const secondAssignee = await addCompanyUser(company.id, "kanban-assignee-two");
    const board = await storage.createKanbanBoard({
      companyId: company.id,
      name: "Role board",
      visibility: "company",
      createdByUserId: owner.id,
    } as any);
    const list = await storage.createKanbanList({
      boardId: board.id,
      name: "Active",
      type: "active",
      position: 0,
    } as any);

    const createCard = routeHandler("POST", "/api/kanban/boards/:boardId/cards");
    const createResponse = createJsonResponse();
    await createCard!({
      user: owner,
      params: { boardId: board.id },
      body: {
        listId: list.id,
        title: "Role-aware card",
        initiatorUserId: initiator.id,
        responsibleUserId: responsible.id,
        assigneeUserIds: [firstAssignee.id, secondAssignee.id, firstAssignee.id],
        dueDate: "2026-07-21",
        dueDateHasTime: false,
      },
    }, createResponse);

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body).toMatchObject({
      initiatorUserId: initiator.id,
      responsibleUserId: responsible.id,
      assigneeUserIds: [firstAssignee.id, secondAssignee.id],
      assigneeUserId: firstAssignee.id,
      dueDateHasTime: false,
    });

    const cardId = String((createResponse.body as any).id);
    const updateCard = routeHandler("PUT", "/api/kanban/boards/:boardId/cards/:cardId");
    const updateResponse = createJsonResponse();
    await updateCard!({
      user: owner,
      params: { boardId: board.id, cardId },
      body: {
        responsibleUserId: firstAssignee.id,
        assigneeUserIds: [secondAssignee.id],
      },
    }, updateResponse);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body).toMatchObject({
      responsibleUserId: firstAssignee.id,
      assigneeUserIds: [secondAssignee.id],
      assigneeUserId: secondAssignee.id,
    });
    const history = await storage.getKanbanCardHistory(cardId);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "roles_updated" }),
    ]));
  });

  it("rejects cross-company role assignment and invalid paired time", async () => {
    const workspace = await createCompanyWorkspace("kanban-isolation");
    const outsiderWorkspace = await createCompanyWorkspace("kanban-outsider");
    const board = await storage.createKanbanBoard({
      companyId: workspace.company.id,
      name: "Isolated board",
      visibility: "company",
      createdByUserId: workspace.owner.id,
    } as any);
    const list = await storage.createKanbanList({
      boardId: board.id,
      name: "Active",
      type: "active",
      position: 0,
    } as any);
    const createCard = routeHandler("POST", "/api/kanban/boards/:boardId/cards");

    const outsiderResponse = createJsonResponse();
    await createCard!({
      user: workspace.owner,
      params: { boardId: board.id },
      body: {
        listId: list.id,
        title: "Cross-company assignment",
        assigneeUserIds: [outsiderWorkspace.owner.id],
      },
    }, outsiderResponse);
    expect(outsiderResponse.statusCode).toBe(400);
    expect((outsiderResponse.body as any).message).toContain("компании доски");

    const invalidDateResponse = createJsonResponse();
    await createCard!({
      user: workspace.owner,
      params: { boardId: board.id },
      body: {
        listId: list.id,
        title: "Invalid range",
        startDate: "2026-07-21T14:00",
        startDateHasTime: true,
        dueDate: "2026-07-22",
        dueDateHasTime: false,
      },
    }, invalidDateResponse);
    expect(invalidDateResponse.statusCode).toBe(400);
    expect((invalidDateResponse.body as any).message).toContain("время");
  });

  it("defaults the initiator to the creator for existing clients", async () => {
    const owner = await createUser("kanban-personal-owner");
    const board = await storage.createKanbanBoard({
      companyId: null,
      name: "Personal board",
      visibility: "personal",
      createdByUserId: owner.id,
    } as any);
    const list = await storage.createKanbanList({
      boardId: board.id,
      name: "Active",
      type: "active",
      position: 0,
    } as any);
    const createCard = routeHandler("POST", "/api/kanban/boards/:boardId/cards");
    const response = createJsonResponse();
    await createCard!({
      user: owner,
      params: { boardId: board.id },
      body: {
        listId: list.id,
        title: "Legacy payload",
        assigneeUserId: owner.id,
      },
    }, response);

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      creatorUserId: owner.id,
      initiatorUserId: owner.id,
      assigneeUserIds: [owner.id],
      assigneeUserId: owner.id,
    });
  });
});
