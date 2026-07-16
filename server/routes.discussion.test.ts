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

async function createWorkspace(prefix: string) {
  const suffix = `${Date.now()}-${++sequence}`;
  const user = await storage.createUser({
    username: `${prefix}-${suffix}`,
    password: "test-password",
    name: `${prefix} User`,
    role: "employee",
    permissions: [],
    active: true,
  } as any);
  const company = await storage.createCompany({
    name: `${prefix} Company ${suffix}`,
    ownerId: user.id,
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId: user.id,
    role: "owner",
    status: "active",
  } as any);
  return { user, company };
}

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);
});

describe("project and Kanban V2 threaded discussions", () => {
  it("preserves legacy Kanban comments, adds root replies, and soft-deletes without losing the thread", async () => {
    const { user, company } = await createWorkspace("kanban-discussion");
    const board = await storage.createKanbanBoard({
      companyId: company.id,
      name: "Discussion board",
      visibility: "company",
      createdByUserId: user.id,
    } as any);
    const list = await storage.createKanbanList({
      boardId: board.id,
      name: "Active",
      type: "active",
      position: 0,
    } as any);
    const card = await storage.createKanbanCard({
      boardId: board.id,
      listId: list.id,
      title: "Discussion card",
      priority: "medium",
      creatorUserId: user.id,
      position: 0,
    } as any);
    const legacyComment = await storage.createKanbanCardComment({
      cardId: card.id,
      userId: user.id,
      content: "Existing comment",
    } as any);

    const listComments = routeHandler("GET", "/api/kanban/boards/:boardId/cards/:cardId/comments");
    const legacyResponse = createJsonResponse();
    await listComments!({
      user,
      params: { boardId: board.id, cardId: card.id },
    }, legacyResponse);

    expect(legacyResponse.statusCode).toBe(200);
    expect(legacyResponse.body).toEqual([
      expect.objectContaining({
        id: legacyComment.id,
        content: "Existing comment",
        authorName: user.name,
      }),
    ]);

    const createComment = routeHandler("POST", "/api/kanban/boards/:boardId/cards/:cardId/comments");
    const replyResponse = createJsonResponse();
    await createComment!({
      user,
      params: { boardId: board.id, cardId: card.id },
      body: {
        content: "Reply",
        parentCommentId: legacyComment.id,
      },
    }, replyResponse);

    expect(replyResponse.statusCode).toBe(201);
    expect(replyResponse.body).toMatchObject({
      content: "Reply",
      parentCommentId: legacyComment.id,
      authorName: user.name,
    });

    const nestedResponse = createJsonResponse();
    await createComment!({
      user,
      params: { boardId: board.id, cardId: card.id },
      body: {
        content: "Nested reply",
        parentCommentId: (replyResponse.body as any).id,
      },
    }, nestedResponse);
    expect(nestedResponse.statusCode).toBe(400);

    const deleteComment = routeHandler("DELETE", "/api/kanban/boards/:boardId/cards/:cardId/comments/:commentId");
    const deleteResponse = createJsonResponse();
    await deleteComment!({
      user,
      params: {
        boardId: board.id,
        cardId: card.id,
        commentId: legacyComment.id,
      },
    }, deleteResponse);
    expect(deleteResponse.statusCode).toBe(200);

    const afterDeleteResponse = createJsonResponse();
    await listComments!({
      user,
      params: { boardId: board.id, cardId: card.id },
    }, afterDeleteResponse);
    expect(afterDeleteResponse.body).toEqual([
      expect.objectContaining({
        id: legacyComment.id,
        content: "",
        isDeleted: true,
      }),
      expect.objectContaining({
        content: "Reply",
        parentCommentId: legacyComment.id,
      }),
    ]);

    const listCards = routeHandler("GET", "/api/kanban/boards/:boardId/cards");
    const cardsResponse = createJsonResponse();
    await listCards!({ user, params: { boardId: board.id } }, cardsResponse);
    expect(cardsResponse.body).toEqual([
      expect.objectContaining({
        id: card.id,
        commentCount: 1,
      }),
    ]);
  });

  it("keeps project comment scopes isolated by company and preserves the stored author attribution", async () => {
    const owner = await createWorkspace("project-owner");
    const outsider = await createWorkspace("project-outsider");
    const project = await storage.createProject({
      companyId: owner.company.id,
      ownerId: owner.user.id,
      name: "Private project",
      status: "planning",
    } as any);

    const createProjectComment = routeHandler("POST", "/api/projects/:projectId/comments");
    const ownerResponse = createJsonResponse();
    await createProjectComment!({
      user: owner.user,
      params: { projectId: project.id },
      body: { content: "Decision" },
    }, ownerResponse);
    expect(ownerResponse.statusCode).toBe(201);

    await storage.updateUser(owner.user.id, {
      name: "Renamed user",
      active: false,
    } as any);

    const listProjectComments = routeHandler("GET", "/api/projects/:projectId/comments");
    const historicalResponse = createJsonResponse();
    await listProjectComments!({
      user: { ...owner.user, active: true },
      params: { projectId: project.id },
    }, historicalResponse);
    expect(historicalResponse.body).toEqual([
      expect.objectContaining({
        content: "Decision",
        authorName: owner.user.name,
      }),
    ]);

    const outsiderResponse = createJsonResponse();
    await listProjectComments!({
      user: outsider.user,
      params: { projectId: project.id },
    }, outsiderResponse);
    expect(outsiderResponse.statusCode).toBe(403);
  });
});
