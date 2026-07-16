import express from "express";
import { beforeAll, describe, expect, it } from "vitest";
import { registerRoutes } from "./routes";
import { storage } from "./database";

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

let app: express.Express;
let sequence = 0;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);
});

async function createCompanyWorkspace() {
  const suffix = `${Date.now()}-${++sequence}`;
  const owner = await storage.createUser({
    username: `topic-owner-${suffix}`,
    password: "test-password",
    name: `Topic Owner ${suffix}`,
    role: "employee",
    permissions: [],
    active: true,
  } as any);
  const member = await storage.createUser({
    username: `topic-member-${suffix}`,
    password: "test-password",
    name: `Topic Member ${suffix}`,
    role: "employee",
    permissions: [],
    active: true,
  } as any);
  const company = await storage.createCompany({
    name: `Topic Company ${suffix}`,
    ownerId: owner.id,
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId: owner.id,
    role: "owner",
    status: "active",
  } as any);
  await storage.createCompanyMember({
    companyId: company.id,
    userId: member.id,
    role: "member",
    status: "active",
  } as any);
  const location = await storage.createCustomLocation({
    companyId: company.id,
    name: `Topic Location ${suffix}`,
    type: "recording",
    notes: "Durable location notes stay separate",
    status: "available",
  } as any);
  return { company, owner, member, location };
}

describe("location threaded topics", () => {
  it("creates a linked topic and stores attributed messages with validated attachment metadata", async () => {
    const createTopic = routeHandler(app, "POST", "/api/location-issues");
    const addMessage = routeHandler(app, "POST", "/api/location-issues/:id/comments", "last");
    const { company, member, location } = await createCompanyWorkspace();
    const project = await storage.createProject({
      companyId: company.id,
      ownerId: member.id,
      name: `Topic Project ${Date.now()}-${++sequence}`,
      status: "active",
    } as any);
    await storage.setProjectLocations(project.id, [location.id]);
    const board = await storage.createKanbanBoard({
      companyId: company.id,
      projectId: project.id,
      name: `Topic Board ${Date.now()}-${++sequence}`,
      visibility: "company",
      createdByUserId: member.id,
    } as any);
    const list = await storage.createKanbanList({
      boardId: board.id,
      name: "Active",
      type: "active",
      position: 0,
    } as any);
    const card = await storage.createKanbanCard({
      boardId: board.id,
      projectId: project.id,
      listId: list.id,
      title: "Linked Kanban V2 card",
      priority: "medium",
      creatorUserId: member.id,
      position: 0,
    } as any);
    await storage.setKanbanCardLocations(card.id, [location.id]);

    const createResponse = createJsonResponse();
    await createTopic!({
      user: member,
      body: {
        locationId: location.id,
        type: "issue",
        title: "Power distribution",
        description: "Check the secondary circuit",
        severity: "high",
        projectId: project.id,
        kanbanCardId: card.id,
      },
    }, createResponse);

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body).toMatchObject({
      type: "issue",
      status: "active",
      severity: "high",
      authorName: member.name,
      project: { id: project.id, name: project.name },
      kanbanCard: { id: card.id, title: card.title },
    });
    const topicId = (createResponse.body as any).id;

    const messageResponse = createJsonResponse();
    await addMessage!({
      user: member,
      params: { id: topicId },
      body: { content: "Photo and specification attached" },
      files: [{
        originalname: "venue-specification.pdf",
        filename: "venue-specification-test.pdf",
        mimetype: "application/pdf",
        size: 2048,
      }],
    }, messageResponse);

    expect(messageResponse.statusCode).toBe(201);
    expect(messageResponse.body).toMatchObject({
      authorName: member.name,
      content: "Photo and specification attached",
      attachments: [{
        fileName: "venue-specification.pdf",
        mimeType: "application/pdf",
        uploadedByUserId: member.id,
      }],
    });
    const rejectedFileResponse = createJsonResponse();
    await addMessage!({
      user: member,
      params: { id: topicId },
      body: { content: "Unsupported executable" },
      files: [],
      locationAttachmentRejected: true,
    }, rejectedFileResponse);
    expect(rejectedFileResponse.statusCode).toBe(400);
    expect(await storage.getLocationIssueComments(topicId)).toHaveLength(1);
    expect((await storage.getCustomLocationById(location.id))?.notes).toBe("Durable location notes stay separate");
  });

  it("allows company managers to resolve, reopen and archive while preserving history", async () => {
    const createTopic = routeHandler(app, "POST", "/api/location-issues");
    const updateTopic = routeHandler(app, "PUT", "/api/location-issues/:id");
    const addMessage = routeHandler(app, "POST", "/api/location-issues/:id/comments", "last");
    const { owner, member, location } = await createCompanyWorkspace();

    const createResponse = createJsonResponse();
    await createTopic!({
      user: member,
      body: {
        locationId: location.id,
        type: "note",
        title: "Load-in details",
        description: "Use the service entrance",
      },
    }, createResponse);
    const topicId = (createResponse.body as any).id;
    expect(createResponse.body).toMatchObject({ type: "note", severity: null, status: "active" });

    const forbiddenResponse = createJsonResponse();
    await updateTopic!({
      user: member,
      params: { id: topicId },
      body: { status: "resolved" },
    }, forbiddenResponse);
    expect(forbiddenResponse.statusCode).toBe(403);

    const resolvedResponse = createJsonResponse();
    await updateTopic!({
      user: owner,
      params: { id: topicId },
      body: { status: "resolved" },
    }, resolvedResponse);
    expect(resolvedResponse.body).toMatchObject({ status: "resolved", resolvedByUserId: owner.id });

    const reopenedResponse = createJsonResponse();
    await updateTopic!({
      user: owner,
      params: { id: topicId },
      body: { status: "active" },
    }, reopenedResponse);
    expect(reopenedResponse.body).toMatchObject({
      status: "active",
      resolvedAt: null,
      resolvedByUserId: null,
    });

    const archivedResponse = createJsonResponse();
    await updateTopic!({
      user: owner,
      params: { id: topicId },
      body: { status: "archived" },
    }, archivedResponse);
    expect(archivedResponse.body).toMatchObject({ status: "archived", archivedByUserId: owner.id });

    const replyResponse = createJsonResponse();
    await addMessage!({
      user: member,
      params: { id: topicId },
      body: { content: "Late reply" },
      files: [],
    }, replyResponse);
    expect(replyResponse.statusCode).toBe(409);
    expect(await storage.getLocationIssueById(topicId)).toBeDefined();
  });

  it("keeps topics isolated by company and rejects links to foreign work", async () => {
    const createTopic = routeHandler(app, "POST", "/api/location-issues");
    const listTopics = routeHandler(app, "GET", "/api/location-issues");
    const own = await createCompanyWorkspace();
    const foreign = await createCompanyWorkspace();
    const foreignProject = await storage.createProject({
      companyId: foreign.company.id,
      ownerId: foreign.owner.id,
      name: `Foreign Topic Project ${Date.now()}-${++sequence}`,
      status: "active",
    } as any);
    await storage.setProjectLocations(foreignProject.id, [foreign.location.id]);

    const ownCreateResponse = createJsonResponse();
    await createTopic!({
      user: own.member,
      body: {
        locationId: own.location.id,
        type: "issue",
        title: "Own topic",
        description: "Visible inside the company",
        severity: "medium",
      },
    }, ownCreateResponse);
    expect(ownCreateResponse.statusCode).toBe(201);

    const foreignLinkResponse = createJsonResponse();
    await createTopic!({
      user: own.member,
      body: {
        locationId: own.location.id,
        type: "issue",
        title: "Invalid foreign link",
        description: "Must be rejected",
        severity: "medium",
        projectId: foreignProject.id,
      },
    }, foreignLinkResponse);
    expect(foreignLinkResponse.statusCode).toBe(403);

    const listResponse = createJsonResponse();
    await listTopics!({ user: foreign.member, query: {} }, listResponse);
    expect(listResponse.statusCode).toBe(200);
    expect((listResponse.body as any[]).map((topic) => topic.id)).not.toContain((ownCreateResponse.body as any).id);
  });
});
