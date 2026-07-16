import express from "express";
import type { AddressInfo } from "net";
import fetch from "node-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { registerRoutes } from "./routes";
import { storage } from "./database";

let server: Awaited<ReturnType<typeof registerRoutes>>;
let httpUrl = "";
let wsUrl = "";
const sockets = new Set<WebSocket>();
let sequence = 0;

async function createWorkspace(prefix: string) {
  const suffix = `${Date.now()}-${++sequence}`;
  const password = `password-${suffix}`;
  const user = await storage.createUser({
    username: `${prefix}-${suffix}`,
    password,
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
  return { user, company, password };
}

async function login(username: string, password: string) {
  const response = await fetch(`${httpUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

function waitForMessage(
  socket: WebSocket,
  predicate: (message: any) => boolean,
  timeoutMs = 3000,
) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket message"));
    }, timeoutMs);
    const onMessage = (raw: WebSocket.RawData) => {
      let message: any;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

async function connect(cookie: string) {
  const socket = new WebSocket(wsUrl, { headers: { Cookie: cookie } });
  sockets.add(socket);
  await waitForMessage(socket, (message) => message.type === "connected");
  return socket;
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  httpUrl = `http://127.0.0.1:${address.port}`;
  wsUrl = `ws://127.0.0.1:${address.port}/ws`;
});

afterAll(async () => {
  sockets.forEach((socket) => socket.terminate());
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("authenticated realtime discussion transport", () => {
  it("rejects a WebSocket upgrade without an authenticated session", async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      socket.on("unexpected-response", (_request, response) => {
        response.resume();
        resolve(response.statusCode || 0);
      });
      socket.on("open", () => reject(new Error("Unauthenticated socket unexpectedly opened")));
      socket.on("error", () => undefined);
    });

    expect(status).toBe(401);
  });

  it("isolates project subscriptions by company and delivers identifier-only events to authorized clients", async () => {
    const owner = await createWorkspace("realtime-owner");
    const outsider = await createWorkspace("realtime-outsider");
    const project = await storage.createProject({
      companyId: owner.company.id,
      ownerId: owner.user.id,
      name: "Realtime private project",
      status: "planning",
    } as any);
    const ownerCookie = await login(owner.user.username, owner.password);
    const outsiderCookie = await login(outsider.user.username, outsider.password);
    const ownerSocket = await connect(ownerCookie);
    const outsiderSocket = await connect(outsiderCookie);
    const channel = `project:${project.id}:comments`;

    const outsiderResultPromise = waitForMessage(
      outsiderSocket,
      (message) => message.type === "subscription_result",
    );
    outsiderSocket.send(JSON.stringify({ type: "subscribe", channels: [channel] }));
    await expect(outsiderResultPromise).resolves.toMatchObject({
      results: [{ channel, authorized: false }],
    });

    const ownerResultPromise = waitForMessage(
      ownerSocket,
      (message) => message.type === "subscription_result",
    );
    ownerSocket.send(JSON.stringify({ type: "subscribe", channels: [channel] }));
    await expect(ownerResultPromise).resolves.toMatchObject({
      results: [{ channel, authorized: true }],
    });

    const outsiderMutation = await fetch(`${httpUrl}/api/projects/${project.id}/comments`, {
      method: "POST",
      headers: {
        Cookie: outsiderCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ content: "Forbidden" }),
    });
    expect(outsiderMutation.status).toBe(403);

    const eventPromise = waitForMessage(
      ownerSocket,
      (message) => message.type === "discussion_event" && message.channel === channel,
    );
    const ownerMutation = await fetch(`${httpUrl}/api/projects/${project.id}/comments`, {
      method: "POST",
      headers: {
        Cookie: ownerCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ content: "Persisted over HTTP" }),
    });
    expect(ownerMutation.status).toBe(201);
    const createdComment = await ownerMutation.json() as any;
    const event = await eventPromise;

    expect(event).toMatchObject({
      type: "discussion_event",
      channel,
      action: "created",
      recordId: createdComment.id,
    });
    expect(event.eventId).toBeTruthy();
    expect(event.version).toBeTruthy();
    expect(event).not.toHaveProperty("content");
    expect(event).not.toHaveProperty("authorName");
  });
});
