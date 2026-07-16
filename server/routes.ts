import express, { type Express } from "express";
import { createServer as createHttpServer, ServerResponse, type Server } from "http";
import { createServer as createHttpsServer } from "https";
import fsSync from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { storage, isStubStorage } from "./database";
import {
  insertUserSchema,
  insertEventSchema,
  insertEventParticipantSchema,
  insertEquipmentSchema,
  insertSystemSchema,
  insertStreamSchema,
  insertNotificationSchema,
  insertEquipmentReservationSchema,
  insertEquipmentCheckoutRequestSchema,
  insertTelegramUserSchema,
  insertObsConnectionSchema,
  insertAnalyticsEventSchema,
  insertTaskSchema,
  insertTaskCommentSchema,
  insertTaskHistorySchema,
  insertRoleSchema,
  insertKanbanCardAttachmentSchema,
  insertKanbanLabelSchema,
  insertEquipmentCommentSchema,
  insertLocationIssueSchema,
  insertLocationIssueCommentSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import net from "net";
import crypto from "crypto";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { telegramBot } from "./services/telegram-bot";
import { hashPassword, verifyPassword, isPasswordHashed } from "./auth";
import { getTerminalLogs } from "./terminal-log";
import { getTerminalAllowedRoles, setTerminalAllowedRoles, canViewTerminal } from "./terminal-access";
import {
  createDiscussionRealtimeEvent,
  normalizeRealtimeChannels,
  parseRealtimeChannel,
  type DiscussionRealtimeEvent,
} from "./realtime";

/** Парсит заголовок x-user: поддерживает JSON и Base64 (для кириллицы в имени). */
function parseUserHeader(header: string | undefined): Record<string, unknown> {
  if (!header || typeof header !== "string") return {};
  try {
    const raw = header.trim();
    if (raw.startsWith("{")) return JSON.parse(raw) as Record<string, unknown>;
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    return (decoded ? JSON.parse(decoded) : {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}
import { telegramGateway } from "./services/telegram-gateway";

function isHttpsRequest(req: any): boolean {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const forwardedSsl = String(req.headers["x-forwarded-ssl"] || "").toLowerCase();
  const urlScheme = String(req.headers["x-url-scheme"] || "").toLowerCase();
  const cfVisitor = String(req.headers["cf-visitor"] || "").toLowerCase();
  const origin = String(req.headers.origin || "").toLowerCase();
  const referer = String(req.headers.referer || "").toLowerCase();

  return Boolean(
    req.secure ||
    forwardedProto === "https" ||
    forwardedSsl === "on" ||
    urlScheme === "https" ||
    cfVisitor.includes('"scheme":"https"') ||
    origin.startsWith("https://") ||
    referer.startsWith("https://")
  );
}

// Configure multer for equipment photo uploads (images only)
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating upload directory:", error);
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Separate multer instance for transcription uploads - allow any file type
const transcriptionUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const podcast = (req.body.podcast || "").toString().trim();
      const relativePath = (req.body.path || "").toString().trim(); // optional nested folder inside podcast

      if (!podcast) {
        return cb(new Error("Podcast is required"), "");
      }

      const safePodcast = podcast.replace(/[^\p{L}0-9_\- ]/gu, "_");
      const safeRelativePath = relativePath.replace(/(\.\.[/\\])/g, "").replace(/[^\p{L}0-9_\-/\\ ]/gu, "_");

      const baseDir = path.join(process.cwd(), "uploads", "transcriptions");
      const targetDir = safeRelativePath
        ? path.join(baseDir, safePodcast, safeRelativePath)
        : path.join(baseDir, safePodcast);

      try {
        await fs.mkdir(targetDir, { recursive: true });
      } catch (error) {
        console.error("Error creating transcription directory:", error);
      }

      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const originalName = file.originalname || "file";
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext).replace(/[^\p{L}0-9_\- ]/gu, "_");
      cb(null, base + "-" + uniqueSuffix + ext);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB для документов/аудио
  },
});

// Multer для загрузки файлов в чаты - любые типы файлов, без ограничений
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads", "chat");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating chat upload directory:", error);
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const originalName = file.originalname || "file";
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext).replace(/[^\p{L}0-9_\- ]/gu, "_");
      cb(null, base + "-" + uniqueSuffix + ext);
    },
  }),
  // Без ограничений по размеру и типу файлов
});

const estimateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Multer для фото участников продакшн (продакшн / шоу)
const productionPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads", "production");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating production upload directory:", error);
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, "photo-" + uniqueSuffix + path.extname(file.originalname || ".jpg"));
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Multer для аватара пользователя
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads", "avatars");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating avatars directory:", error);
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const userId = (req as any).params?.id || "user";
      const ext = (path.extname(file.originalname || "") || ".jpg").toLowerCase();
      cb(null, userId + "-" + Date.now() + ext);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

const kanbanAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads", "kanban");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating kanban upload directory:", error);
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const originalName = file.originalname || "file";
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext).replace(/[^\p{L}0-9_\- ]/gu, "_");
      cb(null, base + "-" + uniqueSuffix + ext);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const locationAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads", "locations");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating location upload directory:", error);
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const originalName = file.originalname || "file";
      const ext = path.extname(originalName).toLowerCase();
      const base = path.basename(originalName, ext).replace(/[^\p{L}0-9_\- ]/gu, "_");
      cb(null, `${base || "location-file"}-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
    ]);
    const accepted = allowedMimeTypes.has(file.mimetype);
    if (!accepted) (req as any).locationAttachmentRejected = true;
    cb(null, accepted);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const locationTopicMessageUpload = (req: any, res: any, next: any) => {
  locationAttachmentUpload.array("files", 5)(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? "Размер каждого файла не должен превышать 10 МБ"
      : "Не удалось проверить вложения темы";
    return res.status(400).json({ message });
  });
};

const equipmentCommentAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads", "equipment-comments");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating equipment comment upload directory:", error);
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const originalName = file.originalname || "file";
      const ext = path.extname(originalName).toLowerCase();
      const base = path.basename(originalName, ext).replace(/[^\p{L}0-9_\- ]/gu, "_");
      cb(null, `${base || "equipment-file"}-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
    ]);
    const accepted = allowedMimeTypes.has(file.mimetype);
    if (!accepted) (req as any).equipmentCommentAttachmentRejected = true;
    cb(null, accepted);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const equipmentCommentMessageUpload = (req: any, res: any, next: any) => {
  equipmentCommentAttachmentUpload.array("files", 5)(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? "Размер каждого файла не должен превышать 10 МБ"
      : "Не удалось проверить вложения комментария";
    return res.status(400).json({ message });
  });
};

// Helper function to check IP connectivity
async function checkIP(ip: string, port: number = 80): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, ip);
  });
}

// Обертка для быстрой обработки ошибок БД с таймаутом
async function withDbTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 3000, // 3 секунды по умолчанию для GET запросов (быстро!)
  defaultValue: T
): Promise<T> {
  const startTime = Date.now();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Убеждаемся, что timeoutMs положительное число
    const safeTimeout = Math.max(1, Math.floor(timeoutMs));

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Database operation timeout'));
      }, safeTimeout);
    });

    const result = await Promise.race([operation(), timeoutPromise]);

    // Очищаем таймаут если операция завершилась успешно
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const duration = Math.max(0, Date.now() - startTime); // Убеждаемся, что duration не отрицательное
    if (duration > 1000) {
      console.warn(`[DB] Slow query: ${duration}ms`);
    }
    return result;
  } catch (error: any) {
    // Очищаем таймаут при ошибке
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const duration = Math.max(0, Date.now() - startTime); // Убеждаемся, что duration не отрицательное
    const errorMsg = error.message?.toLowerCase() || '';

    // Логируем только важные ошибки, не таймауты
    if (errorMsg.includes('timeout')) {
      // Таймаут - это нормально, просто возвращаем дефолт
      return defaultValue;
    } else if (errorMsg.includes('econnrefused') || errorMsg.includes('connect')) {
      // Ошибка подключения - возвращаем дефолт быстро
      return defaultValue;
    }

    // Возвращаем значение по умолчанию (пустой массив для списков)
    return defaultValue;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  type RealtimeClientContext = {
    user: any;
    workspace: WorkspaceContext;
    subscriptions: Set<string>;
    isAlive: boolean;
  };

  const realtimeClients = new Map<WebSocket, RealtimeClientContext>();
  const publishDiscussionEvent = (event: DiscussionRealtimeEvent) => {
    for (const [socket, context] of realtimeClients) {
      if (socket.readyState !== WebSocket.OPEN || !context.subscriptions.has(event.channel)) continue;
      try {
        socket.send(JSON.stringify(event));
      } catch (error) {
        console.warn("[WebSocket] Failed to publish discussion event:", error);
      }
    }
  };

  // За прокси (nginx, cloud) — доверяем X-Forwarded-Proto для определения HTTPS
  app.set("trust proxy", 1);

  // Заголовки безопасности (XSS, clickjacking, MIME sniffing и т.д.)
  app.use(helmet({ contentSecurityPolicy: false })); // CSP можно включить после настройки под фронт

  // HSTS: в production при HTTPS браузер всегда ходит по HTTPS (защита от перехвата логина/пароля)
  app.use((req, res, next) => {
    const isSecure = isHttpsRequest(req);
    if (isSecure && process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });

  // В production логин/пароль принимаем только по HTTPS (иначе их видно в Wireshark и т.п.)
  app.use("/api/auth/login", (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const isSecure = isHttpsRequest(req);
    if (!isSecure) {
      return res.status(403).json({
        message: "Вход по паролю разрешён только по HTTPS. Используйте https:// в адресе сайта.",
      });
    }
    next();
  });

  // Лимит попыток входа (защита от перебора паролей)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Слишком много попыток входа. Попробуйте через 15 минут." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Сессии: только сервер знает, кто вошёл; клиент не может подделать пользователя
  const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-secret-change-me");
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.warn("[Security] В production задайте SESSION_SECRET в .env");
  }
  const sessionMiddleware = session({
    secret: sessionSecret || "fallback-not-secure",
    resave: false,
    saveUninitialized: false,
    name: "streamdesk.sid",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? "auto" : false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
  app.use(sessionMiddleware);

  const fallbackAdminUser = () => ({
    id: "admin-fallback",
    username: process.env.ADMIN_USERNAME || "admin",
    name: "Администратор",
    email: null,
    phone: null,
    position: null,
    department: null,
    role: "admin",
    permissions: ["platform:admin", "admin:panel", "users:manage", "roles:manage", "tasks:view", "tasks:create", "tasks:edit", "tasks:delete", "tasks:assign", "equipment:view", "equipment:create", "equipment:edit", "equipment:delete", "equipment:reserve", "events:view", "events:create", "events:edit", "events:delete", "streams:view", "streams:manage", "systems:view", "systems:manage", "settings:manage"],
    telegramId: null,
    avatar: null,
    active: true,
    onboardingCompleted: true,
    workspaceMode: "platform_admin",
    activeWorkspaceType: null,
    activeCompanyId: null,
    lastLogin: null,
    createdAt: new Date(),
  });

  const resolveSessionUser = async (sessionUserId: unknown): Promise<any> => {
    const userId = String(sessionUserId || "").trim();
    if (!userId) return null;
    if (userId === "admin-fallback") return fallbackAdminUser();
    return await storage.getUser(userId).catch(() => null);
  };

  type WorkspaceContext = {
    type: "company" | "personal" | null;
    companyId: string | null;
    requiresSelection: boolean;
    source: "session" | "persisted" | "automatic" | "none";
  };

  const isPlatformAdminUser = (user: any) => {
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    return Boolean(user?.id && permissions.includes("platform:admin"));
  };

  const getSelectableCompanyIds = async (user: any) => {
    if (!user?.id) return [];
    if (isPlatformAdminUser(user)) {
      const allCompanies = await storage.getCompanies().catch(() => []);
      return (allCompanies as any[])
        .filter((company) => String(company.status || "active") === "active")
        .map((company) => String(company.id));
    }
    const memberships = await storage.getUserCompanyMemberships(user.id).catch(() => []);
    return (memberships as any[])
      .filter((membership) => membership.status === "active")
      .map((membership) => String(membership.companyId));
  };

  const resolveWorkspaceContext = async (
    user: any,
    sessionState?: { activeWorkspaceType?: unknown; activeCompanyId?: unknown },
  ): Promise<WorkspaceContext> => {
    if (!user?.id) {
      return { type: null, companyId: null, requiresSelection: false, source: "none" };
    }

    const selectableCompanyIds = await getSelectableCompanyIds(user);
    const selectableCompanyIdSet = new Set(selectableCompanyIds);
    const candidates = [
      {
        type: String(sessionState?.activeWorkspaceType || ""),
        companyId: String(sessionState?.activeCompanyId || ""),
        source: "session" as const,
      },
      {
        type: String(user.activeWorkspaceType || ""),
        companyId: String(user.activeCompanyId || ""),
        source: "persisted" as const,
      },
    ];

    for (const candidate of candidates) {
      if (candidate.type === "personal") {
        return { type: "personal", companyId: null, requiresSelection: false, source: candidate.source };
      }
      if (candidate.type === "company" && selectableCompanyIdSet.has(candidate.companyId)) {
        return {
          type: "company",
          companyId: candidate.companyId,
          requiresSelection: false,
          source: candidate.source,
        };
      }
    }

    if (selectableCompanyIds.length === 1) {
      return {
        type: "company",
        companyId: selectableCompanyIds[0],
        requiresSelection: false,
        source: "automatic",
      };
    }
    if (selectableCompanyIds.length === 0) {
      return { type: "personal", companyId: null, requiresSelection: false, source: "automatic" };
    }
    return { type: null, companyId: null, requiresSelection: true, source: "none" };
  };

  // Для /api заполняем req.user из сессии (не доверяем заголовок x-user для авторизации)
  app.use("/api", async (req, res, next) => {
    const sessionUser = await resolveSessionUser(req.session?.userId);
    req.workspace = await resolveWorkspaceContext(sessionUser, req.session);
    req.user = sessionUser
      ? {
          ...sessionUser,
          activeWorkspaceType: req.workspace.type,
          activeCompanyId: req.workspace.companyId,
        }
      : null;
    next();
  });

  // режим заглушки: фронт может показать баннер «данные не сохраняются»
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, stubMode: isStubStorage });
  });

  const workspaceSelectionSchema = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("company"),
      companyId: z.string().trim().min(1),
    }),
    z.object({
      type: z.literal("personal"),
      companyId: z.null().optional(),
    }),
  ]);

  const buildWorkspaceResponse = async (req: express.Request) => {
    const user = req.user as any;
    const workspace = await resolveWorkspaceContext(user, req.session);
    const selectableCompanyIds = await getSelectableCompanyIds(user);
    const memberships = user?.id
      ? await storage.getUserCompanyMemberships(user.id).catch(() => [])
      : [];
    const membershipByCompanyId = new Map(
      (memberships as any[]).map((membership) => [String(membership.companyId), membership]),
    );
    const companies = await Promise.all(selectableCompanyIds.map(async (companyId) => {
      const company = await storage.getCompanyById(companyId).catch(() => undefined);
      if (!company) return null;
      const membership = membershipByCompanyId.get(companyId) as any;
      return {
        id: company.id,
        name: company.name,
        status: company.status,
        role: membership?.role || (isPlatformAdminUser(user) ? "platform_admin" : null),
      };
    }));
    return {
      workspace,
      companies: companies.filter(Boolean),
      personal: {
        id: "personal",
        name: "Личное пространство",
        modules: ["kanban", "calendar", "projects"],
      },
      isPlatformAdmin: isPlatformAdminUser(user),
    };
  };

  app.get("/api/workspace-context", async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
    const response = await buildWorkspaceResponse(req);
    if (response.workspace.source === "automatic" && response.workspace.type) {
      req.session.activeWorkspaceType = response.workspace.type;
      req.session.activeCompanyId = response.workspace.companyId;
    }
    res.json(response);
  });

  app.post("/api/workspace-context", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const selection = workspaceSelectionSchema.parse(req.body || {});
      if (selection.type === "company") {
        const selectableCompanyIds = await getSelectableCompanyIds(user);
        if (!selectableCompanyIds.includes(selection.companyId)) {
          return res.status(403).json({ message: "Нет доступа к выбранной компании" });
        }
        req.session.activeWorkspaceType = "company";
        req.session.activeCompanyId = selection.companyId;
      } else {
        req.session.activeWorkspaceType = "personal";
        req.session.activeCompanyId = null;
      }

      if (String(user.id) !== "admin-fallback") {
        const updated = await storage.updateUser(user.id, {
          activeWorkspaceType: selection.type,
          activeCompanyId: selection.type === "company" ? selection.companyId : null,
        } as any).catch(() => undefined);
        if (updated) req.user = updated;
      }
      req.workspace = await resolveWorkspaceContext(req.user, req.session);
      res.json(await buildWorkspaceResponse(req));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Некорректное рабочее пространство" });
      }
      res.status(500).json({ message: "Не удалось переключить рабочее пространство" });
    }
  });

  const inviteOrigin = (req: any) => {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProto || (isHttpsRequest(req) ? "https" : req.protocol || "http");
    return `${protocol}://${req.get("host")}`;
  };

  const canManageCompany = async (user: any, companyId: string) => {
    if (!user?.id || !companyId) return false;
    if (isPlatformAdminUser(user)) return true;
    const membership = await storage.getCompanyMembershipByUser(companyId, user.id).catch(() => undefined);
    return Boolean(membership && membership.status === "active" && ["owner", "admin"].includes(membership.role));
  };

  const hasWorkspaceAccess = async (user: any) => {
    if (!user?.id) return false;
    const workspace = await resolveWorkspaceContext(user);
    return Boolean(workspace.type && !workspace.requiresSelection);
  };

  const getUserCompanyIds = async (user: any) => {
    return getSelectableCompanyIds(user);
  };

  const getActiveWorkspaceForUser = async (user: any) => {
    if (!user?.id) {
      return { type: null, companyId: null, requiresSelection: false, source: "none" } as WorkspaceContext;
    }
    return resolveWorkspaceContext(user);
  };

  const requireActiveWorkspace = async (req: express.Request, res: express.Response) => {
    if (!req.user?.id) {
      res.status(401).json({ message: "Требуется авторизация" });
      return null;
    }
    const workspace = req.workspace || await getActiveWorkspaceForUser(req.user);
    if (!workspace || workspace.requiresSelection || !workspace.type) {
      res.status(409).json({
        message: "Выберите компанию или личное пространство",
        code: "WORKSPACE_SELECTION_REQUIRED",
      });
      return null;
    }
    return workspace;
  };

  const requireActiveCompanyWorkspace = async (req: express.Request, res: express.Response) => {
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return null;
    if (workspace.type !== "company" || !workspace.companyId) {
      res.status(403).json({
        message: "Действие доступно только в рабочем пространстве компании",
        code: "COMPANY_WORKSPACE_REQUIRED",
      });
      return null;
    }
    return workspace;
  };

  const getWorkspaceVisibleUserIds = async (user: any, workspace: WorkspaceContext) => {
    const visibleIds = new Set<string>();
    if (!user?.id || !workspace.type) return visibleIds;
    visibleIds.add(String(user.id));

    if (workspace.type === "company" && workspace.companyId) {
      const members = await storage.getCompanyMembers(workspace.companyId).catch(() => []);
      for (const member of members as any[]) {
        if (member.status === "active" && member.userId) visibleIds.add(String(member.userId));
      }
      return visibleIds;
    }

    const [boardMemberships, allBoards, allProjects, allEvents] = await Promise.all([
      storage.getKanbanBoardMembershipsByUser(user.id).catch(() => []),
      storage.getKanbanBoards().catch(() => []),
      storage.getProjects().catch(() => []),
      storage.getEvents().catch(() => []),
    ]);
    const memberBoardIds = new Set((boardMemberships as any[]).map((member) => String(member.boardId)));
    const personalBoards = (allBoards as any[]).filter((board) =>
      !board.companyId &&
      (String(board.createdByUserId || "") === String(user.id) || memberBoardIds.has(String(board.id))),
    );
    for (const board of personalBoards) {
      const members = await storage.getKanbanBoardMembers(board.id).catch(() => []);
      for (const member of members as any[]) {
        if (member.userId) visibleIds.add(String(member.userId));
      }
      if (board.createdByUserId) visibleIds.add(String(board.createdByUserId));
    }

    for (const project of allProjects as any[]) {
      if (project.companyId) continue;
      const participants: string[] = Array.isArray(project.participants)
        ? project.participants.map(String)
        : [];
      const canSee = String(project.ownerId || "") === String(user.id) ||
        String(project.assignedTo || "") === String(user.id) ||
        participants.includes(String(user.id));
      if (!canSee) continue;
      if (project.ownerId) visibleIds.add(String(project.ownerId));
      if (project.assignedTo) visibleIds.add(String(project.assignedTo));
      participants.forEach((participantId) => visibleIds.add(participantId));
    }

    for (const event of allEvents as any[]) {
      if (event.companyId) continue;
      const participants = await storage.getEventParticipants(event.id).catch(() => []);
      const canSee = String(event.organizerId || "") === String(user.id) ||
        (participants as any[]).some((participant) => String(participant.userId) === String(user.id));
      if (!canSee) continue;
      if (event.organizerId) visibleIds.add(String(event.organizerId));
      for (const participant of participants as any[]) {
        if (participant.userId) visibleIds.add(String(participant.userId));
      }
    }
    return visibleIds;
  };

  const projectEquipmentBundles: Array<{
    projectId: string;
    equipmentIds: string[];
    sentAt: string;
    returnDate: string;
    assignedByUserId?: string;
    assignedByName: string;
  }> = [];

  type KitExtractionConfirmation = {
    confirmed?: boolean;
    override?: boolean;
    bundleName?: string;
    reason?: string;
    context?: string;
  };

  type EquipmentKitActionError = Error & {
    statusCode?: number;
    code?: string;
    details?: Record<string, unknown>;
  };

  const equipmentKitActionLocks = new Set<string>();

  const equipmentSpecs = (item: any): Record<string, any> =>
    item?.specifications && typeof item.specifications === "object" && !Array.isArray(item.specifications)
      ? { ...item.specifications }
      : {};

  const createEquipmentKitActionError = (
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ): EquipmentKitActionError => Object.assign(new Error(message), { statusCode, code, details });

  const sendEquipmentKitActionError = (res: any, error: unknown) => {
    const kitError = error as EquipmentKitActionError;
    if (!kitError?.code) return false;
    res.status(kitError.statusCode || 400).json({
      message: kitError.message,
      code: kitError.code,
      ...kitError.details,
    });
    return true;
  };

  const getEquipmentKitContext = async (item: any, visited = new Set<string>()): Promise<any> => {
    const specs = equipmentSpecs(item);
    const parentBundleId = String(specs.parentBundleId || "").trim();
    if (!parentBundleId) return null;
    const itemId = String(item.id || "").trim();
    if (visited.has(itemId)) {
      throw createEquipmentKitActionError(
        409,
        "KIT_NESTING_CYCLE",
        "Обнаружена циклическая вложенность комплектов. Исправьте состав перед продолжением.",
        { componentId: item.id, parentBundleId },
      );
    }
    visited.add(itemId);

    const bundle = await storage.getEquipmentById(parentBundleId).catch(() => undefined);
    if (!bundle) {
      const at = new Date().toISOString();
      const nextSpecs = { ...specs };
      const parentBundleName = String(nextSpecs.parentBundleName || "Удалённый комплект").trim();
      delete nextSpecs.parentBundleId;
      delete nextSpecs.parentBundleName;
      delete nextSpecs.parentBundleCreatedAt;
      nextSpecs.kitExtractionHistory = [
        ...(Array.isArray(nextSpecs.kitExtractionHistory) ? nextSpecs.kitExtractionHistory : []),
        {
          id: crypto.randomUUID(),
          componentId: item.id,
          componentName: item.name,
          parentBundleId,
          parentBundleName,
          actorUserId: null,
          actorName: null,
          at,
          reason: "Родительский комплект был удалён",
          context: "orphaned-kit-membership-recovery",
          managerOverride: false,
          projectId: null,
        },
      ].slice(-100);

      const occupiedByMissingBundle = item.status === "in-use" &&
        !String(item.assignedTo || "").trim() &&
        String(item.location || "").trim().toLowerCase().startsWith("в составе");
      const recovered = await storage.updateEquipment(item.id, {
        status: occupiedByMissingBundle ? "available" : item.status,
        assignedTo: occupiedByMissingBundle ? null : item.assignedTo,
        location: occupiedByMissingBundle ? item.storageLocation || "Склад" : item.location,
        specifications: nextSpecs,
      } as any);
      if (!recovered) {
        throw createEquipmentKitActionError(
          409,
          "KIT_ORPHAN_RECOVERY_FAILED",
          "Не удалось восстановить позицию после удаления родительского комплекта.",
          { componentId: item.id, parentBundleId },
        );
      }
      return null;
    }

    const projectLink = projectEquipmentBundles.find((entry) =>
      entry.equipmentIds.includes(bundle.id) || entry.equipmentIds.includes(item.id),
    );
    const bundleParentId = String(equipmentSpecs(bundle).parentBundleId || "").trim();
    const parentKitContext = bundleParentId ? await getEquipmentKitContext(bundle, visited) : null;
    const isInUse = Boolean(projectLink) || (bundleParentId
      ? Boolean(parentKitContext?.isInUse)
      : bundle.status === "in-use");
    return { specs, parentBundleId, bundle, projectLink, isInUse };
  };

  const restoreEquipmentSnapshots = async (snapshots: any[]) => {
    for (const snapshot of [...snapshots].reverse()) {
      await storage.updateEquipment(snapshot.id, {
        status: snapshot.status,
        assignedTo: snapshot.assignedTo,
        location: snapshot.location,
        specifications: snapshot.specifications,
      } as any);
    }
  };

  const disassembleEquipmentBundle = async (bundle: any, user: any, context: string) => {
    const bundleSpecs = equipmentSpecs(bundle);
    const listedIds = [
      ...(Array.isArray(bundleSpecs.bundleComponentIds) ? bundleSpecs.bundleComponentIds : []),
      ...(Array.isArray(bundleSpecs.bundleComponents)
        ? bundleSpecs.bundleComponents.map((entry: any) => entry?.id)
        : []),
    ].map((id) => String(id || "").trim()).filter(Boolean);
    const allEquipment = await storage.getEquipment().catch(() => []);
    const linkedIds = (allEquipment as any[])
      .filter((candidate) => String(equipmentSpecs(candidate).parentBundleId || "").trim() === String(bundle.id))
      .map((candidate) => String(candidate.id));
    const componentIds = [...new Set([...listedIds, ...linkedIds])];
    const snapshots: any[] = [];
    const releasedComponentIds: string[] = [];

    try {
      for (const componentId of componentIds) {
        const component = await storage.getEquipmentById(componentId).catch(() => undefined);
        if (!component) continue;
        const componentSpecs = equipmentSpecs(component);
        if (String(componentSpecs.parentBundleId || "").trim() !== String(bundle.id)) continue;

        snapshots.push({ ...component, specifications: componentSpecs });
        const nextSpecs = { ...componentSpecs };
        delete nextSpecs.parentBundleId;
        delete nextSpecs.parentBundleName;
        delete nextSpecs.parentBundleCreatedAt;
        nextSpecs.kitExtractionHistory = [
          ...(Array.isArray(nextSpecs.kitExtractionHistory) ? nextSpecs.kitExtractionHistory : []),
          {
            id: crypto.randomUUID(),
            componentId: component.id,
            componentName: component.name,
            parentBundleId: bundle.id,
            parentBundleName: bundle.name,
            actorUserId: user?.id || null,
            actorName: user?.name || user?.username || null,
            at: new Date().toISOString(),
            reason: "Комплект удалён и расформирован",
            context,
            managerOverride: false,
            projectId: null,
          },
        ].slice(-100);

        const occupiedByBundle = component.status === "in-use" &&
          !String(component.assignedTo || "").trim() &&
          String(component.location || "").trim().toLowerCase().startsWith("в составе");
        const updated = await storage.updateEquipment(component.id, {
          status: occupiedByBundle ? "available" : component.status,
          assignedTo: occupiedByBundle ? null : component.assignedTo,
          location: occupiedByBundle
            ? component.storageLocation || bundle.storageLocation || bundle.location || "Склад"
            : component.location,
          specifications: nextSpecs,
        } as any);
        if (!updated) throw new Error(`Не удалось расформировать компонент «${component.name}»`);
        releasedComponentIds.push(component.id);
      }
      return { snapshots, releasedComponentIds };
    } catch (error) {
      await restoreEquipmentSnapshots(snapshots);
      throw error;
    }
  };

  const ensureEquipmentReturnAllowed = async (user: any, item: any) => {
    const kit = await getEquipmentKitContext(item);
    if (!kit) return;

    await ensureEquipmentCompanyAccess(user, item, kit.bundle);
    const bundleName = String(kit.bundle.name || kit.specs.parentBundleName || "Комплект").trim();
    throw createEquipmentKitActionError(
      409,
      "KIT_RETURN_VIA_PARENT_REQUIRED",
      `Компонент входит в комплект «${bundleName}». Верните весь комплект или сначала извлеките компонент.`,
      {
        componentId: item.id,
        componentName: item.name,
        parentBundleId: kit.bundle.id,
        parentBundleName: bundleName,
        kitInUse: kit.isInUse,
        projectId: kit.projectLink?.projectId || null,
      },
    );
  };

  const canOverrideActiveKit = async (user: any, bundle: any) => {
    if (user?.role === "admin" || user?.role === "manager") return true;
    const companyId = String(equipmentSpecs(bundle).companyId || "").trim();
    return companyId ? canManageCompany(user, companyId) : false;
  };

  const canManageEquipmentKit = async (user: any, bundle: any) => {
    if (["admin", "manager", "tech_director"].includes(String(user?.role || ""))) return true;
    if (user?.workspaceMode === "company_owner") return true;
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    if (permissions.includes("equipment:edit")) return true;
    const companyId = String(equipmentSpecs(bundle).companyId || "").trim();
    return companyId ? canManageCompany(user, companyId) : false;
  };

  const isEquipmentKit = (item: any) => {
    const specs = equipmentSpecs(item);
    return specs.isSuperPosition === true || specs.bundleType === "super_position";
  };

  const getEquipmentKitComponentIds = (item: any) => {
    const specs = equipmentSpecs(item);
    return [...new Set([
      ...(Array.isArray(specs.bundleComponentIds) ? specs.bundleComponentIds : []),
      ...(Array.isArray(specs.bundleComponents)
        ? specs.bundleComponents.map((entry: any) => entry?.id)
        : []),
    ].map((id) => String(id || "").trim()).filter(Boolean))];
  };

  const equipmentKitContains = async (rootEquipmentId: string, targetEquipmentId: string, visited = new Set<string>()): Promise<boolean> => {
    if (rootEquipmentId === targetEquipmentId) return true;
    if (visited.has(rootEquipmentId)) return false;
    visited.add(rootEquipmentId);
    const root = await storage.getEquipmentById(rootEquipmentId).catch(() => undefined);
    if (!root || !isEquipmentKit(root)) return false;
    const componentIds = getEquipmentKitComponentIds(root);
    if (componentIds.includes(targetEquipmentId)) return true;
    for (const componentId of componentIds) {
      if (await equipmentKitContains(componentId, targetEquipmentId, visited)) return true;
    }
    return false;
  };

  const ensureEquipmentCompanyAccess = async (user: any, item: any, bundle?: any) => {
    const workspace = await getActiveWorkspaceForUser(user);
    if (workspace.type !== "company" || !workspace.companyId) {
      throw createEquipmentKitActionError(
        403,
        "COMPANY_WORKSPACE_REQUIRED",
        "Склад доступен только в рабочем пространстве компании.",
      );
    }
    const itemCompanyId = String(equipmentSpecs(item).companyId || "").trim();
    const bundleCompanyId = String(equipmentSpecs(bundle).companyId || "").trim();
    const requiredCompanyIds = [itemCompanyId, bundleCompanyId].filter(Boolean);
    if (
      !itemCompanyId ||
      requiredCompanyIds.some((companyId) => companyId !== String(workspace.companyId))
    ) {
      throw createEquipmentKitActionError(
        403,
        "KIT_COMPANY_ACCESS_DENIED",
        "Оборудование принадлежит другой компании или не имеет однозначной компании.",
      );
    }
  };

  const restoreEquipmentKitSnapshots = async (componentSnapshot: any, bundleSnapshot: any) => {
    await storage.updateEquipment(bundleSnapshot.id, {
      status: bundleSnapshot.status,
      assignedTo: bundleSnapshot.assignedTo,
      location: bundleSnapshot.location,
      specifications: bundleSnapshot.specifications,
    } as any);
    await storage.updateEquipment(componentSnapshot.id, {
      status: componentSnapshot.status,
      assignedTo: componentSnapshot.assignedTo,
      location: componentSnapshot.location,
      specifications: componentSnapshot.specifications,
    } as any);
  };

  const runEquipmentActionWithKitSafety = async <T>({
    componentId,
    user,
    confirmation,
    actionContext,
    action,
  }: {
    componentId: string;
    user: any;
    confirmation?: KitExtractionConfirmation;
    actionContext: string;
    action: (freshItem: any) => Promise<T>;
  }): Promise<T> => {
    if (equipmentKitActionLocks.has(componentId)) {
      throw createEquipmentKitActionError(
        409,
        "KIT_COMPONENT_BUSY",
        "Этот компонент уже обрабатывается. Обновите склад и повторите действие.",
        { componentId },
      );
    }

    equipmentKitActionLocks.add(componentId);
    let componentSnapshot: any;
    let bundleSnapshot: any;
    let extractionApplied = false;

    try {
      const item = await storage.getEquipmentById(componentId).catch(() => undefined);
      if (!item || item.status === "archived") {
        throw createEquipmentKitActionError(404, "EQUIPMENT_NOT_FOUND", "Оборудование не найдено.");
      }

      const kit = await getEquipmentKitContext(item);
      if (!kit) {
        const freshItem = await storage.getEquipmentById(componentId).catch(() => undefined);
        return await action(freshItem || item);
      }
      await ensureEquipmentCompanyAccess(user, item, kit.bundle);

      const bundleName = String(kit.bundle.name || kit.specs.parentBundleName || "Комплект").trim();
      const commonDetails = {
        componentId: item.id,
        componentName: item.name,
        parentBundleId: kit.bundle.id,
        parentBundleName: bundleName,
        kitInUse: kit.isInUse,
        projectId: kit.projectLink?.projectId || null,
        canEscalate: kit.isInUse,
      };

      if (kit.isInUse && !(await canOverrideActiveKit(user, kit.bundle))) {
        throw createEquipmentKitActionError(
          403,
          "KIT_COMPONENT_REQUIRES_MANAGER",
          `Компонент входит в активный комплект «${bundleName}». Отправьте запрос менеджеру на извлечение.`,
          commonDetails,
        );
      }

      if (!confirmation?.confirmed) {
        throw createEquipmentKitActionError(
          409,
          "KIT_EXTRACTION_CONFIRMATION_REQUIRED",
          `Сначала подтвердите извлечение компонента из комплекта «${bundleName}».`,
          commonDetails,
        );
      }

      if (String(confirmation.bundleName || "").trim() !== bundleName) {
        throw createEquipmentKitActionError(
          409,
          "KIT_EXTRACTION_CONFIRMATION_STALE",
          "Состав или название комплекта изменились. Обновите склад и подтвердите действие заново.",
          commonDetails,
        );
      }

      if (kit.isInUse && confirmation.override !== true) {
        throw createEquipmentKitActionError(
          409,
          "KIT_OVERRIDE_CONFIRMATION_REQUIRED",
          `Для активного комплекта «${bundleName}» требуется усиленное подтверждение менеджера.`,
          commonDetails,
        );
      }

      componentSnapshot = { ...item, specifications: equipmentSpecs(item) };
      bundleSnapshot = { ...kit.bundle, specifications: equipmentSpecs(kit.bundle) };

      const at = new Date().toISOString();
      const audit = {
        id: crypto.randomUUID(),
        action: "removed",
        componentId: item.id,
        componentName: item.name,
        parentBundleId: kit.bundle.id,
        parentBundleName: bundleName,
        actorUserId: user?.id || null,
        actorName: user?.name || user?.username || null,
        at,
        reason: String(confirmation.reason || "").trim() || actionContext,
        context: String(confirmation.context || "").trim() || actionContext,
        managerOverride: kit.isInUse,
        projectId: kit.projectLink?.projectId || null,
      };

      const nextBundleSpecs = equipmentSpecs(kit.bundle);
      nextBundleSpecs.bundleComponentIds = (Array.isArray(nextBundleSpecs.bundleComponentIds)
        ? nextBundleSpecs.bundleComponentIds
        : []).filter((id: unknown) => String(id) !== String(item.id));
      nextBundleSpecs.bundleComponents = (Array.isArray(nextBundleSpecs.bundleComponents)
        ? nextBundleSpecs.bundleComponents
        : []).filter((entry: any) => String(entry?.id || "") !== String(item.id));
      nextBundleSpecs.bundleExtractionHistory = [
        ...(Array.isArray(nextBundleSpecs.bundleExtractionHistory) ? nextBundleSpecs.bundleExtractionHistory : []),
        audit,
      ].slice(-100);

      const nextComponentSpecs = equipmentSpecs(item);
      delete nextComponentSpecs.parentBundleId;
      delete nextComponentSpecs.parentBundleName;
      delete nextComponentSpecs.parentBundleCreatedAt;
      nextComponentSpecs.kitExtractionHistory = [
        ...(Array.isArray(nextComponentSpecs.kitExtractionHistory) ? nextComponentSpecs.kitExtractionHistory : []),
        audit,
      ].slice(-100);

      const updatedBundle = await storage.updateEquipment(kit.bundle.id, { specifications: nextBundleSpecs } as any);
      if (!updatedBundle) throw new Error("Не удалось обновить состав комплекта");
      extractionApplied = true;
      const updatedComponent = await storage.updateEquipment(item.id, {
        status: "available",
        assignedTo: null,
        location: kit.bundle.storageLocation || kit.bundle.location || "Склад",
        specifications: nextComponentSpecs,
      } as any);
      if (!updatedComponent) throw new Error("Не удалось обновить компонент комплекта");

      return await action(updatedComponent);
    } catch (error) {
      if (extractionApplied && componentSnapshot && bundleSnapshot) {
        try {
          await restoreEquipmentKitSnapshots(componentSnapshot, bundleSnapshot);
        } catch (rollbackError) {
          console.error("[Equipment kits] Failed to roll back extraction:", rollbackError);
        }
      }
      throw error;
    } finally {
      equipmentKitActionLocks.delete(componentId);
    }
  };

  const kanbanBoardCreateSchema = z.object({
    companyId: z.string().trim().min(1).nullable().optional(),
    projectId: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(1, "Введите название доски").max(120, "Название слишком длинное"),
    description: z.string().trim().max(5000, "Описание слишком длинное").nullable().optional(),
    visibility: z.enum(["personal", "company", "members"]).default("personal"),
  });

  const kanbanBoardUpdateSchema = z.object({
    projectId: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(1, "Введите название доски").max(120, "Название слишком длинное").optional(),
    description: z.string().trim().max(5000, "Описание слишком длинное").nullable().optional(),
    visibility: z.enum(["personal", "company", "members"]).optional(),
    customFields: z.array(z.record(z.unknown())).optional(),
    labelGroups: z.array(z.record(z.unknown())).optional(),
  });
  const kanbanBoardMemberCreateSchema = z.object({
    userId: z.string().trim().min(1, "userId обязателен"),
    role: z.enum(["viewer", "editor"]).default("viewer"),
    canComment: z.boolean().optional().default(false),
  });
  const kanbanBoardMemberUpdateSchema = z.object({
    role: z.enum(["viewer", "editor"]).optional(),
    canComment: z.boolean().optional(),
  });

  const kanbanListCreateSchema = z.object({
    name: z.string().trim().min(1, "Введите название списка").max(120, "Название слишком длинное"),
    color: z.string().trim().max(50, "Цвет слишком длинный").nullable().optional(),
    type: z.enum(["active", "closed", "archive", "trash"]).default("active"),
  });

  const kanbanListUpdateSchema = z.object({
    name: z.string().trim().min(1, "Введите название списка").max(120, "Название слишком длинное").optional(),
    color: z.string().trim().max(50, "Цвет слишком длинный").nullable().optional(),
    type: z.enum(["active", "closed", "archive", "trash"]).optional(),
  });
  const kanbanListReorderSchema = z.object({
    listIds: z.array(z.string().trim().min(1)).min(1),
  });

  const kanbanCardCreateSchema = z.object({
    listId: z.string().trim().min(1, "listId обязателен"),
    title: z.string().trim().min(1, "Введите название карточки").max(160, "Название слишком длинное"),
    description: z.string().trim().max(5000, "Описание слишком длинное").nullable().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    startDate: z.string().trim().nullable().optional(),
    dueDate: z.string().trim().nullable().optional(),
    locationId: z.string().trim().min(1, "locationId не должен быть пустым").nullable().optional(),
    locationIds: z.array(z.string().trim().min(1)).max(20).optional(),
    assigneeUserId: z.string().trim().min(1, "assigneeUserId не должен быть пустым").nullable().optional(),
    labelIds: z.array(z.string().trim().min(1)).max(30).optional(),
    customFieldValues: z.record(z.unknown()).optional(),
    subtasks: z.array(z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1).max(240),
      completed: z.boolean().optional().default(false),
    })).max(100).optional(),
  });

  const kanbanCardUpdateSchema = z.object({
    listId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1, "Введите название карточки").max(160, "Название слишком длинное").optional(),
    description: z.string().trim().max(5000, "Описание слишком длинное").nullable().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    startDate: z.string().trim().nullable().optional(),
    dueDate: z.string().trim().nullable().optional(),
    locationId: z.string().trim().min(1, "locationId не должен быть пустым").nullable().optional(),
    locationIds: z.array(z.string().trim().min(1)).max(20).optional(),
    assigneeUserId: z.string().trim().min(1, "assigneeUserId не должен быть пустым").nullable().optional(),
    labelIds: z.array(z.string().trim().min(1)).max(30).optional(),
    customFieldValues: z.record(z.unknown()).optional(),
    subtasks: z.array(z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1).max(240),
      completed: z.boolean().optional().default(false),
    })).max(100).optional(),
  });
  const kanbanCardMoveSchema = z.object({
    listId: z.string().trim().min(1, "listId обязателен"),
    position: z.coerce.number().int().min(0),
  });
  const kanbanLabelPayloadSchema = z.object({
    name: z.string().trim().min(1, "Введите название метки").max(80, "Название слишком длинное"),
    color: z.string().trim().max(50, "Цвет слишком длинный").nullable().optional(),
    groupId: z.string().trim().min(1).nullable().optional(),
  });
  const kanbanCustomFieldTypeSchema = z.enum([
    "text",
    "number",
    "date",
    "checkbox",
    "select",
    "multi-select",
    "url",
    "email",
    "person",
  ]);
  const kanbanCustomFieldPayloadSchema = z.object({
    name: z.string().trim().min(1, "Введите название поля").max(80, "Название слишком длинное"),
    type: kanbanCustomFieldTypeSchema.default("text"),
    options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    required: z.boolean().optional().default(false),
    showOnCard: z.boolean().optional().default(true),
    showInList: z.boolean().optional().default(true),
  });
  const kanbanLabelGroupPayloadSchema = z.object({
    name: z.string().trim().min(1, "Введите название группы").max(80, "Название слишком длинное"),
    color: z.string().trim().max(50, "Цвет слишком длинный").nullable().optional(),
  });

  const asPlainArray = (value: unknown) => (Array.isArray(value) ? value : []);
  const normalizeKanbanCustomFields = (value: unknown) =>
    asPlainArray(value)
      .map((field: any, index) => ({
        id: String(field?.id || crypto.randomUUID()),
        name: String(field?.name || "").trim(),
        type: kanbanCustomFieldTypeSchema.safeParse(field?.type).success ? field.type : "text",
        options: Array.isArray(field?.options)
          ? Array.from(new Set(field.options.map((option: unknown) => String(option).trim()).filter(Boolean)))
          : [],
        required: Boolean(field?.required),
        showOnCard: field?.showOnCard !== false,
        showInList: field?.showInList !== false,
        position: Number.isFinite(Number(field?.position)) ? Number(field.position) : index,
        archivedAt: field?.archivedAt ?? null,
        createdAt: field?.createdAt ?? new Date().toISOString(),
        updatedAt: field?.updatedAt ?? new Date().toISOString(),
      }))
      .filter((field) => field.name)
      .sort((a, b) => Number(a.position) - Number(b.position));
  const normalizeKanbanLabelGroups = (value: unknown) =>
    asPlainArray(value)
      .map((group: any) => ({
        id: String(group?.id || crypto.randomUUID()),
        name: String(group?.name || "").trim(),
        color: group?.color ? String(group.color).trim() : null,
        archivedAt: group?.archivedAt ?? null,
        createdAt: group?.createdAt ?? new Date().toISOString(),
        updatedAt: group?.updatedAt ?? new Date().toISOString(),
      }))
      .filter((group) => group.name);

  const buildKanbanBoardResponse = (
    board: any,
    options: { canManage: boolean; membership?: any },
  ) => ({
    ...board,
    canManage: options.canManage,
    canEdit: options.canManage || options.membership?.role === "editor",
    canComment: options.canManage || options.membership?.role === "editor" || Boolean(options.membership?.canComment),
    isMember: Boolean(options.membership),
    membershipRole: options.membership?.role ?? null,
  });

  const getVisibleKanbanBoardsForUser = async (currentUser: any) => {
    const memberships = await storage.getKanbanBoardMembershipsByUser(currentUser.id).catch(() => []);
    const membershipMap = new Map((memberships as any[]).map((member) => [String(member.boardId), member]));
    const workspace = await getActiveWorkspaceForUser(currentUser);
    if (!workspace.type || workspace.requiresSelection) {
      return { boards: [], membershipMap };
    }

    const allBoards = await storage.getKanbanBoards().catch(() => []);
    const canManageActiveCompany = workspace.type === "company" && workspace.companyId
      ? await canManageCompany(currentUser, workspace.companyId).catch(() => false)
      : false;
    const visibleBoards = (allBoards as any[]).filter((board) => {
      if (workspace.type === "personal") {
        if (board.companyId) return false;
        return String(board.createdByUserId || "") === String(currentUser.id) ||
          membershipMap.has(String(board.id));
      }
      if (String(board.companyId || "") !== String(workspace.companyId || "")) return false;
      if (canManageActiveCompany || board.visibility !== "members") return true;
      return membershipMap.has(String(board.id));
    });

    return {
      boards: visibleBoards.map((board) =>
        buildKanbanBoardResponse(board, {
          canManage: !board.companyId
            ? String(board.createdByUserId) === String(currentUser.id)
            : canManageActiveCompany,
          membership: membershipMap.get(String(board.id)),
        }),
      ),
      membershipMap,
    };
  };

  const getKanbanBoardAccess = async (user: any, boardId: string) => {
    const board = await storage.getKanbanBoardById(boardId).catch(() => undefined);
    if (!board) return null;
    const workspace = await getActiveWorkspaceForUser(user);
    if (!workspace.type || workspace.requiresSelection) return null;
    if (
      (workspace.type === "personal" && board.companyId) ||
      (workspace.type === "company" && String(board.companyId || "") !== String(workspace.companyId || ""))
    ) {
      return null;
    }

    const membership = user?.id
      ? await storage.getKanbanBoardMember(board.id, user.id).catch(() => undefined)
      : undefined;
    const isPersonalBoard = !board.companyId;
    const isCreator = String(board.createdByUserId) === String(user?.id || "");
    const canManage = isPersonalBoard
      ? isCreator
      : await canManageCompany(user, String(board.companyId));

    if (canManage) {
      return { board, canManage: true, membership };
    }

    if (isPersonalBoard) {
      return membership ? { board, canManage: false, membership } : null;
    }
    const canView = board.visibility !== "members" || Boolean(membership);

    if (!canView) return null;

    return { board, canManage: false, membership };
  };

  const canEditKanbanBoard = (access: { canManage: boolean; membership?: any }) =>
    access.canManage || access.membership?.role === "editor";

  const canCommentKanbanBoard = (access: { canManage: boolean; membership?: any }) =>
    canEditKanbanBoard(access) || Boolean(access.membership?.canComment);

  const discussionCommentPayloadSchema = z.object({
    content: z.string().trim().min(1, "Комментарий не должен быть пустым").max(10_000),
    parentCommentId: z.string().trim().min(1).max(160).nullable().optional(),
  });

  const serializeDiscussionComments = async (
    comments: any[],
    currentUser: any,
    canManage: boolean,
  ) => {
    const users = await storage.getUsers().catch(() => []);
    const userById = new Map((users as any[]).map((user) => [String(user.id), user]));
    return comments.map((comment) => {
      const storedAuthorName = String(comment.authorName || "").trim();
      const currentAuthor = userById.get(String(comment.userId)) as any;
      const authorName = storedAuthorName || currentAuthor?.name || currentAuthor?.username || "Удалённый пользователь";
      const isDeleted = Boolean(comment.deletedAt);
      return {
        ...comment,
        authorName,
        content: isDeleted ? "" : comment.content,
        isDeleted,
        canDelete: !isDeleted && (
          canManage ||
          String(comment.userId || "") === String(currentUser?.id || "")
        ),
      };
    });
  };

  const findDiscussionRoot = (comments: any[], parentCommentId: unknown) => {
    const normalizedParentId = String(parentCommentId || "").trim();
    if (!normalizedParentId) return { ok: true as const, parentCommentId: null };
    const parent = comments.find((comment) => String(comment.id) === normalizedParentId);
    if (!parent || parent.deletedAt) {
      return { ok: false as const, message: "Исходный комментарий не найден" };
    }
    if (parent.parentCommentId) {
      return { ok: false as const, message: "Ответ можно добавить только к корневому комментарию" };
    }
    return { ok: true as const, parentCommentId: String(parent.id) };
  };

  const getProjectKanbanTeamUserIds = (project: any, currentUser?: any) => {
    const ids = new Set<string>();
    const add = (value: unknown) => {
      const normalized = String(value || "").trim();
      if (normalized) ids.add(normalized);
    };

    add(project?.ownerId);
    add(project?.assignedTo);
    add(currentUser?.id);
    if (Array.isArray(project?.participants)) {
      project.participants.forEach(add);
    }

    return Array.from(ids);
  };

  const canOpenProjectKanbanBoard = async (currentUser: any, project: any) => {
    if (!currentUser?.id) return false;
    const workspace = await getActiveWorkspaceForUser(currentUser);
    const companyId = String(project?.companyId || "").trim();
    if (workspace.type === "company") {
      return Boolean(companyId && companyId === String(workspace.companyId || ""));
    }
    return workspace.type === "personal" &&
      !companyId &&
      getProjectKanbanTeamUserIds(project).includes(String(currentUser.id));
  };

  const syncProjectKanbanBoardMembers = async (board: any, project: any, currentUser: any) => {
    const teamUserIds = getProjectKanbanTeamUserIds(project, currentUser);
    const syncedUserIds: string[] = [];

    for (const userId of teamUserIds) {
      if (board.companyId) {
        const companyMembership = await storage.getCompanyMembershipByUser(String(board.companyId), userId).catch(() => undefined);
        if (!companyMembership || companyMembership.status !== "active") continue;
      } else if (String(userId) !== String(board.createdByUserId)) {
        continue;
      }

      const user = await storage.getUser(userId).catch(() => undefined);
      if (user && user.active === false) continue;

      const existingMember = await storage.getKanbanBoardMember(board.id, userId).catch(() => undefined);
      if (existingMember) {
        const needsEditorRole = existingMember.role !== "editor";
        const needsComment = existingMember.canComment !== true;
        if (needsEditorRole || needsComment) {
          await storage.updateKanbanBoardMember(existingMember.id, {
            role: "editor",
            canComment: true,
          } as any).catch(() => undefined);
        }
      } else {
        await storage.createKanbanBoardMember({
          boardId: board.id,
          userId,
          role: "editor",
          canComment: true,
        });
      }
      syncedUserIds.push(userId);
    }

    return syncedUserIds;
  };

  const ensureDefaultProjectKanbanLists = async (boardId: string) => {
    const existingLists = await storage.getKanbanListsByBoardId(boardId).catch(() => []);
    if (existingLists.length > 0) return existingLists;

    const defaultLists = [
      { name: "Активные", type: "active", position: 0, color: "#8B5CF6" },
      { name: "В работе", type: "active", position: 1, color: "#3B82F6" },
      { name: "Готово", type: "closed", position: 2, color: "#10B981" },
    ];

    const createdLists = [];
    for (const list of defaultLists) {
      createdLists.push(await storage.createKanbanList({
        boardId,
        ...list,
      }));
    }
    return createdLists;
  };

  const projectKanbanBoardOperations = new Map<string, Promise<{
    board: any;
    created: boolean;
    project: any;
  }>>();

  const parseOptionalKanbanDate = (value: unknown): Date | null => {
    if (value == null) return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const normalizeKanbanSubtasks = (subtasks: Array<{ id: string; title: string; completed?: boolean }> | undefined) => {
    if (!Array.isArray(subtasks)) return [];
    return subtasks
      .map((subtask) => ({
        id: String(subtask.id || "").trim(),
        title: String(subtask.title || "").trim(),
        completed: Boolean(subtask.completed),
      }))
      .filter((subtask) => subtask.id && subtask.title);
  };

  const createKanbanCardHistoryEntry = async (
    userId: string,
    cardId: string,
    action: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) => {
    try {
      await storage.createKanbanCardHistory({
        cardId,
        userId,
        action,
        oldValue: oldValue == null ? null : oldValue,
        newValue: newValue == null ? null : newValue,
      });
    } catch (historyError) {
      console.warn("[Kanban] Failed to create card history entry:", historyError);
    }
  };

  const createKanbanNotifications = async (
    userIds: Array<string | null | undefined>,
    title: string,
    message: string,
  ) => {
    const uniqueUserIds = Array.from(
      new Set(userIds.map((userId) => String(userId || "").trim()).filter(Boolean)),
    );

    for (const userId of uniqueUserIds) {
      try {
        await storage.createNotification({
          userId,
          title,
          message,
          type: "info",
        });
      } catch (notifErr) {
        console.warn("[Kanban] Failed to create notification:", notifErr);
      }
    }
  };

  const resolveKanbanAssigneeUserId = async (board: any, actorUser: any, assigneeUserId: unknown) => {
    if (assigneeUserId == null) return { ok: true as const, userId: null };

    const normalized = String(assigneeUserId).trim();
    if (!normalized) return { ok: true as const, userId: null };

    const user = await storage.getUser(normalized).catch(() => undefined);
    if (!user || user.active === false) {
      return { ok: false as const, message: "Исполнитель не найден или деактивирован" };
    }

    if (!board.companyId) {
      if (String(normalized) !== String(actorUser?.id || "")) {
        return { ok: false as const, message: "В личной доске можно назначать задачи только себе" };
      }
      return { ok: true as const, userId: normalized };
    }

    const membership = await storage.getCompanyMembershipByUser(String(board.companyId), normalized).catch(() => undefined);
    if (!membership || membership.status !== "active") {
      return { ok: false as const, message: "Исполнитель должен быть активным участником компании доски" };
    }

    return { ok: true as const, userId: normalized };
  };

  const resolveKanbanLabelIds = async (boardId: string, labelIds: unknown) => {
    if (labelIds == null) return { ok: true as const, labelIds: [] as string[] };
    if (!Array.isArray(labelIds)) {
      return { ok: false as const, message: "Метки должны передаваться массивом" };
    }

    const uniqueLabelIds = Array.from(new Set(labelIds.map((value) => String(value || "").trim()).filter(Boolean)));
    if (!uniqueLabelIds.length) return { ok: true as const, labelIds: [] as string[] };

    const boardLabels = await storage.getKanbanLabelsByBoardId(boardId).catch(() => []);
    const allowedLabelIds = new Set((boardLabels as any[]).map((label) => String(label.id)));
    const invalidLabelId = uniqueLabelIds.find((labelId) => !allowedLabelIds.has(labelId));

    if (invalidLabelId) {
      return { ok: false as const, message: "Одна или несколько меток не принадлежат этой доске" };
    }

    return { ok: true as const, labelIds: uniqueLabelIds };
  };

  const normalizeLocationIds = (locationIds: unknown): string[] => {
    if (!Array.isArray(locationIds)) return [];
    return Array.from(new Set(locationIds.map((value) => String(value || "").trim()).filter(Boolean)));
  };

  const normalizeLocationTopicStatus = (status: unknown) => {
    const value = String(status || "").trim();
    if (["reported", "in_progress", "active"].includes(value)) return "active" as const;
    if (value === "cancelled") return "archived" as const;
    if (value === "resolved") return "resolved" as const;
    if (value === "archived") return "archived" as const;
    return "active" as const;
  };

  const normalizeLocationTopicType = (type: unknown) =>
    String(type || "") === "note" ? "note" as const : "issue" as const;

  const getKanbanCardLocationIds = async (card: any): Promise<string[]> => {
    const links = await storage.getKanbanCardLocationLinks(String(card.id)).catch(() => []);
    const linkedIds = normalizeLocationIds((links as any[]).map((link) => link.locationId));
    if (linkedIds.length) return linkedIds;
    return card.locationId ? [String(card.locationId)] : [];
  };

  const resolveKanbanLocationIds = async (
    board: any,
    requestedLocationIds: unknown,
    existingLocationIds: string[] = [],
  ) => {
    const locationIds = normalizeLocationIds(requestedLocationIds);
    if (locationIds.length > 20) {
      return { ok: false as const, status: 400, message: "К карточке можно привязать не более 20 площадок" };
    }

    const existingSet = new Set(existingLocationIds.map(String));
    const locations = await Promise.all(locationIds.map((locationId) =>
      storage.getCustomLocationById(locationId).catch(() => undefined),
    ));
    for (let index = 0; index < locations.length; index += 1) {
      const location = locations[index] as any;
      const locationId = locationIds[index];
      if (!location) {
        return { ok: false as const, status: 400, message: "Выберите существующие площадки" };
      }
      if (location.archivedAt && !existingSet.has(locationId)) {
        return { ok: false as const, status: 409, message: "Архивную площадку нельзя добавить к новой связи" };
      }
      if (board.companyId && String(location.companyId || "") !== String(board.companyId)) {
        return { ok: false as const, status: 403, message: "Площадка принадлежит другой компании" };
      }
      if (!board.companyId) {
        return { ok: false as const, status: 400, message: "Личную доску нельзя связывать с площадкой компании" };
      }
    }

    return { ok: true as const, locationIds, locations };
  };

  const buildKanbanCardResponses = async (cards: any[]) => {
    const [labelEntries, locationEntries, commentEntries, allLocations, allIssues, allBoards] = await Promise.all([
      Promise.all(
      cards.map(async (card) => {
        const links = await storage.getKanbanCardLabels(card.id).catch(() => []);
        return [String(card.id), (links as any[]).map((link) => String(link.labelId))] as const;
      }),
      ),
      Promise.all(cards.map(async (card) => [
        String(card.id),
        await getKanbanCardLocationIds(card),
      ] as const)),
      Promise.all(cards.map(async (card) => [
        String(card.id),
        await storage.getKanbanCardComments(card.id).catch(() => []),
      ] as const)),
      storage.getCustomLocations().catch(() => []),
      storage.getLocationIssues().catch(() => []),
      storage.getKanbanBoards().catch(() => []),
    ]);

    const labelIdsByCardId = new Map(labelEntries);
    const locationIdsByCardId = new Map(locationEntries);
    const commentsByCardId = new Map(commentEntries);
    const locationById = new Map((allLocations as any[]).map((location) => [String(location.id), location]));
    const boardById = new Map((allBoards as any[]).map((board) => [String(board.id), board]));
    return cards.map((card) => {
      const board = boardById.get(String(card.boardId)) as any;
      const activeComments = ((commentsByCardId.get(String(card.id)) ?? []) as any[])
        .filter((comment) => !comment.deletedAt);
      const latestCommentAt = activeComments.reduce<string | null>((latest, comment) => {
        const value = new Date(comment.updatedAt || comment.createdAt || 0).getTime();
        const latestValue = latest ? new Date(latest).getTime() : 0;
        return value > latestValue ? new Date(value).toISOString() : latest;
      }, null);
      const locationIds = (locationIdsByCardId.get(String(card.id)) ?? [])
        .filter((locationId) => {
          const location = locationById.get(locationId) as any;
          return Boolean(
            location &&
            board?.companyId &&
            String(location.companyId || "") === String(board.companyId),
          );
        });
      return {
      ...card,
      labelIds: labelIdsByCardId.get(String(card.id)) ?? [],
      commentCount: activeComments.length,
      latestCommentAt,
      locationIds,
      locations: locationIds
        .map((locationId) => locationById.get(locationId))
        .filter(Boolean)
        .map((location: any) => ({
          id: location.id,
          name: location.name,
          archivedAt: location.archivedAt ?? null,
        })),
      locationTopics: (allIssues as any[])
        .filter((issue) =>
          locationIds.includes(String(issue.locationId)) &&
          normalizeLocationTopicStatus(issue.status) === "active",
        )
        .sort((left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime(),
        )
        .slice(0, 5)
        .map((issue) => ({
          id: issue.id,
          locationId: issue.locationId,
          locationName: locationById.get(String(issue.locationId))?.name || "Площадка",
          title: issue.title,
          type: normalizeLocationTopicType(issue.type),
          severity: normalizeLocationTopicType(issue.type) === "issue" ? issue.severity || "medium" : null,
          status: normalizeLocationTopicStatus(issue.status),
          updatedAt: issue.updatedAt || issue.createdAt || null,
        })),
      locationWarnings: (allIssues as any[])
        .filter((issue) =>
          locationIds.includes(String(issue.locationId)) &&
          normalizeLocationTopicType(issue.type) === "issue" &&
          ["high", "critical"].includes(String(issue.severity)) &&
          normalizeLocationTopicStatus(issue.status) === "active",
        )
        .map((issue) => ({
          id: issue.id,
          locationId: issue.locationId,
          locationName: locationById.get(String(issue.locationId))?.name || "Площадка",
          title: issue.title,
          severity: issue.severity,
        })),
      };
    });
  };

  const buildKanbanCardResponse = async (card: any) => {
    const [result] = await buildKanbanCardResponses([card]);
    return result;
  };

  const ensureCompanyWorkspaceKey = async (companyId: string) => {
    const company = await storage.getCompanyById(companyId).catch(() => undefined);
    if (!company) return "";
    const settings = company.settings && typeof company.settings === "object" ? company.settings as any : {};
    const monitoring = settings.monitoring && typeof settings.monitoring === "object" ? settings.monitoring : {};
    const current = String(monitoring.workspaceKey || "").trim();
    if (current) return current;
    const workspaceKey = `sd_${crypto.randomBytes(18).toString("hex")}`;
    await storage.updateCompany(companyId, {
      settings: {
        ...settings,
        monitoring: {
          ...monitoring,
          enabled: true,
          workspaceKey,
        },
      },
    } as any).catch(() => undefined);
    return workspaceKey;
  };

  const psString = (value: unknown) => String(value ?? "").replace(/'/g, "''");

  // Kanban V2 Boards
  app.get("/api/kanban/boards", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const { boards } = await getVisibleKanbanBoardsForUser(currentUser);
      res.json(boards);
    } catch (error) {
      console.error("[Kanban] Failed to fetch boards:", error);
      res.status(500).json({ message: "Не удалось загрузить доски" });
    }
  });

  app.get("/api/kanban/cards", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const { boards } = await getVisibleKanbanBoardsForUser(currentUser);
      const boardIds = boards.map((board: any) => String(board.id)).filter(Boolean);
      const [cardLists, listLists] = await Promise.all([
        Promise.all(boardIds.map((boardId) => storage.getKanbanCardsByBoardId(boardId).catch(() => []))),
        Promise.all(boardIds.map((boardId) => storage.getKanbanListsByBoardId(boardId).catch(() => []))),
      ]);
      const cards = cardLists.flat();
      const lists = listLists.flat() as any[];
      const listNameById = new Map(lists.map((list) => [String(list.id), String(list.name || "Список")]));
      const listTypeById = new Map(lists.map((list) => [String(list.id), String(list.type || "active")]));
      const listColorById = new Map(lists.map((list) => [String(list.id), list.color ? String(list.color) : null]));
      const boardNameById = new Map((boards as any[]).map((board) => [String(board.id), String(board.name || "Доска")]));
      const boardProjectById = new Map((boards as any[]).map((board) => [String(board.id), board.projectId || null]));
      const boardCompanyById = new Map((boards as any[]).map((board) => [String(board.id), board.companyId || null]));
      const cardsWithLabels = await buildKanbanCardResponses(cards as any[]);
      res.json(
        cardsWithLabels.map((card: any) => ({
          ...card,
          listName: listNameById.get(String(card.listId)) || "Список",
          listType: listTypeById.get(String(card.listId)) || "active",
          listColor: listColorById.get(String(card.listId)) || null,
          boardName: boardNameById.get(String(card.boardId)) || "Доска",
          boardProjectId: boardProjectById.get(String(card.boardId)) || null,
          companyId: boardCompanyById.get(String(card.boardId)) || null,
        })),
      );
    } catch (error) {
      console.error("[Kanban] Failed to fetch all cards:", error);
      res.status(500).json({ message: "Не удалось загрузить карточки" });
    }
  });

  app.get("/api/kanban/boards/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.id);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      res.json(buildKanbanBoardResponse(access.board, access));
    } catch (error) {
      console.error("[Kanban] Failed to fetch board:", error);
      res.status(500).json({ message: "Не удалось загрузить доску" });
    }
  });

  app.post("/api/kanban/boards", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;

      const parsed = kanbanBoardCreateSchema.parse(req.body || {});
      const normalizedCompanyId = workspace.type === "company" ? workspace.companyId : null;
      const normalizedVisibility = normalizedCompanyId ? parsed.visibility : "personal";

      if (normalizedCompanyId && !(await canManageCompany(currentUser, normalizedCompanyId))) {
        return res.status(403).json({ message: "Недостаточно прав для создания доски" });
      }

      if (parsed.projectId) {
        const project = await storage.getProjectById(parsed.projectId).catch(() => undefined);
        if (!project) return res.status(404).json({ message: "Проект не найден" });
        if (!(await canOpenProjectKanbanBoard(currentUser, project))) {
          return res.status(403).json({ message: "Нет доступа к проекту в выбранном пространстве" });
        }
        if (String(project.companyId || "") !== String(normalizedCompanyId || "")) {
          return res.status(400).json({ message: "Проект должен принадлежать выбранному пространству" });
        }
      }

      const board = await storage.createKanbanBoard({
        companyId: normalizedCompanyId,
        projectId: parsed.projectId ?? null,
        name: parsed.name,
        description: parsed.description?.trim() || null,
        visibility: normalizedVisibility,
        createdByUserId: currentUser.id,
      });

      const membership = await storage.createKanbanBoardMember({
        boardId: board.id,
        userId: currentUser.id,
        role: "editor",
        canComment: true,
      });

      res.status(201).json(buildKanbanBoardResponse(board, { canManage: true, membership }));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные доски", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create board:", error);
      res.status(500).json({ message: "Не удалось создать доску" });
    }
  });

  app.put("/api/kanban/boards/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.id);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для изменения доски" });

      const parsed = kanbanBoardUpdateSchema.parse(req.body || {});

      if (parsed.projectId) {
        const project = await storage.getProjectById(parsed.projectId).catch(() => undefined);
        if (!project) return res.status(404).json({ message: "Проект не найден" });
        if (!(await canOpenProjectKanbanBoard(currentUser, project))) {
          return res.status(403).json({ message: "Нет доступа к проекту в выбранном пространстве" });
        }
        if (String(project.companyId || "") !== String(access.board.companyId || "")) {
          return res.status(400).json({ message: "Проект должен принадлежать выбранному пространству" });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (parsed.name !== undefined) updateData.name = parsed.name;
      if (parsed.description !== undefined) updateData.description = parsed.description?.trim() || null;
      if (parsed.visibility !== undefined) updateData.visibility = access.board.companyId ? parsed.visibility : "personal";
      if (parsed.projectId !== undefined) updateData.projectId = parsed.projectId;
      if (parsed.customFields !== undefined) updateData.customFields = normalizeKanbanCustomFields(parsed.customFields);
      if (parsed.labelGroups !== undefined) updateData.labelGroups = normalizeKanbanLabelGroups(parsed.labelGroups);

      const updated = await storage.updateKanbanBoard(access.board.id, updateData as any);
      if (!updated) return res.status(404).json({ message: "Доска не найдена" });

      res.json(buildKanbanBoardResponse(updated, access));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные доски", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to update board:", error);
      res.status(500).json({ message: "Не удалось обновить доску" });
    }
  });

  app.delete("/api/kanban/boards/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.id);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для удаления доски" });

      const deleted = await storage.deleteKanbanBoard(access.board.id);
      if (!deleted) return res.status(404).json({ message: "Доска не найдена" });

      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to delete board:", error);
      res.status(500).json({ message: "Не удалось удалить доску" });
    }
  });

  app.get("/api/kanban/boards/:boardId/custom-fields", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      res.json(normalizeKanbanCustomFields((access.board as any).customFields));
    } catch (error) {
      console.error("[Kanban] Failed to fetch custom fields:", error);
      res.status(500).json({ message: "Не удалось загрузить поля доски" });
    }
  });

  app.post("/api/kanban/boards/:boardId/custom-fields", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления полями" });

      const parsed = kanbanCustomFieldPayloadSchema.parse(req.body || {});
      const fields = normalizeKanbanCustomFields((access.board as any).customFields);
      if (fields.some((field) => !field.archivedAt && field.name.toLowerCase() === parsed.name.toLowerCase())) {
        return res.status(409).json({ message: "Поле с таким названием уже существует" });
      }
      const now = new Date().toISOString();
      const nextField = {
        id: crypto.randomUUID(),
        name: parsed.name,
        type: parsed.type,
        options: Array.from(new Set((parsed.options ?? []).map((option) => option.trim()).filter(Boolean))),
        required: parsed.required,
        showOnCard: parsed.showOnCard,
        showInList: parsed.showInList,
        position: fields.length,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const updated = await storage.updateKanbanBoard(access.board.id, { customFields: [...fields, nextField] } as any);
      res.status(201).json(nextField);
      if (updated) void updated;
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные поля", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create custom field:", error);
      res.status(500).json({ message: "Не удалось создать поле" });
    }
  });

  app.put("/api/kanban/boards/:boardId/custom-fields/:fieldId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления полями" });

      const parsed = kanbanCustomFieldPayloadSchema.partial().parse(req.body || {});
      const fields = normalizeKanbanCustomFields((access.board as any).customFields);
      const field = fields.find((item) => item.id === req.params.fieldId);
      if (!field) return res.status(404).json({ message: "Поле не найдено" });
      const nextName = parsed.name ?? field.name;
      if (fields.some((item) => item.id !== field.id && !item.archivedAt && item.name.toLowerCase() === nextName.toLowerCase())) {
        return res.status(409).json({ message: "Поле с таким названием уже существует" });
      }
      const nextFields = fields.map((item) => item.id === field.id
        ? {
            ...item,
            ...parsed,
            name: nextName,
            options: parsed.options !== undefined
              ? Array.from(new Set(parsed.options.map((option) => option.trim()).filter(Boolean)))
              : item.options,
            updatedAt: new Date().toISOString(),
          }
        : item);
      await storage.updateKanbanBoard(access.board.id, { customFields: nextFields } as any);
      res.json(nextFields.find((item) => item.id === field.id));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные поля", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to update custom field:", error);
      res.status(500).json({ message: "Не удалось обновить поле" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/custom-fields/:fieldId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления полями" });
      const fields = normalizeKanbanCustomFields((access.board as any).customFields);
      const found = fields.some((field) => field.id === req.params.fieldId);
      if (!found) return res.status(404).json({ message: "Поле не найдено" });
      const now = new Date().toISOString();
      await storage.updateKanbanBoard(access.board.id, {
        customFields: fields.map((field) => field.id === req.params.fieldId
          ? { ...field, archivedAt: now, updatedAt: now }
          : field),
      } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to archive custom field:", error);
      res.status(500).json({ message: "Не удалось архивировать поле" });
    }
  });

  app.get("/api/kanban/boards/:boardId/label-groups", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      res.json(normalizeKanbanLabelGroups((access.board as any).labelGroups));
    } catch (error) {
      console.error("[Kanban] Failed to fetch label groups:", error);
      res.status(500).json({ message: "Не удалось загрузить группы меток" });
    }
  });

  app.post("/api/kanban/boards/:boardId/label-groups", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления группами" });
      const parsed = kanbanLabelGroupPayloadSchema.parse(req.body || {});
      const groups = normalizeKanbanLabelGroups((access.board as any).labelGroups);
      if (groups.some((group) => !group.archivedAt && group.name.toLowerCase() === parsed.name.toLowerCase())) {
        return res.status(409).json({ message: "Группа с таким названием уже существует" });
      }
      const now = new Date().toISOString();
      const group = {
        id: crypto.randomUUID(),
        name: parsed.name,
        color: parsed.color?.trim() || null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await storage.updateKanbanBoard(access.board.id, { labelGroups: [...groups, group] } as any);
      res.status(201).json(group);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные группы", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create label group:", error);
      res.status(500).json({ message: "Не удалось создать группу" });
    }
  });

  app.put("/api/kanban/boards/:boardId/label-groups/:groupId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления группами" });
      const parsed = kanbanLabelGroupPayloadSchema.partial().parse(req.body || {});
      const groups = normalizeKanbanLabelGroups((access.board as any).labelGroups);
      const group = groups.find((item) => item.id === req.params.groupId);
      if (!group) return res.status(404).json({ message: "Группа не найдена" });
      const nextName = parsed.name ?? group.name;
      if (groups.some((item) => item.id !== group.id && !item.archivedAt && item.name.toLowerCase() === nextName.toLowerCase())) {
        return res.status(409).json({ message: "Группа с таким названием уже существует" });
      }
      const nextGroups = groups.map((item) => item.id === group.id
        ? {
            ...item,
            name: nextName,
            color: parsed.color !== undefined ? parsed.color?.trim() || null : item.color,
            updatedAt: new Date().toISOString(),
          }
        : item);
      await storage.updateKanbanBoard(access.board.id, { labelGroups: nextGroups } as any);
      res.json(nextGroups.find((item) => item.id === group.id));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные группы", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to update label group:", error);
      res.status(500).json({ message: "Не удалось обновить группу" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/label-groups/:groupId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления группами" });
      const groups = normalizeKanbanLabelGroups((access.board as any).labelGroups);
      const found = groups.some((group) => group.id === req.params.groupId);
      if (!found) return res.status(404).json({ message: "Группа не найдена" });
      const now = new Date().toISOString();
      await storage.updateKanbanBoard(access.board.id, {
        labelGroups: groups.map((group) => group.id === req.params.groupId
          ? { ...group, archivedAt: now, updatedAt: now }
          : group),
      } as any);
      const labels = await storage.getKanbanLabelsByBoardId(access.board.id).catch(() => []);
      await Promise.all((labels as any[])
        .filter((label) => String(label.groupId || "") === String(req.params.groupId))
        .map((label) => storage.updateKanbanLabel(label.id, { groupId: null } as any)));
      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to archive label group:", error);
      res.status(500).json({ message: "Не удалось архивировать группу" });
    }
  });

  app.get("/api/kanban/boards/:boardId/members", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.board.companyId) {
        const ownerMembership = await storage.getKanbanBoardMember(access.board.id, access.board.createdByUserId).catch(() => undefined);
        return res.json(ownerMembership ? [ownerMembership] : []);
      }

      const members = await storage.getKanbanBoardMembers(access.board.id).catch(() => []);
      res.json(members);
    } catch (error) {
      console.error("[Kanban] Failed to fetch board members:", error);
      res.status(500).json({ message: "Не удалось загрузить участников доски" });
    }
  });

  app.post("/api/kanban/boards/:boardId/members", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.board.companyId) {
        return res.status(400).json({ message: "Личные доски не требуют отдельного управления участниками" });
      }
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления участниками" });

      const parsed = kanbanBoardMemberCreateSchema.parse(req.body || {});
      const user = await storage.getUser(parsed.userId).catch(() => undefined);
      if (!user || user.active === false) {
        return res.status(404).json({ message: "Пользователь не найден или деактивирован" });
      }

      const membership = await storage.getCompanyMembershipByUser(access.board.companyId, parsed.userId).catch(() => undefined);
      if (!membership || membership.status !== "active") {
        return res.status(400).json({ message: "Пользователь должен быть активным участником компании доски" });
      }

      const existing = await storage.getKanbanBoardMember(access.board.id, parsed.userId).catch(() => undefined);
      if (existing) return res.status(409).json({ message: "Пользователь уже добавлен в доску" });

      const created = await storage.createKanbanBoardMember({
        boardId: access.board.id,
        userId: parsed.userId,
        role: parsed.role,
        canComment: parsed.role === "editor" ? true : parsed.canComment,
      });

      if (String(parsed.userId) !== String(currentUser.id)) {
        await createKanbanNotifications(
          [parsed.userId],
          "Доступ к доске Kanban",
          `Вас добавили в доску: ${access.board.name}`,
        );
      }

      res.status(201).json(created);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные участника", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create board member:", error);
      res.status(500).json({ message: "Не удалось добавить участника" });
    }
  });

  app.put("/api/kanban/boards/:boardId/members/:memberId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.board.companyId) {
        return res.status(400).json({ message: "Личные доски не требуют отдельного управления участниками" });
      }
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления участниками" });

      const members = await storage.getKanbanBoardMembers(access.board.id).catch(() => []);
      const member = (members as any[]).find((item) => String(item.id) === String(req.params.memberId));
      if (!member) return res.status(404).json({ message: "Участник не найден" });

      const parsed = kanbanBoardMemberUpdateSchema.parse(req.body || {});
      const nextRole = parsed.role ?? member.role;
      const nextCanComment = nextRole === "editor" ? true : (parsed.canComment ?? member.canComment);

      if (String(member.userId) === String(access.board.createdByUserId) && nextRole !== "editor") {
        return res.status(400).json({ message: "Создатель доски должен оставаться editor" });
      }

      const updated = await storage.updateKanbanBoardMember(member.id, {
        role: nextRole,
        canComment: nextCanComment,
      });
      if (!updated) return res.status(404).json({ message: "Участник не найден" });

      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные участника", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to update board member:", error);
      res.status(500).json({ message: "Не удалось обновить участника" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/members/:memberId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!access.board.companyId) {
        return res.status(400).json({ message: "Личные доски не требуют отдельного управления участниками" });
      }
      if (!access.canManage) return res.status(403).json({ message: "Недостаточно прав для управления участниками" });

      const members = await storage.getKanbanBoardMembers(access.board.id).catch(() => []);
      const member = (members as any[]).find((item) => String(item.id) === String(req.params.memberId));
      if (!member) return res.status(404).json({ message: "Участник не найден" });
      if (String(member.userId) === String(access.board.createdByUserId)) {
        return res.status(400).json({ message: "Нельзя удалить создателя доски" });
      }

      await storage.deleteKanbanBoardMember(member.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to delete board member:", error);
      res.status(500).json({ message: "Не удалось удалить участника" });
    }
  });

  app.get("/api/kanban/boards/:boardId/lists", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const lists = await storage.getKanbanListsByBoardId(access.board.id).catch(() => []);
      res.json(lists);
    } catch (error) {
      console.error("[Kanban] Failed to fetch lists:", error);
      res.status(500).json({ message: "Не удалось загрузить списки" });
    }
  });

  app.post("/api/kanban/boards/:boardId/lists", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const canEdit = access.canManage || access.membership?.role === "editor";
      if (!canEdit) return res.status(403).json({ message: "Недостаточно прав для изменения списков" });

      const parsed = kanbanListCreateSchema.parse(req.body || {});
      const existingLists = await storage.getKanbanListsByBoardId(access.board.id).catch(() => []);
      const nextPosition = existingLists.reduce((maxPosition: number, list: any) => {
        return Math.max(maxPosition, Number(list?.position ?? 0));
      }, -1) + 1;

      const list = await storage.createKanbanList({
        boardId: access.board.id,
        name: parsed.name,
        color: parsed.color?.trim() || null,
        type: parsed.type,
        position: nextPosition,
      });

      res.status(201).json(list);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные списка", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create list:", error);
      res.status(500).json({ message: "Не удалось создать список" });
    }
  });

  app.put("/api/kanban/boards/:boardId/lists/:listId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const canEdit = access.canManage || access.membership?.role === "editor";
      if (!canEdit) return res.status(403).json({ message: "Недостаточно прав для изменения списков" });

      const list = await storage.getKanbanListById(req.params.listId).catch(() => undefined);
      if (!list || String(list.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Список не найден" });
      }

      const parsed = kanbanListUpdateSchema.parse(req.body || {});
      const updateData: Record<string, unknown> = {};
      if (parsed.name !== undefined) updateData.name = parsed.name;
      if (parsed.color !== undefined) updateData.color = parsed.color?.trim() || null;
      if (parsed.type !== undefined) updateData.type = parsed.type;

      const updated = await storage.updateKanbanList(list.id, updateData as any);
      if (!updated) return res.status(404).json({ message: "Список не найден" });

      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные списка", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to update list:", error);
      res.status(500).json({ message: "Не удалось обновить список" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/lists/:listId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const canEdit = access.canManage || access.membership?.role === "editor";
      if (!canEdit) return res.status(403).json({ message: "Недостаточно прав для изменения списков" });

      const list = await storage.getKanbanListById(req.params.listId).catch(() => undefined);
      if (!list || String(list.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Список не найден" });
      }

      const deleted = await storage.deleteKanbanList(list.id);
      if (!deleted) return res.status(404).json({ message: "Список не найден" });

      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to delete list:", error);
      res.status(500).json({ message: "Не удалось удалить список" });
    }
  });

  app.post("/api/kanban/boards/:boardId/lists/reorder", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения списков" });
      }

      const parsed = kanbanListReorderSchema.parse(req.body || {});
      const existingLists = await storage.getKanbanListsByBoardId(access.board.id).catch(() => []);
      const existingListIds = existingLists.map((list: any) => String(list.id));
      const requestedListIds = parsed.listIds.map(String);

      if (existingListIds.length !== requestedListIds.length) {
        return res.status(400).json({ message: "Нужно передать полный список listIds для reorder" });
      }

      const existingSet = new Set(existingListIds);
      const requestedSet = new Set(requestedListIds);
      if (existingSet.size !== requestedSet.size || existingListIds.some((id) => !requestedSet.has(id))) {
        return res.status(400).json({ message: "listIds содержат лишние или отсутствующие списки" });
      }

      await storage.reorderKanbanLists(access.board.id, requestedListIds);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте порядок списков", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to reorder lists:", error);
      res.status(500).json({ message: "Не удалось изменить порядок списков" });
    }
  });

  app.get("/api/kanban/boards/:boardId/cards", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const cards = await storage.getKanbanCardsByBoardId(access.board.id).catch(() => []);
      res.json(await buildKanbanCardResponses(cards as any[]));
    } catch (error) {
      console.error("[Kanban] Failed to fetch cards:", error);
      res.status(500).json({ message: "Не удалось загрузить карточки" });
    }
  });

  app.get("/api/kanban/boards/:boardId/cards/:cardId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      res.json(await buildKanbanCardResponse(card));
    } catch (error) {
      console.error("[Kanban] Failed to fetch card:", error);
      res.status(500).json({ message: "Не удалось загрузить карточку" });
    }
  });

  app.get("/api/kanban/boards/:boardId/cards/:cardId/history", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const history = await storage.getKanbanCardHistory(card.id).catch(() => []);
      res.json(history);
    } catch (error) {
      console.error("[Kanban] Failed to fetch card history:", error);
      res.status(500).json({ message: "Не удалось загрузить историю карточки" });
    }
  });

  app.get("/api/kanban/boards/:boardId/cards/:cardId/comments", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const comments = await storage.getKanbanCardComments(card.id).catch(() => []);
      res.json(await serializeDiscussionComments(
        comments as any[],
        currentUser,
        canEditKanbanBoard(access),
      ));
    } catch (error) {
      console.error("[Kanban] Failed to fetch card comments:", error);
      res.status(500).json({ message: "Не удалось загрузить комментарии карточки" });
    }
  });

  app.get("/api/kanban/boards/:boardId/cards/:cardId/attachments", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const attachments = await storage.getKanbanCardAttachments(card.id).catch(() => []);
      res.json(attachments);
    } catch (error) {
      console.error("[Kanban] Failed to fetch card attachments:", error);
      res.status(500).json({ message: "Не удалось загрузить вложения карточки" });
    }
  });

  app.post("/api/kanban/boards/:boardId/cards/:cardId/attachments", kanbanAttachmentUpload.single("file"), async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для загрузки файлов" });
      }

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Файл не был загружен" });
      }

      const attachmentData = insertKanbanCardAttachmentSchema.parse({
        cardId: card.id,
        uploadedByUserId: currentUser.id,
        fileName: req.file.originalname || req.file.filename,
        fileUrl: `/uploads/kanban/${req.file.filename}`,
        mimeType: req.file.mimetype || null,
        fileSize: req.file.size || null,
      });

      const attachment = await storage.createKanbanCardAttachment(attachmentData);
      await createKanbanCardHistoryEntry(currentUser.id, card.id, "attachment_added", null, {
        attachmentId: attachment.id,
        fileName: attachment.fileName,
      });

      await createKanbanNotifications(
        [card.assigneeUserId, card.creatorUserId].filter(
          (userId) => String(userId || "") !== String(currentUser.id),
        ),
        "Новое вложение в Kanban",
        `К карточке "${card.title}" добавлен файл: ${attachment.fileName}`,
      );

      res.status(201).json(attachment);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные вложения", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to upload card attachment:", error);
      res.status(500).json({ message: "Не удалось загрузить вложение" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/cards/:cardId/attachments/:attachmentId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для удаления вложений" });
      }

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const attachments = await storage.getKanbanCardAttachments(card.id).catch(() => []);
      const attachment = (attachments as any[]).find((item) => String(item.id) === String(req.params.attachmentId));
      if (!attachment) {
        return res.status(404).json({ message: "Вложение не найдено" });
      }

      await storage.deleteKanbanCardAttachment(attachment.id);
      if (typeof attachment.fileUrl === "string" && attachment.fileUrl.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), attachment.fileUrl.replace(/^\/+/, ""));
        await fs.unlink(filePath).catch(() => undefined);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to delete card attachment:", error);
      res.status(500).json({ message: "Не удалось удалить вложение" });
    }
  });

  app.post("/api/kanban/boards/:boardId/cards/:cardId/comments", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canCommentKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для комментариев карточки" });
      }

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const payload = discussionCommentPayloadSchema.parse(req.body || {});
      const existingComments = await storage.getKanbanCardComments(card.id).catch(() => []);
      const parentResolution = findDiscussionRoot(existingComments as any[], payload.parentCommentId);
      if (!parentResolution.ok) {
        return res.status(400).json({ message: parentResolution.message });
      }

      const comment = await storage.createKanbanCardComment({
        cardId: card.id,
        userId: currentUser.id,
        parentCommentId: parentResolution.parentCommentId,
        authorName: String(currentUser.name || currentUser.username || "Пользователь"),
        content: payload.content,
      });

      await createKanbanCardHistoryEntry(currentUser.id, card.id, "commented", null, {
        commentId: comment.id,
        parentCommentId: comment.parentCommentId || null,
        content: comment.content.slice(0, 200),
      });

      await createKanbanNotifications(
        [card.assigneeUserId, card.creatorUserId].filter(
          (userId) => String(userId || "") !== String(currentUser.id),
        ),
        "Новый комментарий в Kanban",
        `Новый комментарий к карточке: ${card.title}`,
      );

      publishDiscussionEvent(createDiscussionRealtimeEvent({
        channel: `kanban-card:${card.id}:comments`,
        action: comment.parentCommentId ? "replied" : "created",
        recordId: comment.id,
        version: comment.updatedAt,
      }));

      const [responseComment] = await serializeDiscussionComments(
        [comment],
        currentUser,
        canEditKanbanBoard(access),
      );
      res.status(201).json(responseComment);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные комментария", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create card comment:", error);
      res.status(500).json({ message: "Не удалось добавить комментарий" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/cards/:cardId/comments/:commentId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const comments = await storage.getKanbanCardComments(card.id).catch(() => []);
      const comment = comments.find((item: any) => String(item.id) === String(req.params.commentId));
      if (!comment) {
        return res.status(404).json({ message: "Комментарий не найден" });
      }
      if (
        !canEditKanbanBoard(access) &&
        String(comment.userId || "") !== String(currentUser.id)
      ) {
        return res.status(403).json({ message: "Можно удалить только собственный комментарий" });
      }
      if (comment.deletedAt) {
        return res.json({ success: true });
      }

      const deleted = await storage.updateKanbanCardComment(comment.id, {
        deletedAt: new Date(),
      } as any);
      if (!deleted) return res.status(404).json({ message: "Комментарий не найден" });

      publishDiscussionEvent(createDiscussionRealtimeEvent({
        channel: `kanban-card:${card.id}:comments`,
        action: "deleted",
        recordId: deleted.id,
        version: deleted.updatedAt,
      }));

      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to delete card comment:", error);
      res.status(500).json({ message: "Не удалось удалить комментарий" });
    }
  });

  app.get("/api/kanban/boards/:boardId/labels", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });

      const labels = await storage.getKanbanLabelsByBoardId(access.board.id).catch(() => []);
      res.json(labels);
    } catch (error) {
      console.error("[Kanban] Failed to fetch labels:", error);
      res.status(500).json({ message: "Не удалось получить метки" });
    }
  });

  app.post("/api/kanban/boards/:boardId/labels", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения меток" });
      }

      const parsed = kanbanLabelPayloadSchema.parse(req.body || {});
      const existingLabels = await storage.getKanbanLabelsByBoardId(access.board.id).catch(() => []);
      if ((existingLabels as any[]).some((label) => !label.archivedAt && String(label.name || "").toLowerCase() === parsed.name.toLowerCase())) {
        return res.status(409).json({ message: "Метка с таким названием уже существует" });
      }
      if (parsed.groupId) {
        const groups = normalizeKanbanLabelGroups((access.board as any).labelGroups);
        const group = groups.find((item) => item.id === parsed.groupId && !item.archivedAt);
        if (!group) return res.status(400).json({ message: "Группа меток не найдена" });
      }
      const labelData = insertKanbanLabelSchema.parse({
        boardId: access.board.id,
        name: parsed.name,
        color: parsed.color?.trim() || null,
        groupId: parsed.groupId || null,
      });
      const label = await storage.createKanbanLabel(labelData);
      res.status(201).json(label);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные метки", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create label:", error);
      res.status(500).json({ message: "Не удалось создать метку" });
    }
  });

  app.put("/api/kanban/boards/:boardId/labels/:labelId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения меток" });
      }

      const label = await storage.getKanbanLabelById(req.params.labelId).catch(() => undefined);
      if (!label || String(label.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Метка не найдена" });
      }

      const parsed = kanbanLabelPayloadSchema.parse(req.body || {});
      const existingLabels = await storage.getKanbanLabelsByBoardId(access.board.id).catch(() => []);
      if ((existingLabels as any[]).some((item) =>
        String(item.id) !== String(label.id) &&
        !item.archivedAt &&
        String(item.name || "").toLowerCase() === parsed.name.toLowerCase()
      )) {
        return res.status(409).json({ message: "Метка с таким названием уже существует" });
      }
      if (parsed.groupId) {
        const groups = normalizeKanbanLabelGroups((access.board as any).labelGroups);
        const group = groups.find((item) => item.id === parsed.groupId && !item.archivedAt);
        if (!group) return res.status(400).json({ message: "Группа меток не найдена" });
      }
      const updated = await storage.updateKanbanLabel(label.id, {
        name: parsed.name,
        color: parsed.color?.trim() || null,
        groupId: parsed.groupId || null,
      });
      if (!updated) return res.status(404).json({ message: "Метка не найдена" });

      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные метки", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to update label:", error);
      res.status(500).json({ message: "Не удалось обновить метку" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/labels/:labelId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения меток" });
      }

      const label = await storage.getKanbanLabelById(req.params.labelId).catch(() => undefined);
      if (!label || String(label.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Метка не найдена" });
      }

      await storage.deleteKanbanLabel(label.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to delete label:", error);
      res.status(500).json({ message: "Не удалось удалить метку" });
    }
  });

  app.post("/api/kanban/boards/:boardId/cards", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения карточек" });
      }

      const parsed = kanbanCardCreateSchema.parse(req.body || {});
      const list = await storage.getKanbanListById(parsed.listId).catch(() => undefined);
      if (!list || String(list.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Список не найден" });
      }

      const existingCards = await storage.getKanbanCardsByListId(list.id).catch(() => []);
      const nextPosition = existingCards.reduce((maxPosition: number, card: any) => {
        return Math.max(maxPosition, Number(card?.position ?? 0));
      }, -1) + 1;
      const assigneeResolution = await resolveKanbanAssigneeUserId(access.board, currentUser, parsed.assigneeUserId);
      if (!assigneeResolution.ok) {
        return res.status(400).json({ message: assigneeResolution.message });
      }
      const labelResolution = await resolveKanbanLabelIds(access.board.id, parsed.labelIds);
      if (!labelResolution.ok) {
        return res.status(400).json({ message: labelResolution.message });
      }
      const requestedLocationIds = parsed.locationIds !== undefined
        ? parsed.locationIds
        : parsed.locationId ? [parsed.locationId] : [];
      const locationResolution = await resolveKanbanLocationIds(access.board, requestedLocationIds);
      if (!locationResolution.ok) {
        return res.status(locationResolution.status).json({ message: locationResolution.message });
      }

      const card = await storage.createKanbanCard({
        boardId: access.board.id,
        projectId: access.board.projectId ?? null,
        listId: list.id,
        title: parsed.title,
        description: parsed.description?.trim() || null,
        priority: parsed.priority,
        startDate: parseOptionalKanbanDate(parsed.startDate),
        dueDate: parseOptionalKanbanDate(parsed.dueDate),
        locationId: locationResolution.locationIds[0] || null,
        subtasks: normalizeKanbanSubtasks(parsed.subtasks),
        customFieldValues: parsed.customFieldValues ?? {},
        creatorUserId: currentUser.id,
        assigneeUserId: assigneeResolution.userId,
        position: nextPosition,
      });
      await storage.setKanbanCardLocations(card.id, locationResolution.locationIds);
      await storage.setKanbanCardLabels(card.id, labelResolution.labelIds);

      await createKanbanCardHistoryEntry(currentUser.id, card.id, "created", null, card);

      if (card.assigneeUserId && String(card.assigneeUserId) !== String(currentUser.id)) {
        await createKanbanNotifications(
          [card.assigneeUserId],
          "Новая карточка Kanban",
          `Вам назначена карточка: ${card.title}`,
        );
      }

      res.status(201).json(await buildKanbanCardResponse(card));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные карточки", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to create card:", error);
      res.status(500).json({ message: "Не удалось создать карточку" });
    }
  });

  app.put("/api/kanban/boards/:boardId/cards/:cardId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения карточек" });
      }

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const parsed = kanbanCardUpdateSchema.parse(req.body || {});
      const updateData: Record<string, unknown> = {};
      const previousLocationIds = await getKanbanCardLocationIds(card);
      let nextLocationIds: string[] | undefined;

      if (parsed.title !== undefined) updateData.title = parsed.title;
      if (parsed.description !== undefined) updateData.description = parsed.description?.trim() || null;
      if (parsed.priority !== undefined) updateData.priority = parsed.priority;
      if (parsed.startDate !== undefined) updateData.startDate = parseOptionalKanbanDate(parsed.startDate);
      if (parsed.dueDate !== undefined) updateData.dueDate = parseOptionalKanbanDate(parsed.dueDate);
      if (parsed.locationIds !== undefined || parsed.locationId !== undefined) {
        const requestedLocationIds = parsed.locationIds !== undefined
          ? parsed.locationIds
          : parsed.locationId ? [parsed.locationId] : [];
        const locationResolution = await resolveKanbanLocationIds(
          access.board,
          requestedLocationIds,
          previousLocationIds,
        );
        if (!locationResolution.ok) {
          return res.status(locationResolution.status).json({ message: locationResolution.message });
        }
        nextLocationIds = locationResolution.locationIds;
        updateData.locationId = nextLocationIds[0] || null;
      }
      if (parsed.subtasks !== undefined) updateData.subtasks = normalizeKanbanSubtasks(parsed.subtasks);
      if (parsed.customFieldValues !== undefined) updateData.customFieldValues = parsed.customFieldValues ?? {};
      if (parsed.assigneeUserId !== undefined) {
        const assigneeResolution = await resolveKanbanAssigneeUserId(access.board, currentUser, parsed.assigneeUserId);
        if (!assigneeResolution.ok) {
          return res.status(400).json({ message: assigneeResolution.message });
        }
        updateData.assigneeUserId = assigneeResolution.userId;
      }
      const previousLabelIds = (await storage.getKanbanCardLabels(card.id).catch(() => []))
        .map((link: any) => String(link.labelId));
      let nextLabelIds = previousLabelIds;
      if (parsed.labelIds !== undefined) {
        const labelResolution = await resolveKanbanLabelIds(access.board.id, parsed.labelIds);
        if (!labelResolution.ok) {
          return res.status(400).json({ message: labelResolution.message });
        }
        nextLabelIds = labelResolution.labelIds;
      }

      if (parsed.listId !== undefined) {
        const targetList = await storage.getKanbanListById(parsed.listId).catch(() => undefined);
        if (!targetList || String(targetList.boardId) !== String(access.board.id)) {
          return res.status(404).json({ message: "Список не найден" });
        }
        updateData.listId = targetList.id;

        if (String(targetList.id) !== String(card.listId)) {
          const targetCards = await storage.getKanbanCardsByListId(targetList.id).catch(() => []);
          updateData.position = targetCards.reduce((maxPosition: number, one: any) => {
            return Math.max(maxPosition, Number(one?.position ?? 0));
          }, -1) + 1;
        }
      }

      const updated = await storage.updateKanbanCard(card.id, updateData as any);
      if (!updated) return res.status(404).json({ message: "Карточка не найдена" });
      if (nextLocationIds !== undefined) {
        await storage.setKanbanCardLocations(card.id, nextLocationIds);
        if (
          previousLocationIds.length !== nextLocationIds.length ||
          previousLocationIds.some((locationId, index) => locationId !== nextLocationIds?.[index])
        ) {
          await createKanbanCardHistoryEntry(currentUser.id, updated.id, "locations_updated", {
            locationIds: previousLocationIds,
          }, {
            locationIds: nextLocationIds,
          });
        }
      }
      if (parsed.labelIds !== undefined) {
        await storage.setKanbanCardLabels(card.id, nextLabelIds);
        if (
          previousLabelIds.length !== nextLabelIds.length ||
          previousLabelIds.some((labelId, index) => labelId !== nextLabelIds[index])
        ) {
          await createKanbanCardHistoryEntry(currentUser.id, updated.id, "labels_updated", {
            labelIds: previousLabelIds,
          }, {
            labelIds: nextLabelIds,
          });
        }
      }

      await createKanbanCardHistoryEntry(currentUser.id, updated.id, "updated", card, updated);

      if (
        updated.assigneeUserId &&
        String(updated.assigneeUserId) !== String(currentUser.id) &&
        String(updated.assigneeUserId) !== String(card.assigneeUserId || "")
      ) {
        await createKanbanNotifications(
          [updated.assigneeUserId],
          "Карточка Kanban назначена",
          `Вам назначена карточка: ${updated.title}`,
        );
      }

      res.json(await buildKanbanCardResponse(updated));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные карточки", errors: error.flatten?.() });
      }
      console.error("[Kanban] Failed to update card:", error);
      res.status(500).json({ message: "Не удалось обновить карточку" });
    }
  });

  app.delete("/api/kanban/boards/:boardId/cards/:cardId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения карточек" });
      }

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const deleted = await storage.deleteKanbanCard(card.id);
      if (!deleted) return res.status(404).json({ message: "Карточка не найдена" });

      res.json({ success: true });
    } catch (error) {
      console.error("[Kanban] Failed to delete card:", error);
      res.status(500).json({ message: "Не удалось удалить карточку" });
    }
  });

  app.post("/api/kanban/boards/:boardId/cards/:cardId/move", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const access = await getKanbanBoardAccess(currentUser, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена или недоступна" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Недостаточно прав для перемещения карточек" });
      }

      const card = await storage.getKanbanCardById(req.params.cardId).catch(() => undefined);
      if (!card || String(card.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Карточка не найдена" });
      }

      const parsed = kanbanCardMoveSchema.parse(req.body || {});
      const targetList = await storage.getKanbanListById(parsed.listId).catch(() => undefined);
      if (!targetList || String(targetList.boardId) !== String(access.board.id)) {
        return res.status(404).json({ message: "Список не найден" });
      }

      const movedCard = await storage.moveKanbanCard(card.id, targetList.id, parsed.position);
      if (!movedCard) return res.status(404).json({ message: "Карточка не найдена" });

      await createKanbanCardHistoryEntry(currentUser.id, movedCard.id, "moved", card, movedCard);

      res.json(movedCard);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({
          message: "Проверьте параметры перемещения карточки",
          errors: error.flatten?.(),
        });
      }
      console.error("[Kanban] Failed to move card:", error);
      res.status(500).json({ message: "Не удалось переместить карточку" });
    }
  });

  const equipmentInventoryPrefix = (type: unknown) => {
    const normalized = String(type || "").trim().toLowerCase();
    if (/camera|камера/.test(normalized)) return "cam";
    if (/microphone|mic|микрофон/.test(normalized)) return "mic";
    if (/lighting|light|свет/.test(normalized)) return "lgt";
    if (/computer|комп/.test(normalized)) return "pc";
    if (/server|сервер/.test(normalized)) return "srv";
    if (/display|monitor|экран|монитор/.test(normalized)) return "dsp";
    if (/audio|звук/.test(normalized)) return "aud";
    if (/video|видео/.test(normalized)) return "vid";
    if (/network|lan|сеть/.test(normalized)) return "net";
    return "eqp";
  };

  const generateEquipmentInventoryNumber = async (type: unknown) => {
    const prefix = equipmentInventoryPrefix(type);
    const items = await storage.getEquipment().catch(() => []);
    const used = new Set((items as any[]).map((item) => String(item.inventoryNumber || "").toLowerCase()));
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = `${prefix}_${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
      if (!used.has(candidate.toLowerCase())) return candidate;
    }
    return `${prefix}_${Date.now().toString().slice(-6)}`;
  };

  const requirePlatformAdmin = (req: any, res: any) => {
    const user = req.user as any;
    if (!isPlatformAdminUser(user)) {
      res.status(403).json({ message: "Доступно только владельцу платформы" });
      return null;
    }
    return user;
  };

  app.get("/api/companies/me", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      if (workspace.type !== "company" || !workspace.companyId) {
        return res.json({ companies: [], pendingApprovals: [] });
      }
      const origin = inviteOrigin(req);
      const memberships = await storage.getUserCompanyMemberships(currentUser.id).catch(() => []);
      const membership = (memberships as any[]).find((item) =>
        item.status === "active" && String(item.companyId) === String(workspace.companyId),
      ) || {
        id: `platform:${workspace.companyId}`,
        companyId: workspace.companyId,
        userId: currentUser.id,
        role: "platform_admin",
        status: "active",
      };
      const companies = await Promise.all([membership].map(async (activeMembership: any) => {
        const company = await storage.getCompanyById(activeMembership.companyId).catch(() => undefined);
        if (!company) return null;
        const [members, canManage] = await Promise.all([
          storage.getCompanyMembers(company.id).catch(() => []),
          canManageCompany(currentUser, company.id),
        ]);
        const invites = canManage ? await storage.getCompanyInvites(company.id).catch(() => []) : [];
        const activeInvite = (invites as any[])
          .filter((invite) => invite.status === "active" && (!invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now()))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
        const pendingApprovals = canManage
          ? (members as any[]).filter((member) => member.status === "pending").map((member) => ({
              ...member,
              company,
            }))
          : [];
        return {
          company,
          membership: activeMembership,
          members,
          pendingApprovals,
          activeInvite: activeInvite ? { ...activeInvite, url: `${origin}/login?invite=${activeInvite.token}` } : null,
        };
      }));
      const cleanCompanies = companies.filter(Boolean) as any[];
      const allUsers = await storage.getAllUsers().catch(() => []);
      const userById = new Map((allUsers as any[]).map((user) => [user.id, { id: user.id, name: user.name, email: user.email, username: user.username }]));
      const pendingApprovals = cleanCompanies
        .flatMap((item) => item.pendingApprovals || [])
        .map((member) => ({ ...member, user: userById.get(member.userId), company: member.company }));
      res.json({ companies: cleanCompanies, pendingApprovals });
    } catch (error) {
      console.error("[Companies] me error:", error);
      res.status(500).json({ message: "Не удалось загрузить компании" });
    }
  });

  app.post("/api/company-invites", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const companyId = String(workspace.companyId);
      if (!(await canManageCompany(currentUser, companyId))) {
        return res.status(403).json({ message: "Недостаточно прав для приглашений" });
      }

      const oldInvites = await storage.getCompanyInvites(companyId).catch(() => []);
      await Promise.all((oldInvites as any[])
        .filter((invite) => invite.status === "active")
        .map((invite) => storage.updateCompanyInvite(invite.id, { status: "revoked" } as any).catch(() => undefined)));

      const invite = await storage.createCompanyInvite({
        companyId,
        token: crypto.randomBytes(24).toString("hex"),
        createdBy: currentUser.id,
        role: "member",
        status: "active",
        note: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as any);

      res.json({ invite, url: `${inviteOrigin(req)}/login?invite=${invite.token}` });
    } catch (error) {
      console.error("[Companies] invite error:", error);
      res.status(500).json({ message: "Не удалось создать приглашение" });
    }
  });

  app.get("/api/company-invites/resolve/:token", async (req, res) => {
    try {
      const invite = await storage.getCompanyInviteByToken(String(req.params.token || ""));
      if (!invite) return res.status(404).json({ message: "Приглашение не найдено" });
      const company = await storage.getCompanyById(invite.companyId).catch(() => undefined);
      const expired = Boolean(invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now());
      const valid = invite.status === "active" && !expired && Boolean(company);
      res.json({ invite, company, valid, expired });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось проверить приглашение" });
    }
  });

  app.get("/api/auth/onboarding-state", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const memberships = await storage.getUserCompanyMemberships(user.id).catch(() => []);
      const rows = await Promise.all((memberships as any[]).map(async (membership) => ({
        membership,
        company: await storage.getCompanyById(membership.companyId).catch(() => null),
      })));
      const activeCompanies = rows.filter((row) => row.company && row.membership.status === "active");
      const pendingCompanies = rows.filter((row) => row.company && row.membership.status !== "active");
      const permissions = Array.isArray(user.permissions) ? user.permissions : [];
      res.json({
        user: {
          id: user.id,
          name: user.name,
          onboardingCompleted: user.onboardingCompleted !== false,
          workspaceMode: user.workspaceMode || "pending",
          permissions,
        },
        isPlatformAdmin: user.role === "admin" && permissions.includes("platform:admin"),
        activeCompanies,
        pendingCompanies,
      });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось загрузить стартовое состояние" });
    }
  });

  app.post("/api/onboarding/personal", async (req, res) => {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ message: "Требуется авторизация" });
    const updated = await storage.updateUser(user.id, {
      active: true,
      onboardingCompleted: true,
      workspaceMode: "personal",
      activeWorkspaceType: "personal",
      activeCompanyId: null,
    } as any);
    req.session.activeWorkspaceType = "personal";
    req.session.activeCompanyId = null;
    res.json({ user: { ...updated, password: undefined } });
  });

  app.post("/api/onboarding/company", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ message: "Укажите название компании" });
      const company = await storage.createCompany({
        name,
        description: req.body?.description ? String(req.body.description).trim() : null,
        ownerId: user.id,
        status: "active",
        settings: { needs: Array.isArray(req.body?.needs) ? req.body.needs : [] },
      } as any);
      await storage.createCompanyMember({
        companyId: company.id,
        userId: user.id,
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      } as any);
      const updated = await storage.updateUser(user.id, {
        active: true,
        onboardingCompleted: true,
        workspaceMode: "company_owner",
        activeWorkspaceType: "company",
        activeCompanyId: company.id,
      } as any);
      req.session.activeWorkspaceType = "company";
      req.session.activeCompanyId = company.id;
      res.json({ company, user: { ...updated, password: undefined } });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось создать компанию" });
    }
  });

  app.post("/api/onboarding/join", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const token = String(req.body?.token || "").trim();
      const invite = await storage.getCompanyInviteByToken(token);
      if (!invite) return res.status(404).json({ message: "Приглашение не найдено" });
      if (invite.status !== "active" || (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now())) {
        return res.status(400).json({ message: "Приглашение не активно или срок истёк" });
      }
      const existing = await storage.getCompanyMembershipByUser(invite.companyId, user.id).catch(() => undefined);
      if (existing) {
        const activeMember = existing.status === "active"
          ? existing
          : await storage.updateCompanyMember(existing.id, { status: "active", approvedBy: invite.createdBy, joinedAt: new Date() } as any);
        const updatedUser = await storage.updateUser(user.id, {
          active: true,
          onboardingCompleted: true,
          workspaceMode: "company_member",
          activeWorkspaceType: "company",
          activeCompanyId: invite.companyId,
        } as any);
        req.session.activeWorkspaceType = "company";
        req.session.activeCompanyId = invite.companyId;
        return res.json({ membership: activeMember || existing, user: { ...updatedUser, password: undefined }, message: "Вы в компании" });
      }
      const membership = await storage.createCompanyMember({
        companyId: invite.companyId,
        userId: user.id,
        role: invite.role || "member",
        status: "active",
        invitedBy: invite.createdBy,
        approvedBy: invite.createdBy,
        joinedAt: new Date(),
      } as any);
      await storage.updateCompanyInvite(invite.id, { usedBy: user.id, usedAt: new Date() } as any).catch(() => undefined);
      const updatedUser = await storage.updateUser(user.id, {
        active: true,
        onboardingCompleted: true,
        workspaceMode: "company_member",
        activeWorkspaceType: "company",
        activeCompanyId: invite.companyId,
      } as any);
      req.session.activeWorkspaceType = "company";
      req.session.activeCompanyId = invite.companyId;
      res.json({ membership, user: { ...updatedUser, password: undefined }, message: "Вы добавлены в компанию" });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось отправить заявку" });
    }
  });

  app.post("/api/company-members/:memberId/approve", async (req, res) => {
    try {
      const user = req.user as any;
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const companyId = String(workspace.companyId);
      if (!(await canManageCompany(user, companyId))) return res.status(403).json({ message: "Нет прав на подтверждение" });
      const member = await storage.updateCompanyMember(req.params.memberId, {
        status: "active",
        approvedBy: user.id,
        joinedAt: new Date(),
      } as any);
      if (!member) return res.status(404).json({ message: "Заявка не найдена" });
      await storage.updateUser(member.userId, { active: true, onboardingCompleted: true, workspaceMode: "company_member" } as any).catch(() => undefined);
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось подтвердить сотрудника" });
    }
  });

  app.post("/api/companies/:companyId/members", async (req, res) => {
    try {
      const user = req.user as any;
      const companyId = String(req.params.companyId || "").trim();
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      if (companyId !== String(workspace.companyId)) {
        return res.status(404).json({ message: "Компания не найдена" });
      }
      const userId = String(req.body?.userId || "").trim();
      const role = String(req.body?.role || "member").trim() || "member";
      if (!userId) return res.status(400).json({ message: "Укажите пользователя" });
      if (!(await canManageCompany(user, companyId))) return res.status(403).json({ message: "Нет прав на управление компанией" });
      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ message: "Пользователь не найден" });
      const existing = await storage.getCompanyMembershipByUser(companyId, userId).catch(() => undefined);
      const member = existing
        ? await storage.updateCompanyMember(existing.id, { role, status: "active", approvedBy: user.id, joinedAt: new Date() } as any)
        : await storage.createCompanyMember({ companyId, userId, role, status: "active", invitedBy: user.id, approvedBy: user.id, joinedAt: new Date() } as any);
      await storage.updateUser(userId, { active: true, onboardingCompleted: true, workspaceMode: "company_member" } as any).catch(() => undefined);
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось добавить пользователя в компанию" });
    }
  });

  // Authentication routes
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      const inviteToken = String(req.body?.invite || req.query?.invite || "").trim();

      if (!username || !password) {
        return res.status(400).json({ message: "Укажите логин и пароль" });
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Auth] Login attempt for user: ${username}`);
      }

      // Fallback админ для теста (можно отключить ALLOW_FALLBACK_ADMIN=false)
      const allowFallbackAdmin = process.env.ALLOW_FALLBACK_ADMIN !== "false";
      const fallbackUsername = process.env.ADMIN_USERNAME || "admin";
      const fallbackPassword = process.env.ADMIN_PASSWORD || "";
      if (
        allowFallbackAdmin &&
        Boolean(fallbackPassword) &&
        username === fallbackUsername &&
        password === fallbackPassword
      ) {
        console.log("[Auth] Using fallback admin (no DB check)");
        req.session.userId = "admin-fallback";
        return res.json({
          user: {
            id: "admin-fallback",
            username: fallbackUsername,
            name: "Администратор",
            role: "admin",
            permissions: [
              "admin:panel",
              "users:manage",
              "roles:manage",
              "tasks:view",
              "tasks:create",
              "tasks:edit",
              "tasks:delete",
              "tasks:assign",
              "equipment:view",
              "equipment:create",
              "equipment:edit",
              "equipment:delete",
              "equipment:reserve",
              "events:view",
              "events:create",
              "events:edit",
              "events:delete",
              "streams:view",
              "streams:manage",
              "systems:view",
              "systems:manage",
              "settings:manage",
              "platform:admin",
            ],
            onboardingCompleted: true,
            workspaceMode: "platform_admin",
            activeWorkspaceType: null,
            activeCompanyId: null,
  },
});

      }

      // Все пользователи должны существовать в БД - никаких fallback аккаунтов
      let user: any;
      try {
        user = await withDbTimeout(
          () => storage.getUserByUsername(username),
          10000, // 10 секунд для поиска пользователя
          null
        );
      } catch (dbError: any) {
        console.error("[Auth] Database error during login:", dbError);
        return res.status(500).json({
          message: "Ошибка подключения к базе данных. Проверьте настройки DATABASE_URL в .env файле."
        });
      }

      // Флаг для отслеживания, был ли пользователь только что создан
      let adminJustCreated = false;

      // Если пользователь не найден
      if (!user) {
        // Проверяем, есть ли пользователь admin в БД
        // Первый администратор создаётся только с паролем из ADMIN_PASSWORD.
        if (fallbackPassword && username === fallbackUsername && password === fallbackPassword) {
          try {
            // Проверяем, есть ли вообще пользователи в БД
            const allUsers = await withDbTimeout(
              () => storage.getUsers(),
              10000,
              []
            );

            // Если БД пустая или админа нет - создаем админа
            const adminExists = allUsers.some((u: any) => u.username === "admin");

            if (!adminExists) {
              console.log("[Auth] Admin user not found, creating admin user");
              const newAdmin = await storage.createUser({
                username: fallbackUsername,
                password: hashPassword(fallbackPassword),
                name: "Администратор",
                email: "admin@streamstudio.local",
                role: "admin",
                permissions: [
                  "platform:admin",
                  "admin:panel",
                  "users:manage",
                  "roles:manage",
                  "tasks:view",
                  "tasks:create",
                  "tasks:edit",
                  "tasks:delete",
                  "tasks:assign",
                  "equipment:view",
                  "equipment:create",
                  "equipment:edit",
                  "equipment:delete",
                  "equipment:reserve",
                  "events:view",
                  "events:create",
                  "events:edit",
                  "events:delete",
                  "streams:view",
                  "streams:manage",
                  "systems:view",
                  "systems:manage",
                  "settings:manage",
                ],
                active: true,
              } as any);

              console.log("[Auth] Admin user created successfully, ID:", newAdmin.id);

              // Используем только что созданного пользователя - пароль уже правильный
              user = newAdmin;
              adminJustCreated = true; // Устанавливаем флаг
            } else {
              // Админ должен был быть найден, но не найден - возможно проблема с БД
              // Попробуем перезагрузить из БД
              console.log(`[Auth] Admin should exist, retrying fetch...`);
              user = await withDbTimeout(
                () => storage.getUserByUsername("admin"),
                10000,
                null
              );

              if (!user) {
                console.log(`[Auth] Admin user should exist but not found: ${username}`);
                return res.status(401).json({ message: "Неверный логин или пароль" });
              }
            }
          } catch (createError: any) {
            console.error("[Auth] Error checking/creating admin:", createError);
            return res.status(401).json({ message: "Неверный логин или пароль" });
          }
        } else {
          // Пользователь не найден, и безопасная инициализация администратора не применима.
          console.log(`[Auth] User not found: ${username}`);
          return res.status(401).json({ message: "Неверный логин или пароль" });
        }
      }

      // Проверяем пароль (хеш или legacy plain)
      if (!adminJustCreated && user) {
        const check = verifyPassword(password, user.password);
        if (!check.ok) {
          console.log(`[Auth] Invalid password for user: ${username}`);
          return res.status(401).json({ message: "Неверный логин или пароль" });
        }
        if (check.updateHash) {
          try {
            await withDbTimeout(() => storage.updateUser(user.id, { password: check.updateHash }), 5000, null);
          } catch (_) {}
        }
      }

      if (!user) {
        console.log(`[Auth] User is null after all checks: ${username}`);
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      if (user.active === false) {
        const memberships = await storage.getUserCompanyMemberships(user.id).catch(() => []);
        const hasCompanyPath = (memberships as any[]).some((member) => ["active", "pending"].includes(String(member?.status || "")));
        let invite: any = null;
        if (inviteToken) {
          invite = await storage.getCompanyInviteByToken(inviteToken).catch(() => null);
          const inviteExpired = Boolean(invite?.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now());
          if (!invite || invite.status !== "active" || inviteExpired) invite = null;
        }
        let inviteMembership: any = null;
        if (invite) {
          const existing = await storage.getCompanyMembershipByUser(invite.companyId, user.id).catch(() => undefined);
          if (existing) {
            inviteMembership = existing.status === "active"
              ? existing
              : await storage.updateCompanyMember(existing.id, { status: "active", approvedBy: invite.createdBy, joinedAt: new Date() } as any).catch(() => existing);
          } else {
            inviteMembership = await storage.createCompanyMember({
              companyId: invite.companyId,
              userId: user.id,
              role: invite.role || "member",
              status: "active",
              invitedBy: invite.createdBy,
              approvedBy: invite.createdBy,
              joinedAt: new Date(),
            } as any).catch(() => undefined);
          }
          await storage.updateCompanyInvite(invite.id, { usedBy: user.id, usedAt: new Date() } as any).catch(() => undefined);
        }
        if (invite || hasCompanyPath) {
          const activeMembership = inviteMembership?.status === "active"
            ? inviteMembership
            : (memberships as any[]).find((member) => member.status === "active");
          const updatedUser = await storage.updateUser(user.id, {
            active: true,
            onboardingCompleted: Boolean(activeMembership),
            workspaceMode: activeMembership ? "company_member" : "pending",
          } as any).catch(() => null);
          user = updatedUser || { ...user, active: true, onboardingCompleted: Boolean(activeMembership), workspaceMode: activeMembership ? "company_member" : "pending" };
        } else {
          console.log(`[Auth] User ${username} is not active`);
          return res.status(403).json({ message: "Ваш аккаунт ещё не подтверждён администратором. Если у вас есть приглашение в компанию, откройте ссылку-приглашение и войдите ещё раз." });
        }
      }

      try {
        await withDbTimeout(
          () => storage.updateUser(user.id, { lastLogin: new Date() }),
          5000,
          null
        );
      } catch (updateError) {
        console.warn("[Auth] Failed to update last login:", updateError);
      }

      req.session.userId = user.id;
      if (user.activeWorkspaceType === "company" || user.activeWorkspaceType === "personal") {
        req.session.activeWorkspaceType = user.activeWorkspaceType;
        req.session.activeCompanyId = user.activeWorkspaceType === "company"
          ? String(user.activeCompanyId || "") || null
          : null;
      } else {
        delete req.session.activeWorkspaceType;
        delete req.session.activeCompanyId;
      }
      console.log(`[Auth] Successful login for user: ${username} (${user.role})`);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          avatar: user.avatar,
          active: user.active,
          onboardingCompleted: user.onboardingCompleted,
          workspaceMode: user.workspaceMode,
          activeWorkspaceType: user.activeWorkspaceType,
          activeCompanyId: user.activeCompanyId,
        },
      });
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      res.status(500).json({
        message: error.message || "Внутренняя ошибка сервера",
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) console.warn("[Auth] Logout session destroy error:", err);
      res.clearCookie("streamdesk.sid");
      res.json({ ok: true });
    });
  });

  // Registration route - creates inactive user, requires admin approval
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, name, email } = req.body;
      const inviteToken = String(req.body?.invite || req.query?.invite || "").trim();

      if (!username || !password || !name) {
        return res.status(400).json({ message: "Заполните логин, имя и пароль" });
      }

      let existing: any;
      try {
        existing = await storage.getUserByUsername(username);
      } catch (dbError: any) {
        console.error("Database error during registration:", dbError);
        const msg = (dbError.message || "").toLowerCase();
        const isConn = /timeout|econnrefused|connection|password|auth/i.test(msg);
        return res.status(500).json({
          message: isConn
            ? "Ошибка подключения к базе данных. Проверьте, что PostgreSQL запущен и в .env указан верный DATABASE_URL (postgresql://USER:PASSWORD@HOST:PORT/DATABASE)."
            : (dbError.message || "Ошибка подключения к базе данных."),
        });
      }

      if (existing) {
        return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
      }

      if (email && String(email).trim()) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const allUsers = await storage.getAllUsers().catch(() => []);
        const emailOwner = (allUsers as any[]).find((user) => String(user.email || "").trim().toLowerCase() === normalizedEmail);
        if (emailOwner) {
          return res.status(400).json({ message: "Пользователь с такой почтой уже существует. Однофамильцы допустимы, но логин и почта должны быть уникальными." });
        }
      }

      let invite: any = null;
      if (inviteToken) {
        invite = await storage.getCompanyInviteByToken(inviteToken).catch(() => null);
        const inviteExpired = Boolean(invite?.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now());
        if (!invite || invite.status !== "active" || inviteExpired) {
          return res.status(400).json({ message: "Приглашение не активно или срок истёк" });
        }
      }

      const newUser = await storage.createUser({
        username: String(username).trim(),
        password: hashPassword(String(password)),
        name: String(name).trim(),
        email: email != null && String(email).trim() !== "" ? String(email).trim() : undefined,
        role: "employee",
        permissions: [],
        active: true,
        onboardingCompleted: Boolean(invite),
        workspaceMode: invite ? "company_member" : "pending",
        activeWorkspaceType: invite ? "company" : null,
        activeCompanyId: invite?.companyId || null,
      } as any);

      if (invite) {
        await storage.createCompanyMember({
          companyId: invite.companyId,
          userId: newUser.id,
          role: invite.role || "member",
          status: "active",
          invitedBy: invite.createdBy,
          approvedBy: invite.createdBy,
          joinedAt: new Date(),
        } as any);
        await storage.updateCompanyInvite(invite.id, { usedBy: newUser.id, usedAt: new Date() } as any).catch(() => undefined);
      }

      req.session.userId = newUser.id;
      if (invite?.companyId) {
        req.session.activeWorkspaceType = "company";
        req.session.activeCompanyId = invite.companyId;
      }

      // Уведомление всем администраторам о новой заявке
      try {
        const users = await storage.getUsers();
        const admins = users.filter((u: any) => u.role === "admin");
        const message = invite
          ? `${newUser.name} (${newUser.username}) зарегистрировался по приглашению и добавлен в компанию.`
          : `${newUser.name} (${newUser.username}) хочет присоединиться. Подтвердите в админ-панели.`;
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            title: "Новая заявка на регистрацию",
            message,
            type: "info",
          });
        }
      } catch (notifErr: any) {
        console.warn("[Auth] Failed to create admin notification:", notifErr?.message);
      }

      res.json({
        message: invite
          ? "Аккаунт создан, вы добавлены в компанию."
          : "Аккаунт создан. Выберите личный режим, создайте компанию или вступите по приглашению.",
        user: {
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          role: newUser.role,
          permissions: newUser.permissions,
          active: newUser.active,
          onboardingCompleted: newUser.onboardingCompleted,
          workspaceMode: newUser.workspaceMode,
          activeWorkspaceType: newUser.activeWorkspaceType,
          activeCompanyId: newUser.activeCompanyId,
        },
      });
    } catch (error: any) {
      console.error("Auth register error:", error);
      const msg = (error.message || "").toLowerCase();
      const code = error?.code;
      if (code === "23505" || /unique|duplicate key|already exists/i.test(msg)) {
        return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
      }
      if (/relation.*does not exist|table.*does not exist|column.*does not exist/i.test(msg)) {
        return res.status(500).json({
          message: "Схема базы данных устарела. На сервере выполните: npm run db:push (или npx drizzle-kit push), затем перезапустите приложение.",
        });
      }
      const isConn = /timeout|econnrefused|connection|password|auth|database/i.test(msg);
      res.status(500).json({
        message: isConn
          ? "Ошибка подключения к базе данных. Проверьте PostgreSQL и DATABASE_URL в .env (postgresql://USER:PASSWORD@HOST:PORT/DATABASE)."
          : (error.message || "Не удалось создать пользователя"),
      });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return;
    const currentUser = req.user as any;
    const [allSystems, allEquipment, allStreams, allEvents, visibleBoardsResult] = await Promise.all([
      withDbTimeout(() => storage.getSystems(), 3000, []),
      withDbTimeout(() => storage.getEquipment(), 3000, []),
      withDbTimeout(() => storage.getActiveStreams(), 3000, []),
      withDbTimeout(() => storage.getEventsByDateRange(
        new Date(new Date().setHours(0, 0, 0, 0)),
        new Date(new Date().setHours(23, 59, 59, 999))
      ), 3000, []),
      withDbTimeout(() => getVisibleKanbanBoardsForUser(currentUser), 3000, { boards: [], membershipMap: new Map() }),
    ]);
    const systems = workspace.type === "company"
      ? (allSystems as any[]).filter((system) => {
          const specifications = system?.specifications && typeof system.specifications === "object"
            ? system.specifications
            : {};
          return String((specifications as any).companyId || "") === String(workspace.companyId || "");
        })
      : [];
    const equipment = workspace.type === "company"
      ? (allEquipment as any[]).filter((item) =>
          equipmentCompanyId(item) === String(workspace.companyId || ""),
        )
      : [];
    const streams = workspace.type === "company"
      ? (allStreams as any[]).filter((stream) => {
          const metadata = stream?.metadata && typeof stream.metadata === "object" ? stream.metadata : {};
          return String((metadata as any).companyId || "") === String(workspace.companyId || "");
        })
      : [];
    const eventAccess = await Promise.all((allEvents as any[]).map(async (event) => {
      if (workspace.type === "company") {
        return String(event.companyId || "") === String(workspace.companyId || "") ? event : null;
      }
      if (event.companyId) return null;
      if (String(event.organizerId || "") === String(currentUser.id)) return event;
      const participants = await storage.getEventParticipants(event.id).catch(() => []);
      return (participants as any[]).some((participant) =>
        String(participant.userId || "") === String(currentUser.id),
      ) ? event : null;
    }));
    const events = eventAccess.filter(Boolean);

    const onlineSystems = systems.filter((s: any) => s.status === "online").length;
    const availableEquipment = equipment.filter((e: any) => e.status === "available").length;
    const dashboardBoards = Array.isArray((visibleBoardsResult as any).boards) ? (visibleBoardsResult as any).boards : [];
    const boardIds = dashboardBoards.map((board: any) => String(board.id)).filter(Boolean);
    const [kanbanCardGroups, kanbanListGroups] = await Promise.all([
      Promise.all(boardIds.map((boardId: string) => withDbTimeout(() => storage.getKanbanCardsByBoardId(boardId), 2000, []))),
      Promise.all(boardIds.map((boardId: string) => withDbTimeout(() => storage.getKanbanListsByBoardId(boardId), 2000, []))),
    ]);
    const kanbanCards = kanbanCardGroups.flat() as any[];
    const kanbanLists = kanbanListGroups.flat() as any[];
    const completeListIds = new Set(
      kanbanLists
        .filter((list) => list.type === "closed" || list.type === "archive")
        .map((list) => String(list.id)),
    );
    const completedKanbanCards = kanbanCards.filter((card) => completeListIds.has(String(card.listId))).length;
    const completionPercent = kanbanCards.length === 0
      ? 0
      : Math.round((completedKanbanCards / kanbanCards.length) * 100);

    res.json({
      onlineSystems: `${onlineSystems}/${systems.length}`,
      activeStreams: streams.length,
      availableEquipment: `${availableEquipment}/${equipment.length}`,
      todayEvents: events.length,
      kanbanCompletion: {
        total: kanbanCards.length,
        completed: completedKanbanCards,
        open: Math.max(kanbanCards.length - completedKanbanCards, 0),
        percent: completionPercent,
        boards: dashboardBoards.length,
      },
    });
  });

  // Manager Dashboard Stats
  app.get("/api/manager/stats", async (req, res) => {
    try {
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const currentUser = req.user as any;
      const allTasks = await withDbTimeout(() => storage.getTasks(), 5000, []);
      const taskAccess = await Promise.all((allTasks as any[]).map(async (task) =>
        (await canAccessTask(currentUser, task, workspace)) ? task : null,
      ));
      const tasks = taskAccess.filter(Boolean) as any[];
      const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
      const users = (await withDbTimeout(() => storage.getUsers(), 3000, []))
        .filter((user) => visibleUserIds.has(String(user.id)));
      const taskHistory = await Promise.all(
        tasks.map(task => storage.getTaskHistory(task.id).catch(() => []))
      ).then(results => results.flat());

      // Основные метрики
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const overdueTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < new Date() && t.status !== 'done';
      }).length;

      // Среднее время выполнения (в часах)
      const completedTasksWithHistory = tasks.filter(t => t.status === 'done');
      let totalHours = 0;
      let count = 0;
      for (const task of completedTasksWithHistory) {
        const created = task.createdAt ? new Date(task.createdAt).getTime() : 0;
        const completed = task.updatedAt ? new Date(task.updatedAt).getTime() : Date.now();
        if (created > 0) {
          totalHours += (completed - created) / (1000 * 60 * 60);
          count++;
        }
      }
      const averageCompletionTime = count > 0 ? totalHours / count : 0;

      const statusLabels: Record<string, string> = {
        todo: "К выполнению",
        in_progress: "В работе",
        done: "Готово",
        not_ready: "Бэклог",
        review: "На проверке",
      };
      const statusCounts: Record<string, number> = {};
      tasks.forEach(task => {
        const s = task.status || "todo";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });
      const tasksByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        label: statusLabels[status] || (status.length > 12 ? "Колонка" : status),
        count,
      }));

      // Задачи по приоритетам
      const priorityCounts: Record<string, number> = {};
      tasks.forEach(task => {
        const priority = task.priority || 'none';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      });
      const tasksByPriority = Object.entries(priorityCounts).map(([priority, count]) => ({
        priority,
        count,
      }));

      // Задачи по исполнителям
      const assigneeCounts: Record<string, { count: number; name: string }> = {};
      tasks.forEach(task => {
        if (task.assigneeId) {
          const user = users.find(u => u.id === task.assigneeId);
          if (!assigneeCounts[task.assigneeId]) {
            assigneeCounts[task.assigneeId] = {
              count: 0,
              name: user?.name || 'Неизвестно',
            };
          }
          assigneeCounts[task.assigneeId].count++;
        }
      });
      const tasksByAssignee = Object.entries(assigneeCounts).map(([assigneeId, data]) => ({
        assigneeId,
        assigneeName: data.name,
        count: data.count,
      })).sort((a, b) => b.count - a.count);

      // Недавняя активность
      const recentActivity = taskHistory
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 10)
        .map(history => {
          const user = users.find(u => u.id === history.userId);
          const task = tasks.find(t => t.id === history.taskId);
          return {
            id: history.id,
            action: history.action || 'updated',
            userName: user?.name || 'Неизвестно',
            taskTitle: task?.title || 'Задача удалена',
            timestamp: history.createdAt || new Date().toISOString(),
          };
        });

      // Лучшие исполнители (по выполненным задачам: status === 'done' или последняя колонка YouGile)
      const performerCounts: Record<string, { count: number; name: string; avatar?: string }> = {};
      completedTasksWithHistory.forEach(task => {
        if (task.assigneeId) {
          const user = users.find(u => u.id === task.assigneeId);
          if (!performerCounts[task.assigneeId]) {
            performerCounts[task.assigneeId] = {
              count: 0,
              name: user?.name || "Неизвестно",
              avatar: user?.avatar ?? undefined,
            };
          }
          performerCounts[task.assigneeId].count++;
        }
      });
      const topPerformers = Object.entries(performerCounts)
        .map(([userId, data]) => ({
          userId,
          userName: data.name,
          completedTasks: data.count,
          avatar: data.avatar,
        }))
        .sort((a, b) => b.completedTasks - a.completedTasks)
        .slice(0, 5);

      // Задачи требующие внимания
      const needsAttention = tasks
        .filter(t => {
          if (t.status === 'done') return false;
          if (!t.dueDate) return t.priority === 'high';
          const dueDate = new Date(t.dueDate);
          const now = new Date();
          const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return daysUntilDue < 2 || dueDate < now;
        })
        .sort((a, b) => {
          const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return aDue - bDue;
        })
        .slice(0, 10)
        .map(task => {
          const user = users.find(u => u.id === task.assigneeId);
          return {
            id: task.id,
            title: task.title,
            assigneeName: user?.name || 'Не назначено',
            dueDate: task.dueDate || new Date().toISOString(),
            priority: task.priority || 'medium',
          };
        });

      res.json({
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        averageCompletionTime,
        tasksByStatus,
        tasksByPriority,
        tasksByAssignee,
        recentActivity,
        topPerformers,
        needsAttention,
      });
    } catch (error) {
      console.error("Manager stats error:", error);
      res.status(500).json({ message: "Failed to fetch manager stats" });
    }
  });

  /** Кто может смотреть Терминал (роли). Для сайдбара и проверки доступа. */
  app.get("/api/terminal/access", (_req, res) => {
    res.json({ allowedRoles: getTerminalAllowedRoles() });
  });

  /** Настройка доступа к Терминалу (только администратор). */
  app.post("/api/terminal/access", async (req, res) => {
    const user = req.user as { role?: string } | undefined;
    if (user?.role !== "admin") {
      return res.status(403).json({ message: "Только администратор может менять доступ к Терминалу" });
    }
    const roles = Array.isArray(req.body?.allowedRoles) ? req.body.allowedRoles : [];
    const normalized = roles.filter((r: unknown) => typeof r === "string" && (r as string).trim());
    setTerminalAllowedRoles(normalized.length ? normalized : ["admin"]);
    res.json({ allowedRoles: getTerminalAllowedRoles() });
  });

  /** Логи сервера — для ролей из «Доступ к Терминалу» (Настройки). */
  app.get("/api/terminal/logs", async (req, res) => {
    const user = req.user as { id?: string; role?: string } | undefined;
    if (!user?.id) {
      return res.status(403).json({ message: "Войдите в систему для просмотра логов" });
    }
    if (!canViewTerminal(user.role)) {
      return res.status(403).json({
        message: "Доступ к Терминалу для вашей роли отключён. Обратитесь к администратору или измените настройку в Настройках → Доступ к Терминалу.",
      });
    }
    const limit = req.query.limit != null ? Math.min(100, Math.max(1, Number(req.query.limit))) : 15;
    const result = getTerminalLogs(0, limit);
    res.json({ lines: result.lines, nextIndex: result.nextIndex });
  });

  // Events
  const canAccessEventInWorkspace = async (
    user: any,
    event: any,
    workspace: WorkspaceContext,
  ) => {
    if (!user?.id || !event || !workspace.type || workspace.requiresSelection) return false;
    if (workspace.type === "company") {
      return Boolean(workspace.companyId && String(event.companyId || "") === workspace.companyId);
    }
    if (event.companyId) return false;
    if (String(event.organizerId || "") === String(user.id)) return true;
    const participants = await storage.getEventParticipants(event.id).catch(() => []);
    return (participants as any[]).some((participant) => String(participant.userId) === String(user.id));
  };

  app.get("/api/events", async (req, res) => {
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return;
    const currentUser = req.user as any;
    const { userId, start, end } = req.query;

    const candidateEvents = await withDbTimeout(async () => {
      if (userId) {
        return await storage.getEventsByUser(userId as string);
      } else if (start && end) {
        return await storage.getEventsByDateRange(new Date(start as string), new Date(end as string));
      } else {
        return await storage.getEvents();
      }
    }, 3000, []); // 3 секунды для быстрого ответа
    const events = [];
    for (const event of candidateEvents as any[]) {
      if (await canAccessEventInWorkspace(currentUser, event, workspace)) events.push(event);
    }

    // Обогащаем события участниками с именами
    try {
      const users = await storage.getUsers();
      const eventsWithParticipants = await Promise.all(events.map(async (event: any) => {
        const participants = await storage.getEventParticipants(event.id);
        const withNames = participants.map((p: any) => ({
          ...p,
          userName: users.find((u: any) => u.id === p.userId)?.name ?? "?",
        }));
        return { ...event, participants: withNames };
      }));
      return res.json(eventsWithParticipants);
    } catch (e) {
      return res.json(events);
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      console.log("[Events] Creating event...");
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const currentUser = req.user as any;
      const body = { ...(req.body || {}) };
      const participantIds: string[] = Array.isArray(body.participants)
        ? Array.from(new Set(
          body.participants
            .map((id: unknown) => String(id || "").trim())
            .filter((id: string) => Boolean(id)),
        ))
        : [];
      const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
      if (participantIds.some((userId: string) => !visibleUserIds.has(userId))) {
        return res.status(403).json({ message: "Один или несколько участников недоступны в выбранном пространстве" });
      }
      delete body.participants;
      const normalized = {
        ...body,
        companyId: workspace.type === "company" ? workspace.companyId : null,
        organizerId: currentUser.id,
        startTime: body.startTime instanceof Date ? body.startTime : new Date(body.startTime),
        endTime: body.endTime instanceof Date ? body.endTime : new Date(body.endTime),
      };
      const eventData = insertEventSchema.parse(normalized);

      console.log("[Events] Saving to database...");
      // Без withDbTimeout: чтобы видеть реальную ошибку БД (таймаут, подключение, ограничения)
      const event = await storage.createEvent(eventData);

      if (!event) {
        return res.status(500).json({
          message: "Не удалось создать событие (БД вернула пустой результат)",
          error: "createEvent returned null",
        });
      }

      // Участники: записать в event_participants и уведомить
      if (participantIds.length > 0) {
        const title = "Приглашение на событие";
        const message = `Вас пригласили на событие: ${event.title}. Примите или отклоните в календаре.`;
        for (const uid of participantIds) {
          if (uid && typeof uid === "string") {
            try {
              await storage.createEventParticipant({
                eventId: event.id,
                userId: uid,
                role: "participant",
                status: "invited",
              });
              await storage.createNotification({ userId: uid, title, message, type: "info" });
            } catch (e) {
              console.warn("[Events] Participant/notification failed for", uid, e);
            }
          }
        }
      }

      console.log("[Events] Event created successfully:", event.id);
      res.json(event);
    } catch (error: any) {
      const errMsg = error?.message ?? String(error);
      console.error("[Events] Error creating event:", errMsg);
      if (error?.stack) console.error(error.stack);
      // различаем ошибки валидации (400) и ошибки БД (500)
      const isValidation = errMsg.includes("Invalid") || error?.name === "ZodError";
      const isTimeout = /timeout|ETIMEDOUT|timed out/i.test(errMsg);
      const isConnection = /connect|ECONNREFUSED|ECONNRESET/i.test(errMsg);
      const status = isValidation ? 400 : (isTimeout || isConnection ? 503 : 500);
      const message = isConnection
        ? "База данных недоступна. Проверьте DATABASE_URL и что PostgreSQL запущен."
        : isTimeout
          ? "База данных не ответила вовремя. Проверьте нагрузку и сеть."
          : errMsg || "Не удалось создать событие";
      res.status(status).json({ message, error: errMsg });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const currentUser = req.user as any;
      const existingEvent = await storage.getEventById(id);
      if (!existingEvent) return res.status(404).json({ message: "Event not found" });
      if (!(await canAccessEventInWorkspace(currentUser, existingEvent, workspace))) {
        return res.status(403).json({ message: "Нет доступа к событию" });
      }
      const permissions = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
      if (
        String(existingEvent.organizerId) !== String(currentUser.id) &&
        !permissions.includes("events:edit")
      ) {
        return res.status(403).json({ message: "Изменять событие может только организатор" });
      }
      const body = req.body || {};
      const normalized = { ...body };
      if (body.startTime != null) normalized.startTime = body.startTime instanceof Date ? body.startTime : new Date(body.startTime);
      if (body.endTime != null) normalized.endTime = body.endTime instanceof Date ? body.endTime : new Date(body.endTime);
      delete normalized.participants;
      delete normalized.companyId;
      delete normalized.organizerId;
      const participantIds: string[] | null = Array.isArray(req.body?.participants)
        ? Array.from(new Set(
          req.body.participants
            .map((userId: unknown) => String(userId || "").trim())
            .filter((userId: string) => Boolean(userId)),
        ))
        : null;
      if (participantIds) {
        const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
        if (participantIds.some((userId: string) => !visibleUserIds.has(userId))) {
          return res.status(403).json({ message: "Один или несколько участников недоступны в выбранном пространстве" });
        }
      }
      const event = await storage.updateEvent(id, normalized);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      // Обновить список участников: удалить старых, добавить новых
      if (participantIds) {
        const existing = await storage.getEventParticipants(id);
        for (const p of existing) {
          await storage.deleteEventParticipant(id, p.userId);
        }
        const title = "Приглашение на событие";
        const message = `Вас пригласили на событие: ${event.title}. Примите или отклоните в календаре.`;
        for (const uid of participantIds) {
          if (uid && typeof uid === "string") {
            try {
              await storage.createEventParticipant({
                eventId: id,
                userId: uid,
                role: "participant",
                status: "invited",
              });
              await storage.createNotification({ userId: uid, title, message, type: "info" });
            } catch (e) {
              console.warn("[Events] Participant/notification failed for", uid, e);
            }
          }
        }
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const currentUser = req.user as any;
      const existing = await storage.getEventById(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });
      if (!(await canAccessEventInWorkspace(currentUser, existing, workspace))) {
        return res.status(403).json({ message: "Нет доступа к событию" });
      }
      const permissions = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
      if (String(existing.organizerId) !== String(currentUser.id) && !permissions.includes("events:delete")) {
        return res.status(403).json({ message: "Удалять событие может только организатор" });
      }
      const deleted = await storage.deleteEvent(id);
      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  app.get("/api/events/:eventId/participants", async (req, res) => {
    try {
      const { eventId } = req.params;
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const event = await storage.getEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (!(await canAccessEventInWorkspace(req.user, event, workspace))) {
        return res.status(403).json({ message: "Нет доступа к событию" });
      }
      const participants = await storage.getEventParticipants(eventId);
      const users = await storage.getUsers();
      const withNames = participants.map((p: any) => ({
        ...p,
        userName: users.find((u: any) => u.id === p.userId)?.name ?? "?",
      }));
      res.json(withNames);
    } catch (error) {
      res.status(500).json({ message: "Failed to get participants" });
    }
  });

  app.patch("/api/events/:eventId/participants/:participantId", async (req, res) => {
    try {
      const { eventId, participantId } = req.params;
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const event = await storage.getEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (!(await canAccessEventInWorkspace(req.user, event, workspace))) {
        return res.status(403).json({ message: "Нет доступа к событию" });
      }
      const participants = await storage.getEventParticipants(eventId);
      const participant = (participants as any[]).find((item) => String(item.id) === String(participantId));
      if (!participant) return res.status(404).json({ message: "Participant not found" });
      if (
        String(participant.userId) !== String(req.user?.id || "") &&
        String(event.organizerId) !== String(req.user?.id || "")
      ) {
        return res.status(403).json({ message: "Нет прав на изменение ответа участника" });
      }
      const { status } = req.body || {};
      if (status !== "accepted" && status !== "declined") {
        return res.status(400).json({ message: "status must be 'accepted' or 'declined'" });
      }
      const updated = await storage.updateEventParticipant(participantId, { status });
      if (!updated) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update participant" });
    }
  });

  const labelPrinterConfig = () => ({
    host: String(process.env.LABEL_PRINTER_HOST || "192.0.2.10").trim(),
    port: Number(process.env.LABEL_PRINTER_PORT || 9100),
    widthMm: Number(process.env.LABEL_WIDTH_MM || 40),
    heightMm: Number(process.env.LABEL_HEIGHT_MM || 20),
    gapMm: Number(process.env.LABEL_GAP_MM || 2),
    dpi: Number(process.env.LABEL_PRINTER_DPI || 300),
  });

  const cleanTsplText = (value: unknown, maxLength = 42) =>
    String(value ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/"/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);

  const cleanTsplBarcode = (value: unknown, fallback: unknown) => {
    const cleaned = String(value ?? "")
      .replace(/[^A-Za-z0-9_.-]+/g, "")
      .slice(0, 64);
    return cleaned || String(fallback ?? "STREAMDESK").replace(/[^A-Za-z0-9_.-]+/g, "").slice(0, 64) || "STREAMDESK";
  };

  const buildInventoryLabelTspl = (items: Array<{ value: unknown; fallback?: unknown }>) => {
    const config = labelPrinterConfig();
    const dotsPerMm = config.dpi / 25.4;
    const dot = (mm: number) => Math.round(mm * dotsPerMm);
    const widthDots = dot(config.widthMm);
    const centerX = Math.round(widthDots / 2);

    return items.map((item) => {
      const barcode = cleanTsplBarcode(item.value, item.fallback);
      const inventory = cleanTsplText(item.value || barcode, 32).replace(/[^\x20-\x7E]+/g, "").trim() || barcode;
      const barcodeX = dot(3.0);
      const barcodeY = dot(2.6);
      const barcodeHeight = dot(10.2);
      const eraseWidth = dot(13.4);
      const eraseHeight = dot(4.3);
      const eraseX = centerX - Math.round(eraseWidth / 2);
      const eraseY = barcodeY + Math.round(barcodeHeight / 2) - Math.round(eraseHeight / 2);
      const brandX = centerX - dot(4.1);
      const brandY = eraseY + dot(0.55);
      const inventoryX = Math.max(dot(1.4), centerX - Math.round(inventory.length * dot(0.86) / 2));

      return [
        `SIZE ${config.widthMm} mm,${config.heightMm} mm`,
        `GAP ${config.gapMm} mm,0 mm`,
        "DIRECTION 1",
        "REFERENCE 0,0",
        "CODEPAGE UTF-8",
        "SPEED 4",
        "DENSITY 10",
        "SET TEAR ON",
        "SET CUTTER OFF",
        "CLS",
        `BARCODE ${barcodeX},${barcodeY},"128",${barcodeHeight},0,0,2,4,"${barcode}"`,
        `ERASE ${eraseX},${eraseY},${eraseWidth},${eraseHeight}`,
        `TEXT ${brandX},${brandY},"0",0,2,2,"ОТИС"`,
        `TEXT ${inventoryX},${dot(15.4)},"0",0,1,1,"${inventory}"`,
        "PRINT 1,1",
        "",
      ].filter(Boolean).join("\r\n");
    }).join("\r\n");
  };

  const buildEquipmentLabelTspl = (items: any[]) =>
    buildInventoryLabelTspl(items.map((item) => ({
      value: item.inventoryNumber || item.barcode || item.serialNumber || item.id,
      fallback: item.id,
    })));

  const buildLabelPrinterCalibrationTspl = () => {
    const config = labelPrinterConfig();
    return [
      `SIZE ${config.widthMm} mm,${config.heightMm} mm`,
      `GAP ${config.gapMm} mm,0 mm`,
      "DIRECTION 1",
      "REFERENCE 0,0",
      "GAPDETECT",
      "FORMFEED",
      "",
    ].join("\r\n");
  };

  const sendToLabelPrinter = (payload: string | Buffer) => new Promise<void>((resolve, reject) => {
    const config = labelPrinterConfig();
    const socket = new net.Socket();
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
    let settled = false;
    const done = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => {
      socket.destroy();
      done(new Error(`Не удалось подключиться к принтеру ${config.host}:${config.port} за 5 секунд`));
    }, 5000);

    socket.once("error", (error) => done(error));
    socket.connect(config.port, config.host, () => {
      socket.write(buffer, () => {
        socket.end(() => done());
      });
    });
  });

  type EquipmentContextError = Error & { statusCode?: number; code?: string };
  type ValidatedPhysicalDestination = {
    provided: boolean;
    locationId: string | null;
    manualLocation: string | null;
    displayName: string | null;
    location?: any;
  };
  type ValidatedEquipmentWorkContext = {
    provided: boolean;
    projectId: string | null;
    kanbanCardIds: string[];
    project?: any;
    cards: any[];
  };

  const equipmentContextError = (statusCode: number, code: string, message: string): EquipmentContextError =>
    Object.assign(new Error(message), { statusCode, code });

  const equipmentCompanyId = (item: any) => String(equipmentSpecs(item).companyId || "").trim();
  const equipmentCommentPayloadSchema = z.object({
    content: z.string().trim().max(10_000).default(""),
  });

  const getLegacyEquipmentComments = (item: any) => {
    const legacy = equipmentSpecs(item).equipmentComments;
    if (!Array.isArray(legacy)) return [];
    return legacy
      .map((comment: any, index: number) => {
        const content = String(comment?.content || comment?.text || "").trim();
        if (!content) return null;
        const rawCreatedAt = String(comment?.createdAt || "").trim();
        const createdAt = rawCreatedAt && !Number.isNaN(new Date(rawCreatedAt).getTime())
          ? new Date(rawCreatedAt)
          : new Date(0);
        const legacyId = String(comment?.id || index).trim() || String(index);
        return {
          id: `legacy:${item.id}:${legacyId}`,
          equipmentId: String(item.id),
          companyId: equipmentCompanyId(item),
          userId: String(comment?.authorId || comment?.userId || ""),
          authorName: String(comment?.authorName || "Сотрудник").trim() || "Сотрудник",
          content,
          attachments: [],
          createdAt,
          updatedAt: createdAt,
          legacy: true,
        };
      })
      .filter(Boolean) as any[];
  };

  const getEquipmentActivityComments = async (item: any, preloadedComments?: any[]) => {
    const companyId = equipmentCompanyId(item);
    const stored = preloadedComments ?? await storage.getEquipmentComments(String(item.id)).catch(() => []);
    const scopedStored = (stored as any[]).filter((comment) =>
      String(comment.companyId || "") === companyId,
    );
    return [...getLegacyEquipmentComments(item), ...scopedStored]
      .sort((left, right) =>
        new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime(),
      )
      .map((comment) => ({
        ...comment,
        attachments: Array.isArray(comment.attachments) ? comment.attachments : [],
      }));
  };

  const getEquipmentActivitySummary = async (item: any, preloadedComments?: any[]) => {
    const comments = await getEquipmentActivityComments(item, preloadedComments);
    const latest = comments[comments.length - 1];
    return {
      commentCount: comments.length,
      attachmentCount: comments.reduce(
        (total, comment) => total + (Array.isArray(comment.attachments) ? comment.attachments.length : 0),
        0,
      ),
      latestAt: latest?.createdAt || null,
      latestAuthorName: latest?.authorName || null,
    };
  };

  const withoutLegacyEquipmentComments = (item: any) => {
    const specifications = equipmentSpecs(item);
    delete specifications.equipmentComments;
    return specifications;
  };

  const readPhysicalDestinationInput = (body: any) => {
    const nested = body?.physicalDestination && typeof body.physicalDestination === "object"
      ? body.physicalDestination
      : null;
    const provided = Boolean(nested) ||
      Object.prototype.hasOwnProperty.call(body || {}, "locationId") ||
      Object.prototype.hasOwnProperty.call(body || {}, "manualLocation");
    return {
      provided,
      locationId: String(nested?.locationId ?? body?.locationId ?? "").trim(),
      manualLocation: String(nested?.manualLocation ?? body?.manualLocation ?? "").trim(),
    };
  };

  const validatePhysicalDestination = async (input: {
    body: any;
    user: any;
    companyId: string;
    required?: boolean;
    existingLocationId?: string | null;
  }): Promise<ValidatedPhysicalDestination> => {
    const requested = readPhysicalDestinationInput(input.body);
    if (!requested.provided && !input.required) {
      return { provided: false, locationId: null, manualLocation: null, displayName: null };
    }
    if (requested.locationId && requested.manualLocation) {
      throw equipmentContextError(
        400,
        "EQUIPMENT_DESTINATION_CONFLICT",
        "Выберите площадку или укажите место вручную, но не оба варианта одновременно",
      );
    }
    if (!requested.locationId && !requested.manualLocation) {
      if (input.required) {
        throw equipmentContextError(400, "EQUIPMENT_DESTINATION_REQUIRED", "Укажите, где будет находиться оборудование");
      }
      return { provided: true, locationId: null, manualLocation: null, displayName: null };
    }
    if (requested.manualLocation.length > 500) {
      throw equipmentContextError(400, "EQUIPMENT_MANUAL_LOCATION_TOO_LONG", "Ручное описание места не должно превышать 500 символов");
    }
    if (requested.manualLocation) {
      return {
        provided: true,
        locationId: null,
        manualLocation: requested.manualLocation,
        displayName: requested.manualLocation,
      };
    }

    const location = await storage.getCustomLocationById(requested.locationId).catch(() => undefined);
    if (!location) {
      throw equipmentContextError(400, "EQUIPMENT_LOCATION_NOT_FOUND", "Выбранная площадка не найдена");
    }
    if (!(await canAccessLocation(input.user, location))) {
      throw equipmentContextError(403, "EQUIPMENT_LOCATION_FORBIDDEN", "Нет доступа к выбранной площадке");
    }
    if (!input.companyId || String(location.companyId || "") !== input.companyId) {
      throw equipmentContextError(403, "EQUIPMENT_LOCATION_COMPANY_MISMATCH", "Площадка принадлежит другой компании");
    }
    if (location.archivedAt && String(input.existingLocationId || "") !== String(location.id)) {
      throw equipmentContextError(409, "EQUIPMENT_LOCATION_ARCHIVED", "Архивную площадку нельзя выбрать для новой выдачи или связи");
    }
    return {
      provided: true,
      locationId: String(location.id),
      manualLocation: null,
      displayName: String(location.name),
      location,
    };
  };

  const readEquipmentWorkContextInput = (body: any) => {
    const nested = body?.workContext && typeof body.workContext === "object" ? body.workContext : null;
    const rawCardIds = nested?.kanbanCardIds ?? body?.kanbanCardIds ??
      (body?.kanbanCardId ? [body.kanbanCardId] : []);
    const provided = Boolean(nested) ||
      Object.prototype.hasOwnProperty.call(body || {}, "projectId") ||
      Object.prototype.hasOwnProperty.call(body || {}, "kanbanCardIds") ||
      Object.prototype.hasOwnProperty.call(body || {}, "kanbanCardId");
    return {
      provided,
      projectId: String(nested?.projectId ?? body?.projectId ?? "").trim(),
      kanbanCardIds: Array.isArray(rawCardIds)
        ? Array.from(new Set(rawCardIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)))
        : [],
    };
  };

  const validateEquipmentWorkContext = async (input: {
    body: any;
    user: any;
    companyId: string;
  }): Promise<ValidatedEquipmentWorkContext> => {
    const requested = readEquipmentWorkContextInput(input.body);
    if (!requested.provided) {
      return { provided: false, projectId: null, kanbanCardIds: [], cards: [] };
    }
    if (requested.kanbanCardIds.length > 20) {
      throw equipmentContextError(400, "EQUIPMENT_TOO_MANY_KANBAN_CARDS", "Можно привязать не более 20 карточек Kanban V2");
    }

    let project = requested.projectId
      ? await storage.getProjectById(requested.projectId).catch(() => undefined)
      : undefined;
    if (requested.projectId && !project) {
      throw equipmentContextError(400, "EQUIPMENT_PROJECT_NOT_FOUND", "Выбранный проект не найден");
    }
    if (project) {
      if (!(await canAccessProject(input.user, project))) {
        throw equipmentContextError(403, "EQUIPMENT_PROJECT_FORBIDDEN", "Нет доступа к выбранному проекту");
      }
      if (!input.companyId || String(project.companyId || "") !== input.companyId) {
        throw equipmentContextError(403, "EQUIPMENT_PROJECT_COMPANY_MISMATCH", "Проект принадлежит другой компании");
      }
    }

    const cards: any[] = [];
    const cardProjectIds = new Set<string>();
    for (const cardId of requested.kanbanCardIds) {
      const card = await storage.getKanbanCardById(cardId).catch(() => undefined);
      if (!card) {
        throw equipmentContextError(400, "EQUIPMENT_KANBAN_CARD_NOT_FOUND", "Одна из выбранных карточек Kanban V2 не найдена");
      }
      const access = await getKanbanBoardAccess(input.user, String(card.boardId)).catch(() => null);
      if (!access) {
        throw equipmentContextError(403, "EQUIPMENT_KANBAN_CARD_FORBIDDEN", "Одна из выбранных карточек Kanban V2 недоступна");
      }
      if (!access.board.companyId || String(access.board.companyId) !== input.companyId) {
        throw equipmentContextError(403, "EQUIPMENT_KANBAN_COMPANY_MISMATCH", "Карточка Kanban V2 принадлежит другой компании");
      }
      const cardProjectId = String(card.projectId || access.board.projectId || "").trim();
      if (cardProjectId) cardProjectIds.add(cardProjectId);
      cards.push({ ...card, board: access.board, effectiveProjectId: cardProjectId || null });
    }

    if (cardProjectIds.size > 1) {
      throw equipmentContextError(409, "EQUIPMENT_KANBAN_PROJECT_CONFLICT", "Выбранные карточки относятся к разным проектам");
    }
    const derivedProjectId = Array.from(cardProjectIds)[0] || "";
    if (requested.projectId && derivedProjectId && requested.projectId !== derivedProjectId) {
      throw equipmentContextError(409, "EQUIPMENT_PROJECT_CARD_CONFLICT", "Выбранные карточки Kanban V2 не относятся к выбранному проекту");
    }
    if (requested.projectId && cards.some((card) => !card.effectiveProjectId)) {
      throw equipmentContextError(409, "EQUIPMENT_PROJECT_CARD_CONFLICT", "Для выбранного проекта доступны только его карточки Kanban V2");
    }
    const projectId = requested.projectId || derivedProjectId || "";
    if (!project && projectId) {
      project = await storage.getProjectById(projectId).catch(() => undefined);
      if (!project || String(project.companyId || "") !== input.companyId) {
        throw equipmentContextError(403, "EQUIPMENT_PROJECT_COMPANY_MISMATCH", "Проект карточки недоступен в компании оборудования");
      }
    }

    return {
      provided: true,
      projectId: projectId || null,
      kanbanCardIds: requested.kanbanCardIds,
      project,
      cards,
    };
  };

  const serializeEquipmentContext = async (item: any, preloadedComments?: any[]) => {
    const companyId = equipmentCompanyId(item);
    const [links, location, activitySummary, category, storageLocation, companyStorageLocations] = await Promise.all([
      storage.getEquipmentContextLinks(String(item.id)).catch(() => []),
      item.locationId
        ? storage.getCustomLocationById(String(item.locationId)).catch(() => undefined)
        : Promise.resolve(undefined),
      getEquipmentActivitySummary(item, preloadedComments),
      item.categoryId
        ? storage.getEquipmentCategoryById(String(item.categoryId)).catch(() => undefined)
        : Promise.resolve(undefined),
      item.storageLocationId
        ? storage.getWarehouseStorageLocationById(String(item.storageLocationId)).catch(() => undefined)
        : Promise.resolve(undefined),
      item.storageLocationId && companyId
        ? storage.getWarehouseStorageLocations(companyId).catch(() => [])
        : Promise.resolve([]),
    ]);
    const enrichedLinks = await Promise.all((links as any[]).map(async (link) => {
      const [project, card, request] = await Promise.all([
        link.projectId ? storage.getProjectById(String(link.projectId)).catch(() => undefined) : undefined,
        link.kanbanCardId ? storage.getKanbanCardById(String(link.kanbanCardId)).catch(() => undefined) : undefined,
        link.checkoutRequestId
          ? storage.getEquipmentCheckoutRequestById(String(link.checkoutRequestId)).catch(() => undefined)
          : undefined,
      ]);
      return {
        ...link,
        project: project ? { id: project.id, name: project.name, status: project.status } : null,
        kanbanCard: card ? { id: card.id, title: card.title, boardId: card.boardId, projectId: card.projectId } : null,
        checkoutRequest: request ? { id: request.id, status: request.status, requestType: request.requestType } : null,
      };
    }));
    const storedInWarehouse = String(item.status || "") === "available" &&
      Boolean(item.storageLocationId || String(item.storageLocation || "").trim());
    const effectiveLocationId = storedInWarehouse ? null : item.locationId || null;
    const manualLocation = storedInWarehouse
      ? null
      : String(item.manualLocation || "").trim() || null;
    const legacyLocation = !effectiveLocationId && !manualLocation && !storedInWarehouse && String(item.location || "").trim()
      ? String(item.location).trim()
      : null;
    const storageLocationsById = new Map(
      (companyStorageLocations as any[]).map((entry) => [String(entry.id), entry]),
    );
    const storagePath = storageLocation
      ? warehouseStorageLocationPath(storageLocation, storageLocationsById)
      : null;
    return {
      ...item,
      ...(storedInWarehouse ? {
        location: null,
        locationId: null,
        manualLocation: null,
      } : {}),
      specifications: withoutLegacyEquipmentComments(item),
      activitySummary,
      category: category ? {
        id: category.id,
        name: category.name,
        parentId: category.parentId || null,
        archived: Boolean(category.archivedAt),
      } : null,
      warehouseStorageLocation: storageLocation ? {
        id: storageLocation.id,
        name: storageLocation.name,
        code: storageLocation.code || null,
        type: storageLocation.type,
        parentId: storageLocation.parentId || null,
        path: storagePath || storageLocation.name,
        archived: Boolean(storageLocation.archivedAt),
      } : null,
      physicalDestination: {
        locationId: effectiveLocationId,
        locationName: storedInWarehouse ? null : location?.name || null,
        manualLocation,
        displayName: storedInWarehouse ? null : location?.name || manualLocation || legacyLocation,
        archived: storedInWarehouse ? false : Boolean(location?.archivedAt),
        legacyLocation,
      },
      workContext: {
        links: enrichedLinks,
        activeLinks: enrichedLinks.filter((link) => link.active),
      },
    };
  };

  const serializeEquipmentCheckoutRequest = async (request: any) => {
    const [location, project] = await Promise.all([
      request.locationId
        ? storage.getCustomLocationById(String(request.locationId)).catch(() => undefined)
        : Promise.resolve(undefined),
      request.projectId
        ? storage.getProjectById(String(request.projectId)).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    const cardIds = Array.from(new Set([
      ...(Array.isArray(request.kanbanCardIds) ? request.kanbanCardIds : []),
      request.kanbanCardId,
    ].map((id) => String(id || "").trim()).filter(Boolean)));
    const cards = (await Promise.all(cardIds.map((id) =>
      storage.getKanbanCardById(id).catch(() => undefined),
    ))).filter(Boolean);
    return {
      ...request,
      physicalDestination: {
        locationId: request.locationId || null,
        locationName: location?.name || null,
        manualLocation: request.manualLocation || null,
        displayName: location?.name || request.manualLocation || request.location || null,
        archived: Boolean(location?.archivedAt),
      },
      workContext: {
        project: project ? { id: project.id, name: project.name, status: project.status } : null,
        kanbanCards: cards.map((card: any) => ({
          id: card.id,
          title: card.title,
          boardId: card.boardId,
          projectId: card.projectId,
        })),
      },
    };
  };

  const deactivateCurrentEquipmentCheckoutContext = async (equipmentId: string) => {
    const links = (await storage.getEquipmentContextLinks(equipmentId).catch(() => []))
      .filter((link: any) => link.active && link.source === "checkout");
    if (links.some((link: any) => !link.checkoutRequestId)) {
      await storage.deactivateEquipmentContextLinks(equipmentId, {
        source: "checkout",
        checkoutRequestId: null,
      });
    }
    const requestIds = Array.from(new Set(
      links.map((link: any) => String(link.checkoutRequestId || "").trim()).filter(Boolean),
    ));
    for (const requestId of requestIds) {
      const request = await storage.getEquipmentCheckoutRequestById(requestId).catch(() => undefined);
      if (request?.status === "approved") {
        await storage.deactivateEquipmentContextLinks(equipmentId, {
          source: "checkout",
          checkoutRequestId: requestId,
        });
      }
    }
  };

  const publishEquipmentContextChanged = (
    item: any,
    action: DiscussionRealtimeEvent["action"] = "updated",
    recordId = String(item.id),
    version: string | Date | null = new Date(),
  ) => {
    publishDiscussionEvent(createDiscussionRealtimeEvent({
      channel: `equipment:${item.id}:comments`,
      action,
      recordId,
      version,
    }));
    const companyId = equipmentCompanyId(item);
    if (companyId) {
      publishDiscussionEvent(createDiscussionRealtimeEvent({
        channel: `company:${companyId}`,
        action,
        recordId: companyId,
        version,
      }));
    }
  };

  const publishWarehouseSettingsChanged = (companyId: string, recordId: string) => {
    publishDiscussionEvent(createDiscussionRealtimeEvent({
      channel: `company:${companyId}`,
      action: "updated",
      recordId,
      version: new Date(),
    }));
  };

  const canManageWarehouseSettings = async (user: any, companyId: string) => {
    if (["admin", "manager", "tech_director"].includes(String(user?.role || ""))) return true;
    if (user?.workspaceMode === "company_owner") return true;
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    if (permissions.includes("equipment:edit")) return true;
    return canManageCompany(user, companyId);
  };

  const warehouseCategoryInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    parentId: z.string().trim().min(1).nullable().optional(),
    position: z.coerce.number().int().min(0).max(100_000).optional(),
  });

  const warehouseStorageLocationTypes = ["room", "zone", "rack", "shelf", "case", "bin", "other"] as const;
  const warehouseStorageLocationInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().max(80).nullable().optional(),
    type: z.enum(warehouseStorageLocationTypes).default("other"),
    parentId: z.string().trim().min(1).nullable().optional(),
    position: z.coerce.number().int().min(0).max(100_000).optional(),
  });

  const normalizedWarehouseSettingName = (value: unknown) =>
    String(value || "").trim().toLocaleLowerCase("ru-RU");

  const getWarehouseCompanyContext = async (
    req: express.Request,
    res: express.Response,
    manage = false,
  ) => {
    const workspace = await requireActiveCompanyWorkspace(req, res);
    if (!workspace) return null;
    if (manage && !(await canManageWarehouseSettings(req.user, String(workspace.companyId)))) {
      res.status(403).json({ message: "Нет прав на изменение настроек склада" });
      return null;
    }
    return { companyId: String(workspace.companyId) };
  };

  const validateWarehouseCategoryParent = async (
    companyId: string,
    parentId: string | null | undefined,
    currentId?: string,
  ) => {
    if (!parentId) return null;
    if (parentId === currentId) {
      throw equipmentContextError(400, "WAREHOUSE_CATEGORY_PARENT_SELF", "Категория не может быть родителем самой себя");
    }
    const parent = await storage.getEquipmentCategoryById(parentId).catch(() => undefined);
    if (!parent || String(parent.companyId) !== companyId) {
      throw equipmentContextError(400, "WAREHOUSE_CATEGORY_PARENT_NOT_FOUND", "Родительская категория не найдена");
    }
    if (parent.parentId) {
      throw equipmentContextError(400, "WAREHOUSE_CATEGORY_DEPTH_EXCEEDED", "Поддерживаются только категории и один уровень подкатегорий");
    }
    if (parent.archivedAt) {
      throw equipmentContextError(409, "WAREHOUSE_CATEGORY_PARENT_ARCHIVED", "Нельзя добавить подкатегорию в архивную категорию");
    }
    return parent;
  };

  const ensureWarehouseCategoryNameAvailable = async (input: {
    companyId: string;
    name: string;
    parentId?: string | null;
    excludeId?: string;
  }) => {
    const categories = await storage.getEquipmentCategories(input.companyId);
    const duplicate = categories.find((category) =>
      category.id !== input.excludeId &&
      String(category.parentId || "") === String(input.parentId || "") &&
      normalizedWarehouseSettingName(category.name) === normalizedWarehouseSettingName(input.name),
    );
    if (duplicate) {
      throw equipmentContextError(409, "WAREHOUSE_CATEGORY_DUPLICATE", "Категория с таким названием уже существует на этом уровне");
    }
  };

  const getWarehouseStorageDepth = (
    locationId: string,
    locationsById: Map<string, any>,
    visited = new Set<string>(),
  ): number => {
    if (!locationId || visited.has(locationId)) return 0;
    visited.add(locationId);
    const location = locationsById.get(locationId);
    return location?.parentId
      ? 1 + getWarehouseStorageDepth(String(location.parentId), locationsById, visited)
      : 1;
  };

  const validateWarehouseStorageParent = async (
    companyId: string,
    parentId: string | null | undefined,
    currentId?: string,
  ) => {
    if (!parentId) return null;
    if (parentId === currentId) {
      throw equipmentContextError(400, "WAREHOUSE_STORAGE_PARENT_SELF", "Место хранения не может быть родителем самого себя");
    }
    const locations = await storage.getWarehouseStorageLocations(companyId);
    const locationsById = new Map(locations.map((location) => [String(location.id), location]));
    const parent = locationsById.get(parentId);
    if (!parent) {
      throw equipmentContextError(400, "WAREHOUSE_STORAGE_PARENT_NOT_FOUND", "Родительское место хранения не найдено");
    }
    if (parent.archivedAt) {
      throw equipmentContextError(409, "WAREHOUSE_STORAGE_PARENT_ARCHIVED", "Нельзя добавить место внутрь архивного раздела");
    }
    let cursor: any = parent;
    const visited = new Set<string>();
    while (cursor) {
      const cursorId = String(cursor.id);
      if (cursorId === currentId) {
        throw equipmentContextError(409, "WAREHOUSE_STORAGE_CYCLE", "Нельзя переместить место хранения внутрь его дочернего раздела");
      }
      if (visited.has(cursorId)) break;
      visited.add(cursorId);
      cursor = cursor.parentId ? locationsById.get(String(cursor.parentId)) : null;
    }
    if (getWarehouseStorageDepth(parentId, locationsById) >= 6) {
      throw equipmentContextError(400, "WAREHOUSE_STORAGE_DEPTH_EXCEEDED", "Поддерживается не более шести уровней хранения");
    }
    return parent;
  };

  const ensureWarehouseStorageNameAvailable = async (input: {
    companyId: string;
    name: string;
    parentId?: string | null;
    excludeId?: string;
  }) => {
    const locations = await storage.getWarehouseStorageLocations(input.companyId);
    const duplicate = locations.find((location) =>
      location.id !== input.excludeId &&
      String(location.parentId || "") === String(input.parentId || "") &&
      normalizedWarehouseSettingName(location.name) === normalizedWarehouseSettingName(input.name),
    );
    if (duplicate) {
      throw equipmentContextError(409, "WAREHOUSE_STORAGE_DUPLICATE", "Место хранения с таким названием уже существует на этом уровне");
    }
  };

  const warehouseStorageLocationPath = (
    location: any,
    locationsById: Map<string, any>,
  ) => {
    const parts: string[] = [];
    const visited = new Set<string>();
    let cursor = location;
    while (cursor && !visited.has(String(cursor.id))) {
      visited.add(String(cursor.id));
      parts.unshift(String(cursor.name || "").trim());
      cursor = cursor.parentId ? locationsById.get(String(cursor.parentId)) : null;
    }
    return parts.filter(Boolean).join(" / ");
  };

  const validateEquipmentCategorySelection = async (input: {
    body: any;
    companyId: string;
    existingCategoryId?: string | null;
  }) => {
    const provided = Object.prototype.hasOwnProperty.call(input.body || {}, "categoryId");
    if (!provided) return { provided: false, categoryId: null, name: null };
    const categoryId = String(input.body?.categoryId || "").trim();
    if (!categoryId) return { provided: true, categoryId: null, name: null };
    const category = await storage.getEquipmentCategoryById(categoryId).catch(() => undefined);
    if (!category || String(category.companyId) !== input.companyId) {
      throw equipmentContextError(400, "EQUIPMENT_CATEGORY_NOT_FOUND", "Выбранная категория не найдена");
    }
    if (category.archivedAt && categoryId !== String(input.existingCategoryId || "")) {
      throw equipmentContextError(409, "EQUIPMENT_CATEGORY_ARCHIVED", "Архивную категорию нельзя выбрать");
    }
    return { provided: true, categoryId, name: String(category.name), category };
  };

  const validateEquipmentStorageSelection = async (input: {
    body: any;
    companyId: string;
    existingStorageLocationId?: string | null;
  }) => {
    const provided = Object.prototype.hasOwnProperty.call(input.body || {}, "storageLocationId");
    if (!provided) return { provided: false, storageLocationId: null, displayName: null };
    const storageLocationId = String(input.body?.storageLocationId || "").trim();
    if (!storageLocationId) {
      return { provided: true, storageLocationId: null, displayName: null };
    }
    const location = await storage.getWarehouseStorageLocationById(storageLocationId).catch(() => undefined);
    if (!location || String(location.companyId) !== input.companyId) {
      throw equipmentContextError(400, "WAREHOUSE_STORAGE_NOT_FOUND", "Выбранное место хранения не найдено");
    }
    if (location.archivedAt && storageLocationId !== String(input.existingStorageLocationId || "")) {
      throw equipmentContextError(409, "WAREHOUSE_STORAGE_ARCHIVED", "Архивное место хранения нельзя выбрать");
    }
    const locations = await storage.getWarehouseStorageLocations(input.companyId);
    const locationsById = new Map(locations.map((entry) => [String(entry.id), entry]));
    return {
      provided: true,
      storageLocationId,
      displayName: warehouseStorageLocationPath(location, locationsById) || String(location.name),
      location,
    };
  };

  const getKanbanCardEquipmentAccess = async (
    user: any,
    boardId: string,
    cardId: string,
  ) => {
    const access = await getKanbanBoardAccess(user, boardId);
    if (!access) return null;
    const card = await storage.getKanbanCardById(cardId).catch(() => undefined);
    if (!card || String(card.boardId) !== String(access.board.id)) return null;
    return { ...access, card };
  };

  const getEquipmentRequestCardIds = (request: any) =>
    Array.from(new Set([
      ...(Array.isArray(request?.kanbanCardIds) ? request.kanbanCardIds : []),
      request?.kanbanCardId,
    ].map((id) => String(id || "").trim()).filter(Boolean)));

  const getEquipmentLinkWorkflowStatus = (
    source: string,
    request: any,
    link: any,
    item: any,
  ) => {
    if (source === "manual") return "linked";
    const requestStatus = String(request?.status || "").trim();
    if (requestStatus === "pending") return "requested";
    if (requestStatus === "rejected") return "rejected";
    if (requestStatus === "cancelled") return "cancelled";
    if (requestStatus === "approved") {
      const expectedReturnAt = request?.expectedReturnAt ? new Date(request.expectedReturnAt) : null;
      const projectId = String(link?.projectId || request?.projectId || "").trim();
      const projectBundle = projectId
        ? projectEquipmentBundles.find((bundle) =>
            String(bundle.projectId) === projectId &&
            bundle.equipmentIds.map(String).includes(String(item?.id || "")),
          )
        : undefined;
      const bundleReturnAt = projectBundle?.returnDate
        ? new Date(`${projectBundle.returnDate}T23:59:59.999`)
        : null;
      const checkoutStillActive = link ? Boolean(link.active) : item?.status === "in-use";
      if (
        checkoutStillActive &&
        (
          (
            expectedReturnAt &&
            !Number.isNaN(expectedReturnAt.getTime()) &&
            expectedReturnAt.getTime() < Date.now()
          ) ||
          (
            bundleReturnAt &&
            !Number.isNaN(bundleReturnAt.getTime()) &&
            bundleReturnAt.getTime() < Date.now()
          )
        )
      ) {
        return "overdue";
      }
      if (link && link.active === false) return "returned";
      if (item?.status === "in-use") return "issued";
      return "approved";
    }
    return requestStatus || "requested";
  };

  const buildKanbanBoardEquipmentLinks = async (user: any, board: any) => {
    const cards = await storage.getKanbanCardsByBoardId(board.id).catch(() => []);
    const cardIds = new Set((cards as any[]).map((card) => String(card.id)));
    const [allLinks, allRequests] = await Promise.all([
      storage.getEquipmentContextLinks().catch(() => []),
      storage.getEquipmentCheckoutRequests().catch(() => []),
    ]);
    const links = (allLinks as any[]).filter((link) =>
      link.kanbanCardId && cardIds.has(String(link.kanbanCardId)),
    );
    const requests = (allRequests as any[]).filter((request) =>
      getEquipmentRequestCardIds(request).some((cardId) => cardIds.has(cardId)),
    );
    const requestById = new Map(requests.map((request) => [String(request.id), request]));
    const equipmentIds = Array.from(new Set([
      ...links.map((link) => String(link.equipmentId || "")).filter(Boolean),
      ...requests.map((request) => String(request.equipmentId || "")).filter(Boolean),
    ]));
    const equipmentRows = (await Promise.all(equipmentIds.map((equipmentId) =>
      storage.getEquipmentById(equipmentId).catch(() => undefined),
    ))).filter(Boolean) as any[];
    const equipmentById = new Map(equipmentRows.map((item) => [String(item.id), item]));
    const rowsByCard = new Map<string, Map<string, any>>();

    const addRow = (cardId: string, key: string, row: any) => {
      const cardRows = rowsByCard.get(cardId) ?? new Map<string, any>();
      const existing = cardRows.get(key);
      if (
        !existing ||
        new Date(row.linkedAt || 0).getTime() >= new Date(existing.linkedAt || 0).getTime()
      ) {
        cardRows.set(key, row);
      }
      rowsByCard.set(cardId, cardRows);
    };

    for (const link of links) {
      const cardId = String(link.kanbanCardId);
      const item = equipmentById.get(String(link.equipmentId));
      if (
        !item ||
        item.status === "archived" ||
        !board.companyId ||
        equipmentCompanyId(item) !== String(board.companyId)
      ) {
        continue;
      }
      if (link.source === "manual" && !link.active) continue;
      const request = link.checkoutRequestId
        ? requestById.get(String(link.checkoutRequestId))
        : undefined;
      const key = link.source === "checkout"
        ? `checkout:${String(link.checkoutRequestId || link.id)}:${item.id}`
        : `manual:${item.id}`;
      addRow(cardId, key, {
        id: key,
        linkId: link.id,
        cardId,
        projectId: link.projectId || null,
        source: link.source,
        active: Boolean(link.active),
        workflowStatus: getEquipmentLinkWorkflowStatus(link.source, request, link, item),
        linkedAt: link.createdAt || null,
        equipment: {
          id: item.id,
          name: item.name,
          model: item.model || null,
          status: item.status,
          operabilityStatus: item.operabilityStatus || null,
          inventoryNumber: item.inventoryNumber || null,
        },
        request: request ? {
          id: request.id,
          status: request.status,
          requestType: request.requestType,
          requestedBy: request.requestedBy,
          quantity: request.quantity,
          location: request.location || null,
          note: request.note || null,
          createdAt: request.createdAt || null,
          reviewedAt: request.reviewedAt || null,
        } : null,
      });
    }

    for (const request of requests) {
      const item = equipmentById.get(String(request.equipmentId));
      if (
        !item ||
        item.status === "archived" ||
        !board.companyId ||
        equipmentCompanyId(item) !== String(board.companyId)
      ) {
        continue;
      }
      for (const cardId of getEquipmentRequestCardIds(request)) {
        if (!cardIds.has(cardId)) continue;
        const key = `checkout:${request.id}:${item.id}`;
        const existing = rowsByCard.get(cardId)?.get(key);
        if (existing) continue;
        addRow(cardId, key, {
          id: key,
          linkId: null,
          cardId,
          projectId: request.projectId || null,
          source: "checkout",
          active: ["pending", "approved"].includes(String(request.status || "")),
          workflowStatus: getEquipmentLinkWorkflowStatus("checkout", request, null, item),
          linkedAt: request.createdAt || null,
          equipment: {
            id: item.id,
            name: item.name,
            model: item.model || null,
            status: item.status,
            operabilityStatus: item.operabilityStatus || null,
            inventoryNumber: item.inventoryNumber || null,
          },
          request: {
            id: request.id,
            status: request.status,
            requestType: request.requestType,
            requestedBy: request.requestedBy,
            quantity: request.quantity,
            location: request.location || null,
            note: request.note || null,
            createdAt: request.createdAt || null,
            reviewedAt: request.reviewedAt || null,
          },
        });
      }
    }

    const response: Record<string, any[]> = {};
    for (const card of cards as any[]) {
      response[String(card.id)] = Array.from(rowsByCard.get(String(card.id))?.values() || [])
        .sort((left, right) =>
          new Date(right.linkedAt || 0).getTime() - new Date(left.linkedAt || 0).getTime(),
        );
    }
    return response;
  };

  app.get("/api/kanban/boards/:boardId/equipment-links", async (req, res) => {
    try {
      const access = await getKanbanBoardAccess(req.user, req.params.boardId);
      if (!access) return res.status(404).json({ message: "Доска не найдена" });
      res.json({ cards: await buildKanbanBoardEquipmentLinks(req.user, access.board) });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось загрузить оборудование доски" });
    }
  });

  app.post("/api/kanban/boards/:boardId/cards/:cardId/equipment-links", async (req, res) => {
    try {
      const access = await getKanbanCardEquipmentAccess(
        req.user,
        req.params.boardId,
        req.params.cardId,
      );
      if (!access) return res.status(404).json({ message: "Карточка не найдена" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Нет прав на изменение карточки" });
      }
      if (!access.board.companyId) {
        return res.status(403).json({ message: "Warehouse недоступен в личном пространстве" });
      }
      const equipmentId = String(req.body?.equipmentId || "").trim();
      if (!equipmentId) return res.status(400).json({ message: "Выберите оборудование" });
      const item = await storage.getEquipmentById(equipmentId).catch(() => undefined);
      if (!item || item.status === "archived") {
        return res.status(404).json({ message: "Оборудование не найдено" });
      }
      await ensureEquipmentCompanyAccess(req.user, item);
      if (!(await canManageEquipmentKit(req.user, item))) {
        return res.status(403).json({ message: "Нет прав на изменение связей оборудования" });
      }

      const effectiveProjectId = String(
        access.card.projectId || access.board.projectId || "",
      ).trim();
      const currentLinks = (await storage.getEquipmentContextLinks(item.id).catch(() => []))
        .filter((link: any) => link.active && link.source === "manual");
      const existingCardIds = Array.from(new Set(
        currentLinks.map((link: any) => String(link.kanbanCardId || "").trim()).filter(Boolean),
      ));
      const existingProjectIds = Array.from(new Set(
        currentLinks.map((link: any) => String(link.projectId || "").trim()).filter(Boolean),
      ));
      if (
        existingProjectIds.some((projectId) => projectId !== effectiveProjectId) ||
        (existingProjectIds.length > 0 && !effectiveProjectId)
      ) {
        return res.status(409).json({
          message: "Оборудование уже связано с другим проектом. Измените рабочий контекст в Warehouse.",
          code: "EQUIPMENT_PROJECT_CARD_CONFLICT",
        });
      }
      if (!existingCardIds.includes(String(access.card.id))) {
        await storage.replaceEquipmentContextLinks({
          equipmentId: item.id,
          source: "manual",
          projectId: effectiveProjectId || null,
          kanbanCardIds: [...existingCardIds, String(access.card.id)],
          createdByUserId: req.user?.id || null,
        });
        publishEquipmentContextChanged(item);
      }

      const cards = await buildKanbanBoardEquipmentLinks(req.user, access.board);
      res.json({ items: cards[String(access.card.id)] || [] });
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось прикрепить оборудование",
        code: error?.code,
      });
    }
  });

  app.delete("/api/kanban/boards/:boardId/cards/:cardId/equipment-links/:equipmentId", async (req, res) => {
    try {
      const access = await getKanbanCardEquipmentAccess(
        req.user,
        req.params.boardId,
        req.params.cardId,
      );
      if (!access) return res.status(404).json({ message: "Карточка не найдена" });
      if (!canEditKanbanBoard(access)) {
        return res.status(403).json({ message: "Нет прав на изменение карточки" });
      }
      const item = await storage.getEquipmentById(req.params.equipmentId).catch(() => undefined);
      if (!item || item.status === "archived") {
        return res.status(404).json({ message: "Оборудование не найдено" });
      }
      await ensureEquipmentCompanyAccess(req.user, item);
      if (!(await canManageEquipmentKit(req.user, item))) {
        return res.status(403).json({ message: "Нет прав на изменение связей оборудования" });
      }

      const currentLinks = (await storage.getEquipmentContextLinks(item.id).catch(() => []))
        .filter((link: any) => link.active && link.source === "manual");
      const linkedToCard = currentLinks.some((link: any) =>
        String(link.kanbanCardId || "") === String(access.card.id),
      );
      if (linkedToCard) {
        const remainingCardIds = Array.from(new Set(
          currentLinks
            .map((link: any) => String(link.kanbanCardId || "").trim())
            .filter((cardId: string) => Boolean(cardId) && cardId !== String(access.card.id)),
        ));
        const projectId = remainingCardIds.length > 0
          ? String(access.card.projectId || access.board.projectId || "").trim() || null
          : null;
        await storage.replaceEquipmentContextLinks({
          equipmentId: item.id,
          source: "manual",
          projectId,
          kanbanCardIds: remainingCardIds,
          createdByUserId: req.user?.id || null,
        });
        publishEquipmentContextChanged(item);
      }

      const cards = await buildKanbanBoardEquipmentLinks(req.user, access.board);
      res.json({ items: cards[String(access.card.id)] || [] });
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось открепить оборудование",
        code: error?.code,
      });
    }
  });

  const syncEquipmentCategoryFallbacks = async (companyId: string) => {
    const categories = await storage.getEquipmentCategories(companyId);
    const categoriesById = new Map(categories.map((category) => [String(category.id), category]));
    const equipmentItems = await storage.getEquipment().catch(() => []);
    await Promise.all((equipmentItems as any[])
      .filter((item) => equipmentCompanyId(item) === companyId && item.categoryId)
      .map((item) => {
        const category = categoriesById.get(String(item.categoryId));
        if (!category || String(item.type || "") === String(category.name)) return Promise.resolve(undefined);
        return storage.updateEquipment(String(item.id), { type: category.name } as any);
      }));
  };

  const syncEquipmentStorageFallbacks = async (companyId: string) => {
    const locations = await storage.getWarehouseStorageLocations(companyId);
    const locationsById = new Map(locations.map((location) => [String(location.id), location]));
    const equipmentItems = await storage.getEquipment().catch(() => []);
    await Promise.all((equipmentItems as any[])
      .filter((item) => equipmentCompanyId(item) === companyId && item.storageLocationId)
      .map((item) => {
        const location = locationsById.get(String(item.storageLocationId));
        if (!location) return Promise.resolve(undefined);
        const nextDisplayName = warehouseStorageLocationPath(location, locationsById);
        if (String(item.storageLocation || "") === nextDisplayName) return Promise.resolve(undefined);
        return storage.updateEquipment(String(item.id), { storageLocation: nextDisplayName } as any);
      }));
  };

  app.get("/api/warehouse/categories", async (req, res) => {
    try {
      const context = await getWarehouseCompanyContext(req, res);
      if (!context) return;
      const categories = await storage.getEquipmentCategories(context.companyId);
      const includeArchived = String(req.query.archive || "") === "all";
      const equipmentItems = await storage.getEquipment().catch(() => []);
      const usage = new Map<string, number>();
      for (const item of equipmentItems as any[]) {
        if (equipmentCompanyId(item) !== context.companyId || !item.categoryId) continue;
        usage.set(String(item.categoryId), (usage.get(String(item.categoryId)) || 0) + 1);
      }
      res.json(categories
        .filter((category) => includeArchived || !category.archivedAt)
        .map((category) => ({
          ...category,
          equipmentCount: usage.get(String(category.id)) || 0,
          childCount: categories.filter((child) => String(child.parentId || "") === String(category.id)).length,
        })));
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось загрузить категории склада",
        code: error?.code,
      });
    }
  });

  app.post("/api/warehouse/categories", async (req, res) => {
    try {
      const context = await getWarehouseCompanyContext(req, res, true);
      if (!context) return;
      const input = warehouseCategoryInputSchema.parse(req.body || {});
      const parentId = input.parentId || null;
      await validateWarehouseCategoryParent(context.companyId, parentId);
      await ensureWarehouseCategoryNameAvailable({
        companyId: context.companyId,
        name: input.name,
        parentId,
      });
      const categories = await storage.getEquipmentCategories(context.companyId);
      const siblings = categories.filter((category) =>
        String(category.parentId || "") === String(parentId || ""),
      );
      const category = await storage.createEquipmentCategory({
        companyId: context.companyId,
        name: input.name,
        parentId,
        position: input.position ?? siblings.length,
      });
      publishWarehouseSettingsChanged(context.companyId, category.id);
      res.status(201).json(category);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте название и уровень категории" });
      }
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось создать категорию",
        code: error?.code,
      });
    }
  });

  app.put("/api/warehouse/categories/:id", async (req, res) => {
    try {
      const context = await getWarehouseCompanyContext(req, res, true);
      if (!context) return;
      const current = await storage.getEquipmentCategoryById(String(req.params.id)).catch(() => undefined);
      if (!current || String(current.companyId) !== context.companyId) {
        return res.status(404).json({ message: "Категория не найдена" });
      }
      const input = warehouseCategoryInputSchema.parse({
        name: req.body?.name ?? current.name,
        parentId: Object.prototype.hasOwnProperty.call(req.body || {}, "parentId")
          ? req.body.parentId || null
          : current.parentId || null,
        position: req.body?.position ?? current.position,
      });
      const parentId = input.parentId || null;
      if (parentId) {
        const hasChildren = (await storage.getEquipmentCategories(context.companyId))
          .some((category) => String(category.parentId || "") === String(current.id));
        if (hasChildren) {
          throw equipmentContextError(
            409,
            "WAREHOUSE_CATEGORY_HAS_CHILDREN",
            "Сначала переместите или архивируйте подкатегории",
          );
        }
      }
      await validateWarehouseCategoryParent(context.companyId, parentId, current.id);
      await ensureWarehouseCategoryNameAvailable({
        companyId: context.companyId,
        name: input.name,
        parentId,
        excludeId: current.id,
      });
      const wantsArchived = Object.prototype.hasOwnProperty.call(req.body || {}, "archived")
        ? Boolean(req.body.archived)
        : Boolean(current.archivedAt);
      if (!wantsArchived && parentId) {
        await validateWarehouseCategoryParent(context.companyId, parentId, current.id);
      }
      const updated = await storage.updateEquipmentCategory(current.id, {
        name: input.name,
        parentId,
        position: input.position ?? current.position,
        archivedAt: wantsArchived ? current.archivedAt || new Date() : null,
      });
      if (wantsArchived && !current.parentId) {
        const children = (await storage.getEquipmentCategories(context.companyId))
          .filter((category) => String(category.parentId || "") === String(current.id));
        await Promise.all(children.map((category) =>
          storage.updateEquipmentCategory(category.id, { archivedAt: category.archivedAt || new Date() }),
        ));
      }
      await syncEquipmentCategoryFallbacks(context.companyId);
      publishWarehouseSettingsChanged(context.companyId, current.id);
      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные категории" });
      }
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось обновить категорию",
        code: error?.code,
      });
    }
  });

  app.get("/api/warehouse/storage-locations", async (req, res) => {
    try {
      const context = await getWarehouseCompanyContext(req, res);
      if (!context) return;
      const locations = await storage.getWarehouseStorageLocations(context.companyId);
      const locationsById = new Map(locations.map((location) => [String(location.id), location]));
      const includeArchived = String(req.query.archive || "") === "all";
      const equipmentItems = await storage.getEquipment().catch(() => []);
      const usage = new Map<string, number>();
      for (const item of equipmentItems as any[]) {
        if (equipmentCompanyId(item) !== context.companyId || !item.storageLocationId) continue;
        usage.set(String(item.storageLocationId), (usage.get(String(item.storageLocationId)) || 0) + 1);
      }
      res.json(locations
        .filter((location) => includeArchived || !location.archivedAt)
        .map((location) => ({
          ...location,
          path: warehouseStorageLocationPath(location, locationsById),
          equipmentCount: usage.get(String(location.id)) || 0,
          childCount: locations.filter((child) => String(child.parentId || "") === String(location.id)).length,
        })));
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось загрузить места хранения",
        code: error?.code,
      });
    }
  });

  app.post("/api/warehouse/storage-locations", async (req, res) => {
    try {
      const context = await getWarehouseCompanyContext(req, res, true);
      if (!context) return;
      const input = warehouseStorageLocationInputSchema.parse(req.body || {});
      const parentId = input.parentId || null;
      await validateWarehouseStorageParent(context.companyId, parentId);
      await ensureWarehouseStorageNameAvailable({
        companyId: context.companyId,
        name: input.name,
        parentId,
      });
      const locations = await storage.getWarehouseStorageLocations(context.companyId);
      const siblings = locations.filter((location) =>
        String(location.parentId || "") === String(parentId || ""),
      );
      const location = await storage.createWarehouseStorageLocation({
        companyId: context.companyId,
        name: input.name,
        code: input.code || null,
        type: input.type,
        parentId,
        position: input.position ?? siblings.length,
      });
      publishWarehouseSettingsChanged(context.companyId, location.id);
      res.status(201).json(location);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте название, тип и уровень места хранения" });
      }
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось создать место хранения",
        code: error?.code,
      });
    }
  });

  app.put("/api/warehouse/storage-locations/:id", async (req, res) => {
    try {
      const context = await getWarehouseCompanyContext(req, res, true);
      if (!context) return;
      const current = await storage.getWarehouseStorageLocationById(String(req.params.id)).catch(() => undefined);
      if (!current || String(current.companyId) !== context.companyId) {
        return res.status(404).json({ message: "Место хранения не найдено" });
      }
      const input = warehouseStorageLocationInputSchema.parse({
        name: req.body?.name ?? current.name,
        code: Object.prototype.hasOwnProperty.call(req.body || {}, "code")
          ? req.body.code || null
          : current.code || null,
        type: req.body?.type ?? current.type,
        parentId: Object.prototype.hasOwnProperty.call(req.body || {}, "parentId")
          ? req.body.parentId || null
          : current.parentId || null,
        position: req.body?.position ?? current.position,
      });
      const parentId = input.parentId || null;
      await validateWarehouseStorageParent(context.companyId, parentId, current.id);
      await ensureWarehouseStorageNameAvailable({
        companyId: context.companyId,
        name: input.name,
        parentId,
        excludeId: current.id,
      });
      const wantsArchived = Object.prototype.hasOwnProperty.call(req.body || {}, "archived")
        ? Boolean(req.body.archived)
        : Boolean(current.archivedAt);
      const updated = await storage.updateWarehouseStorageLocation(current.id, {
        name: input.name,
        code: input.code || null,
        type: input.type,
        parentId,
        position: input.position ?? current.position,
        archivedAt: wantsArchived ? current.archivedAt || new Date() : null,
      });
      if (wantsArchived) {
        const allLocations = await storage.getWarehouseStorageLocations(context.companyId);
        const pending = [String(current.id)];
        const descendants: any[] = [];
        while (pending.length > 0) {
          const parent = pending.shift()!;
          const children = allLocations.filter((location) => String(location.parentId || "") === parent);
          descendants.push(...children);
          pending.push(...children.map((child) => String(child.id)));
        }
        await Promise.all(descendants.map((location) =>
          storage.updateWarehouseStorageLocation(location.id, {
            archivedAt: location.archivedAt || new Date(),
          }),
        ));
      }
      await syncEquipmentStorageFallbacks(context.companyId);
      publishWarehouseSettingsChanged(context.companyId, current.id);
      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные места хранения" });
      }
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Не удалось обновить место хранения",
        code: error?.code,
      });
    }
  });

  // Equipment
  app.get("/api/equipment", async (req, res) => {
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return;
    if (workspace.type !== "company" || !workspace.companyId) return res.json([]);
    const { status } = req.query;

    const equipment = await withDbTimeout(async () => {
      if (status) {
        return await storage.getEquipmentByStatus(status as string);
      } else {
        return await storage.getEquipment();
      }
    }, 3000, []); // 3 секунды для быстрого ответа

    const list = Array.isArray(equipment) ? equipment : [];
    const scopedList = list.filter((item: any) =>
      String(equipmentSpecs(item).companyId || "").trim() === String(workspace.companyId),
    );
    const visibleList = status ? scopedList : scopedList.filter((item: any) => item.status !== "archived");
    const storedComments = await storage
      .getEquipmentCommentsByEquipmentIds(visibleList.map((item: any) => String(item.id)))
      .catch(() => []);
    const commentsByEquipmentId = new Map<string, any[]>();
    for (const comment of storedComments as any[]) {
      const equipmentId = String(comment.equipmentId || "");
      const current = commentsByEquipmentId.get(equipmentId) || [];
      current.push(comment);
      commentsByEquipmentId.set(equipmentId, current);
    }
    res.json(await Promise.all(visibleList.map((item: any) =>
      serializeEquipmentContext(item, commentsByEquipmentId.get(String(item.id)) || []),
    )));
  });

  app.get("/api/equipment/:id", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "Некорректный идентификатор оборудования" });

      const item = await storage.getEquipmentById(id).catch((error) => {
        console.error("[Equipment] Failed to load equipment details:", error);
        throw error;
      });
      if (!item || item.status === "archived") {
        return res.status(404).json({ message: "Оборудование не найдено" });
      }
      await ensureEquipmentCompanyAccess(req.user, item);

      const operabilityStatus = String((item as any).operabilityStatus || "").trim() ||
        (item.status === "broken" ? "broken" : item.status === "maintenance" ? "on_repair" : "working");
      res.json(await serializeEquipmentContext({ ...item, operabilityStatus }));
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      const message = error?.message || "Не удалось загрузить оборудование";
      console.error("[Equipment] Details error:", message);
      res.status(500).json({ message });
    }
  });

  app.get("/api/equipment/:id/comments", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const item = await storage.getEquipmentById(String(req.params.id || "")).catch(() => undefined);
      if (!item || item.status === "archived") {
        return res.status(404).json({ message: "Оборудование не найдено" });
      }
      await ensureEquipmentCompanyAccess(currentUser, item);
      res.json(await getEquipmentActivityComments(item));
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(500).json({ message: "Не удалось загрузить активность оборудования" });
    }
  });

  app.post("/api/equipment/:id/comments", equipmentCommentMessageUpload, async (req, res) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    let filesPersisted = false;
    const cleanupUploadedFiles = async () => {
      await Promise.all(uploadedFiles
        .map((file) => file.path)
        .filter(Boolean)
        .map((filePath) => fs.unlink(filePath).catch(() => undefined)));
    };
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) {
        await cleanupUploadedFiles();
        return res.status(401).json({ message: "Требуется авторизация" });
      }
      const item = await storage.getEquipmentById(String(req.params.id || "")).catch(() => undefined);
      if (!item || item.status === "archived") {
        await cleanupUploadedFiles();
        return res.status(404).json({ message: "Оборудование не найдено" });
      }
      await ensureEquipmentCompanyAccess(currentUser, item);
      if ((req as any).equipmentCommentAttachmentRejected) {
        await cleanupUploadedFiles();
        return res.status(400).json({ message: "Формат одного или нескольких файлов не поддерживается" });
      }
      const payload = equipmentCommentPayloadSchema.parse(req.body || {});
      if (!payload.content && uploadedFiles.length === 0) {
        await cleanupUploadedFiles();
        return res.status(400).json({ message: "Добавьте текст или поддерживаемый файл до 10 МБ" });
      }
      const createdAt = new Date();
      const attachments = uploadedFiles.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.originalname,
        fileUrl: `/uploads/equipment-comments/${file.filename}`,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedByUserId: currentUser.id,
        uploadedByName: currentUser.name || currentUser.username || null,
        createdAt: createdAt.toISOString(),
      }));
      const comment = insertEquipmentCommentSchema.parse({
        equipmentId: item.id,
        companyId: equipmentCompanyId(item),
        userId: currentUser.id,
        authorName: String(currentUser.name || currentUser.username || "Пользователь"),
        content: payload.content,
        attachments,
      });
      const created = await storage.createEquipmentComment(comment);
      filesPersisted = true;
      publishEquipmentContextChanged(item, "created", created.id, created.createdAt);
      res.status(201).json({
        ...created,
        attachments: Array.isArray(created.attachments) ? created.attachments : [],
      });
    } catch (error: any) {
      if (!filesPersisted) await cleanupUploadedFiles();
      if (sendEquipmentKitActionError(res, error)) return;
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Некорректный комментарий" });
      }
      res.status(500).json({ message: "Не удалось добавить комментарий" });
    }
  });

  app.post("/api/equipment/labels/print", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const ids = Array.isArray(req.body?.equipmentIds)
        ? req.body.equipmentIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
        : [];

      if (ids.length === 0) {
        return res.status(400).json({ message: "Выберите оборудование для печати этикеток" });
      }
      if (ids.length > 100) {
        return res.status(400).json({ message: "За один раз можно напечатать до 100 этикеток" });
      }

      const items = (await Promise.all(ids.map((id: string) => storage.getEquipmentById(id).catch(() => undefined))))
        .filter(Boolean) as any[];

      if (items.length === 0) {
        return res.status(404).json({ message: "Оборудование для печати не найдено" });
      }

      const payload = buildEquipmentLabelTspl(items);
      await sendToLabelPrinter(payload);
      const config = labelPrinterConfig();
      console.log(`[LabelPrinter] sent ${items.length} native inventory label(s), ${Buffer.byteLength(payload, "utf8")} bytes to ${config.host}:${config.port}`);
      res.json({
        success: true,
        count: items.length,
        printer: `${config.host}:${config.port}`,
        bytes: Buffer.byteLength(payload, "utf8"),
        mode: "native-tspl",
      });
    } catch (error: any) {
      console.error("[LabelPrinter] print failed:", error?.message || error);
      res.status(500).json({
        message: error?.message || "Не удалось отправить этикетки на принтер",
      });
    }
  });

  app.post("/api/equipment/labels/print-bitmaps", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const labels = Array.isArray(req.body?.labels) ? req.body.labels : [];
      if (labels.length === 0) {
        return res.status(400).json({ message: "Нет этикеток для печати" });
      }
      if (labels.length > 100) {
        return res.status(400).json({ message: "За один раз можно напечатать до 100 этикеток" });
      }

      const config = labelPrinterConfig();
      const payloadParts: Buffer[] = [];
      let totalBitmapBytes = 0;
      const bitmapRatios: string[] = [];

      for (const label of labels) {
        const widthBytes = Number(label?.widthBytes || 0);
        const heightDots = Number(label?.heightDots || 0);
        const xDots = Math.max(0, Math.min(2000, Math.round(Number(label?.xDots || 0))));
        const yDots = Math.max(0, Math.min(2000, Math.round(Number(label?.yDots || 0))));
        const bitmapBase64 = String(label?.bitmapBase64 || "");
        if (!Number.isFinite(widthBytes) || widthBytes <= 0 || widthBytes > 256) {
          return res.status(400).json({ message: "Некорректная ширина этикетки" });
        }
        if (!Number.isFinite(heightDots) || heightDots <= 0 || heightDots > 1200) {
          return res.status(400).json({ message: "Некорректная высота этикетки" });
        }

        const bitmap = Buffer.from(bitmapBase64, "base64");
        if (bitmap.length !== widthBytes * heightDots) {
          return res.status(400).json({ message: "Некорректный bitmap этикетки" });
        }

        let setBits = 0;
        for (const byte of bitmap) {
          let bits = byte;
          while (bits) {
            bits &= bits - 1;
            setBits += 1;
          }
        }
        bitmapRatios.push((setBits / (bitmap.length * 8)).toFixed(3));
        totalBitmapBytes += bitmap.length;

        const header = [
          `SIZE ${config.widthMm} mm,${config.heightMm} mm`,
          `GAP ${config.gapMm} mm,0 mm`,
          "DIRECTION 1",
          "REFERENCE 0,0",
          "SPEED 4",
          "DENSITY 10",
          "SET TEAR ON",
          "SET CUTTER OFF",
          "CLS",
          `BITMAP ${xDots},${yDots},${widthBytes},${heightDots},0,`,
        ].join("\r\n");

        payloadParts.push(Buffer.from(header, "ascii"));
        payloadParts.push(bitmap);
        payloadParts.push(Buffer.from("\r\nPRINT 1,1\r\n", "ascii"));
      }

      const payload = Buffer.concat(payloadParts);
      await sendToLabelPrinter(payload);
      console.log(`[LabelPrinter] sent ${labels.length} bitmap label(s), ${totalBitmapBytes} bitmap bytes to ${config.host}:${config.port}; setBitRatios=${bitmapRatios.join(",")}`);
      res.json({
        success: true,
        count: labels.length,
        printer: `${config.host}:${config.port}`,
        bytes: payload.length,
        mode: "bitmap-tspl",
      });
    } catch (error: any) {
      console.error("[LabelPrinter] bitmap print failed:", error?.message || error);
      res.status(500).json({
        message: error?.message || "Не удалось отправить PNG-этикетку на принтер",
      });
    }
  });

  app.post("/api/equipment/labels/calibrate", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const payload = buildLabelPrinterCalibrationTspl();
      await sendToLabelPrinter(payload);
      const config = labelPrinterConfig();
      console.log(`[LabelPrinter] calibration sent, ${Buffer.byteLength(payload, "ascii")} bytes to ${config.host}:${config.port}`);
      res.json({
        success: true,
        printer: `${config.host}:${config.port}`,
        bytes: Buffer.byteLength(payload, "ascii"),
      });
    } catch (error: any) {
      console.error("[LabelPrinter] calibration failed:", error?.message || error);
      res.status(500).json({
        message: error?.message || "Не удалось откалибровать принтер",
      });
    }
  });

  app.post("/api/equipment", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      console.log("[Equipment] Creating equipment...");
      const body = req.body || {};
      // Приводим пустые строки к undefined для опциональных полей, чтобы схема не падала.
      const name = body.name && String(body.name).trim();
      if (!name) {
        return res.status(400).json({ message: "Укажите название оборудования" });
      }
      const currentUser = req.user as any;
      const incomingSpecs = body.specifications && typeof body.specifications === "object" ? body.specifications as Record<string, unknown> : {};
      const targetCompanyId = String(workspace.companyId);
      const physicalDestination = await validatePhysicalDestination({
        body,
        user: currentUser,
        companyId: targetCompanyId,
      });
      const workContext = await validateEquipmentWorkContext({
        body,
        user: currentUser,
        companyId: targetCompanyId,
      });
      const categorySelection = await validateEquipmentCategorySelection({
        body,
        companyId: targetCompanyId,
      });
      const storageSelection = await validateEquipmentStorageSelection({
        body,
        companyId: targetCompanyId,
      });
      const sanitized: Record<string, unknown> = {
        name,
        type: categorySelection.categoryId
          ? categorySelection.name
          : (body.type && String(body.type).trim()) || "other",
        categoryId: categorySelection.provided ? categorySelection.categoryId || undefined : undefined,
        model: body.model && String(body.model).trim() ? String(body.model).trim() : undefined,
        serialNumber: body.serialNumber && String(body.serialNumber).trim() ? String(body.serialNumber).trim() : undefined,
        inventoryNumber: body.inventoryNumber && String(body.inventoryNumber).trim() ? String(body.inventoryNumber).trim() : await generateEquipmentInventoryNumber(body.type || "other"),
        barcode: body.barcode && String(body.barcode).trim() ? String(body.barcode).trim() : undefined,
        specifications: {
          ...incomingSpecs,
          createdByUserId: String((incomingSpecs as any).createdByUserId || currentUser?.id || ""),
          companyId: targetCompanyId,
        },
        notes: body.notes && String(body.notes).trim() ? String(body.notes).trim() : undefined,
        status: body.status && String(body.status).trim() ? String(body.status).trim() : "available",
        operabilityStatus: body.operabilityStatus && String(body.operabilityStatus).trim()
          ? String(body.operabilityStatus).trim()
          : body.status === "broken"
            ? "broken"
            : body.status === "maintenance"
              ? "on_repair"
              : "working",
        location: physicalDestination.provided
          ? physicalDestination.displayName || undefined
          : body.location && String(body.location).trim() ? String(body.location).trim() : undefined,
        locationId: physicalDestination.provided ? physicalDestination.locationId || undefined : undefined,
        manualLocation: physicalDestination.provided ? physicalDestination.manualLocation || undefined : undefined,
        storageLocation: storageSelection.storageLocationId
          ? storageSelection.displayName
          : body.storageLocation && String(body.storageLocation).trim()
            ? String(body.storageLocation).trim()
            : undefined,
        storageLocationId: storageSelection.provided
          ? storageSelection.storageLocationId || undefined
          : undefined,
        responsiblePerson: body.responsiblePerson && String(body.responsiblePerson).trim() ? String(body.responsiblePerson).trim() : undefined,
        responsibleContact: body.responsibleContact && String(body.responsibleContact).trim() ? String(body.responsibleContact).trim() : undefined,
        photos: Array.isArray(body.photos) ? body.photos : [],
      };
      if (sanitized.barcode) {
        const existingItems = await storage.getEquipment().catch(() => []);
        const barcode = String(sanitized.barcode).trim();
        const barcodeTaken = (existingItems as any[]).some((item) => String(item.barcode || "").trim().toLowerCase() === barcode.toLowerCase());
        if (barcodeTaken) {
          const fallback = String(sanitized.inventoryNumber || "").trim();
          const fallbackTaken = fallback && (existingItems as any[]).some((item) => String(item.barcode || "").trim().toLowerCase() === fallback.toLowerCase());
          sanitized.barcode = fallback && !fallbackTaken ? fallback : `${fallback || equipmentInventoryPrefix(sanitized.type)}_${Date.now().toString(36)}`;
        }
      }
      const equipmentData = insertEquipmentSchema.parse(sanitized);

      if (equipmentData.barcode) {
        console.log("[Equipment] Barcode creation attempted:", equipmentData.barcode);
      }

      console.log("[Equipment] Saving to database...");
      const equipment = await storage.createEquipment(equipmentData);
      if (workContext.provided) {
        await storage.replaceEquipmentContextLinks({
          equipmentId: equipment.id,
          source: "manual",
          projectId: workContext.projectId,
          kanbanCardIds: workContext.kanbanCardIds,
          createdByUserId: currentUser.id,
        });
      }
      console.log("[Equipment] Equipment created successfully:", equipment.id);
      publishEquipmentContextChanged(equipment);
      res.json(await serializeEquipmentContext(equipment));
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error("[Equipment] Error creating equipment:", msg);
      if (error?.stack) console.error(error.stack);
      const isDbError = /timeout|econnrefused|connection|ECONNREFUSED|password|auth/i.test(msg);
      const userMessage = isDbError
        ? "Ошибка подключения к базе данных. Проверьте, что PostgreSQL запущен и DATABASE_URL в .env указан верно (postgresql://USER:PASSWORD@HOST:PORT/DATABASE)."
        : (msg || "Не удалось добавить оборудование");
      res.status(error?.statusCode || (isDbError ? 500 : 400)).json({
        message: userMessage,
        code: error?.code,
        error: msg,
      });
    }
  });

  app.put("/api/equipment/:id", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }
      const { id } = req.params;
      const body = req.body || {};
      let existing = await storage.getEquipmentById(id).catch(() => undefined);
      if (!existing) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      await ensureEquipmentCompanyAccess(req.user, existing);
      const directWorkflowFields = new Set([
        "status",
        "assignedTo",
        "lastUsed",
        "location",
        "locationId",
        "manualLocation",
        "physicalDestination",
        "storageLocation",
        "storageLocationId",
        "workContext",
        "kitExtraction",
      ]);
      const changesWorkflowState =
        (Object.prototype.hasOwnProperty.call(body, "status") && String(body.status || "") !== String(existing.status || "")) ||
        (Object.prototype.hasOwnProperty.call(body, "assignedTo") && String(body.assignedTo || "") !== String(existing.assignedTo || ""));
      const hasMaintainedFieldEdit = Object.keys(body).some((key) => !directWorkflowFields.has(key));
      if (
        (hasMaintainedFieldEdit || (!changesWorkflowState && (body.physicalDestination || body.workContext))) &&
        !(await canManageEquipmentKit(req.user, existing))
      ) {
        return res.status(403).json({ message: "Нет прав на редактирование оборудования" });
      }
      const originalParentBundleId = String(equipmentSpecs(existing).parentBundleId || "").trim();
      await getEquipmentKitContext(existing);
      const refreshedExisting = await storage.getEquipmentById(id).catch(() => undefined);
      if (refreshedExisting) existing = refreshedExisting;
      const orphanedMembershipRecovered = Boolean(originalParentBundleId) &&
        !String(equipmentSpecs(existing).parentBundleId || "").trim();

      // Only admins can update/promote barcodes (Cr-codes)
      if (body.barcode) {
        // In production, check user session/role here
        // For now, allow but log for security
        console.log("Barcode update/promotion attempted:", body.barcode);
      }

      const currentOperability = String((existing as any).operabilityStatus || "").trim() ||
        (existing.status === "broken" ? "broken" : existing.status === "maintenance" ? "on_repair" : "working");
      if (body.status === "in-use" && currentOperability !== "working") {
        return res.status(400).json({
          message: currentOperability === "broken"
            ? "Оборудование неисправно и недоступно для выдачи"
            : "Оборудование находится в ремонте и недоступно для выдачи",
        });
      }

      const companyId = equipmentCompanyId(existing);
      const physicalDestination = await validatePhysicalDestination({
        body,
        user: req.user,
        companyId,
        existingLocationId: existing.locationId,
      });
      const workContext = await validateEquipmentWorkContext({
        body,
        user: req.user,
        companyId,
      });
      const categorySelection = await validateEquipmentCategorySelection({
        body,
        companyId,
        existingCategoryId: existing.categoryId,
      });
      const storageSelection = await validateEquipmentStorageSelection({
        body,
        companyId,
        existingStorageLocationId: existing.storageLocationId,
      });
      const clearsPhysicalDestinationOnReturn =
        (existing.status === "in-use" && String(body.status || "") === "available") ||
        (
          existing.status === "in-use" &&
          Object.prototype.hasOwnProperty.call(body, "assignedTo") &&
          !String(body.assignedTo || "").trim()
        );
      const updateData: Record<string, unknown> = {};
      const copyFields = [
        "name",
        "type",
        "categoryId",
        "model",
        "serialNumber",
        "inventoryNumber",
        "barcode",
        "specifications",
        "notes",
        "status",
        "operabilityStatus",
        "location",
        "storageLocation",
        "storageLocationId",
        "responsiblePerson",
        "responsibleContact",
        "assignedTo",
        "photos",
      ];
      for (const field of copyFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updateData[field] = body[field];
        }
      }
      if (physicalDestination.provided) {
        updateData.locationId = physicalDestination.locationId;
        updateData.manualLocation = physicalDestination.manualLocation;
        updateData.location = physicalDestination.displayName;
      }
      if (categorySelection.provided) {
        updateData.categoryId = categorySelection.categoryId;
        if (categorySelection.categoryId) updateData.type = categorySelection.name;
      }
      if (storageSelection.provided) {
        updateData.storageLocationId = storageSelection.storageLocationId;
        updateData.storageLocation = storageSelection.storageLocationId
          ? storageSelection.displayName
          : String(body.storageLocation || "").trim() || null;
      }
      if (clearsPhysicalDestinationOnReturn) {
        updateData.locationId = null;
        updateData.manualLocation = null;
        updateData.location = null;
      }
      if (orphanedMembershipRecovered && Object.prototype.hasOwnProperty.call(updateData, "specifications")) {
        const submittedSpecs = equipmentSpecs({ specifications: updateData.specifications });
        delete submittedSpecs.parentBundleId;
        delete submittedSpecs.parentBundleName;
        delete submittedSpecs.parentBundleCreatedAt;
        updateData.specifications = {
          ...equipmentSpecs(existing),
          ...submittedSpecs,
          kitExtractionHistory: equipmentSpecs(existing).kitExtractionHistory,
        };
      }

      const existingSpecs = equipmentSpecs(existing);
      if (Object.prototype.hasOwnProperty.call(updateData, "specifications")) {
        const submittedSpecs = equipmentSpecs({ specifications: updateData.specifications });
        delete submittedSpecs.equipmentComments;
        updateData.specifications = Array.isArray(existingSpecs.equipmentComments)
          ? { ...submittedSpecs, equipmentComments: existingSpecs.equipmentComments }
          : submittedSpecs;
      }
      const existingParentBundleId = String(existingSpecs.parentBundleId || "").trim();
      if (existingParentBundleId && Object.prototype.hasOwnProperty.call(updateData, "specifications")) {
        const submittedSpecs = equipmentSpecs({ specifications: updateData.specifications });
        if (String(submittedSpecs.parentBundleId || "").trim() !== existingParentBundleId) {
          return res.status(409).json({
            message: "Нельзя изменить принадлежность к комплекту через обычное редактирование.",
            code: "KIT_MEMBERSHIP_UPDATE_FORBIDDEN",
            parentBundleId: existingParentBundleId,
          });
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, "lastUsed")) {
        if (body.lastUsed === null || body.lastUsed === "") {
          updateData.lastUsed = null;
        } else {
          const lastUsed = body.lastUsed instanceof Date ? body.lastUsed : new Date(body.lastUsed);
          if (Number.isNaN(lastUsed.getTime())) {
            return res.status(400).json({ message: "Некорректная дата последнего использования" });
          }
          updateData.lastUsed = lastUsed;
        }
      }

      const parsed = insertEquipmentSchema.partial().safeParse(updateData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Проверьте данные оборудования", errors: parsed.error.flatten() });
      }

      const changesHolder = Object.prototype.hasOwnProperty.call(parsed.data, "assignedTo") &&
        String((parsed.data as any).assignedTo || "") !== String(existing.assignedTo || "");
      const changesToInUse = Object.prototype.hasOwnProperty.call(parsed.data, "status") &&
        (parsed.data as any).status === "in-use" && existing.status !== "in-use";
      const returnsToAvailable = Object.prototype.hasOwnProperty.call(parsed.data, "status") &&
        (parsed.data as any).status === "available";
      const clearsActiveHolder = existing.status === "in-use" &&
        Boolean(existing.assignedTo) &&
        Object.prototype.hasOwnProperty.call(parsed.data, "assignedTo") &&
        !String((parsed.data as any).assignedTo || "").trim();
      if (returnsToAvailable || clearsActiveHolder) {
        await ensureEquipmentReturnAllowed(req.user, existing);
      }
      const requiresKitSafety = changesToInUse ||
        (changesHolder && Boolean((parsed.data as any).assignedTo));
      const updateAction = async () => storage.updateEquipment(id, parsed.data as any);
      const equipment = requiresKitSafety
        ? await runEquipmentActionWithKitSafety({
            componentId: id,
            user: req.user,
            confirmation: body.kitExtraction,
            actionContext: "direct-equipment-update",
            action: updateAction,
          })
        : await updateAction();
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      if (returnsToAvailable || clearsActiveHolder) {
        await deactivateCurrentEquipmentCheckoutContext(id);
      }
      if (workContext.provided) {
        await storage.replaceEquipmentContextLinks({
          equipmentId: id,
          source: changesToInUse ? "checkout" : "manual",
          projectId: workContext.projectId,
          kanbanCardIds: workContext.kanbanCardIds,
          createdByUserId: (req.user as any)?.id || null,
        });
      }
      publishEquipmentContextChanged(equipment, changesToInUse || returnsToAvailable ? "status" : "updated");
      res.json(await serializeEquipmentContext(equipment));
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(error?.statusCode || 500).json({
        message: error?.message || "Failed to update equipment",
        code: error?.code,
      });
    }
  });

  app.get("/api/equipment-checkout-requests", async (req, res) => {
    try {
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      if (workspace.type !== "company" || !workspace.companyId) return res.json([]);
      const currentUser = req.user as any;
      const canManageActiveCompany = await canManageCompany(currentUser, workspace.companyId).catch(() => false);
      const requests = await storage.getEquipmentCheckoutRequests().catch(() => []);
      const visibleRequests = (requests as any[]).filter((request) => {
        const companyId = String(request.companyId || "").trim();
        if (companyId !== String(workspace.companyId)) return false;
        return request.requestedBy === currentUser?.id || canManageActiveCompany;
      });
      res.json(await Promise.all(visibleRequests.map(serializeEquipmentCheckoutRequest)));
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось загрузить запросы на оборудование" });
    }
  });

  app.post("/api/equipment/:id/kit-extraction-request", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const currentUser = req.user as any;
      const item = await storage.getEquipmentById(req.params.id).catch(() => undefined);
      if (!item || item.status === "archived") {
        return res.status(404).json({ message: "Оборудование не найдено" });
      }
      const kit = await getEquipmentKitContext(item);
      if (!kit) {
        return res.status(409).json({ message: "Компонент больше не входит в комплект" });
      }
      await ensureEquipmentCompanyAccess(currentUser, item, kit.bundle);
      if (!kit.isInUse) {
        return res.status(409).json({
          message: "Комплект не используется: извлечение можно подтвердить без запроса менеджеру.",
          code: "KIT_EXTRACTION_CONFIRMATION_REQUIRED",
        });
      }

      const allRequests = await storage.getEquipmentCheckoutRequests().catch(() => []);
      const duplicate = (allRequests as any[]).find((request) =>
        request.status === "pending" &&
        request.requestType === "kit-extraction" &&
        String(request.equipmentId) === String(item.id) &&
        String(request.requestedBy) === String(currentUser.id),
      );
      if (duplicate) return res.json({ request: duplicate, duplicate: true });

      const workspace = await getActiveWorkspaceForUser(currentUser);
      const companyId = workspace.type === "company" ? workspace.companyId : undefined;
      const request = await storage.createEquipmentCheckoutRequest(insertEquipmentCheckoutRequestSchema.parse({
        companyId,
        equipmentId: item.id,
        requestedBy: currentUser.id,
        requestType: "kit-extraction",
        currentHolder: kit.bundle.id,
        status: "pending",
        quantity: 1,
        note: String(req.body?.reason || "").trim() || `Извлечение из активного комплекта «${kit.bundle.name}»`,
      }));
      res.json({ request, duplicate: false });
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(400).json({ message: error?.message || "Не удалось отправить запрос на извлечение" });
    }
  });

  app.post("/api/equipment/:bundleId/components", async (req, res) => {
    const lockedIds: string[] = [];
    let snapshots: any[] = [];
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }
      const bundle = await storage.getEquipmentById(req.params.bundleId).catch(() => undefined);
      if (!bundle || bundle.status === "archived") {
        return res.status(404).json({ message: "Комплект не найден" });
      }
      if (!isEquipmentKit(bundle)) {
        return res.status(400).json({ message: "Выбранная позиция не является комплектом" });
      }
      await ensureEquipmentCompanyAccess(req.user, bundle);
      if (!(await canManageEquipmentKit(req.user, bundle))) {
        return res.status(403).json({ message: "Нет прав на изменение состава комплекта" });
      }

      const requestedComponentIds: string[] = (Array.isArray(req.body?.equipmentIds) ? req.body.equipmentIds : [])
        .map((id: unknown) => String(id || "").trim())
        .filter((id: string) => Boolean(id));
      const componentIds: string[] = [...new Set<string>(requestedComponentIds)];
      if (componentIds.length === 0) {
        return res.status(400).json({ message: "Выберите хотя бы одну позицию" });
      }
      if (componentIds.includes(String(bundle.id))) {
        throw createEquipmentKitActionError(
          409,
          "KIT_SELF_NESTING_FORBIDDEN",
          "Нельзя добавить комплект в самого себя.",
          { parentBundleId: bundle.id },
        );
      }

      const parentContext = await getEquipmentKitContext(bundle);
      const directProjectLink = projectEquipmentBundles.find((entry) => entry.equipmentIds.includes(bundle.id));
      const isActive = Boolean(directProjectLink) || (parentContext
        ? Boolean(parentContext.isInUse)
        : bundle.status === "in-use");
      if (isActive && !(await canOverrideActiveKit(req.user, bundle))) {
        throw createEquipmentKitActionError(
          403,
          "KIT_COMPONENT_REQUIRES_MANAGER",
          `Комплект «${bundle.name}» используется. Изменить состав может только менеджер.`,
          { parentBundleId: bundle.id, parentBundleName: bundle.name, kitInUse: true },
        );
      }
      if (isActive && req.body?.activeKitApproval !== true) {
        throw createEquipmentKitActionError(
          409,
          "KIT_OVERRIDE_CONFIRMATION_REQUIRED",
          `Подтвердите добавление позиций в активный комплект «${bundle.name}».`,
          { parentBundleId: bundle.id, parentBundleName: bundle.name, kitInUse: true },
        );
      }

      const idsToLock = [String(bundle.id), ...componentIds].sort();
      const busyId = idsToLock.find((id) => equipmentKitActionLocks.has(id));
      if (busyId) {
        throw createEquipmentKitActionError(
          409,
          "KIT_COMPONENT_BUSY",
          "Состав комплекта уже изменяется. Обновите склад и повторите действие.",
          { componentId: busyId, parentBundleId: bundle.id },
        );
      }
      idsToLock.forEach((id) => {
        equipmentKitActionLocks.add(id);
        lockedIds.push(id);
      });

      const components: any[] = [];
      const bundleCompanyId = String(equipmentSpecs(bundle).companyId || "").trim();
      for (const componentId of componentIds) {
        const component = await storage.getEquipmentById(componentId).catch(() => undefined);
        if (!component || component.status === "archived") {
          throw createEquipmentKitActionError(404, "EQUIPMENT_NOT_FOUND", "Одна из выбранных позиций не найдена.", { componentId });
        }
        await ensureEquipmentCompanyAccess(req.user, component, bundle);
        const componentCompanyId = String(equipmentSpecs(component).companyId || "").trim();
        if (bundleCompanyId && componentCompanyId && bundleCompanyId !== componentCompanyId) {
          throw createEquipmentKitActionError(
            409,
            "KIT_COMPANY_MISMATCH",
            "Нельзя объединять оборудование разных компаний.",
            { componentId, parentBundleId: bundle.id },
          );
        }
        const componentSpecs = equipmentSpecs(component);
        if (String(componentSpecs.parentBundleId || "").trim()) {
          throw createEquipmentKitActionError(
            409,
            "KIT_COMPONENT_ALREADY_ASSIGNED",
            `Позиция «${component.name}» уже входит в другой комплект.`,
            { componentId, parentBundleId: componentSpecs.parentBundleId },
          );
        }
        if (component.status !== "available") {
          throw createEquipmentKitActionError(
            409,
            "KIT_COMPONENT_NOT_AVAILABLE",
            `Позиция «${component.name}» сейчас недоступна для добавления.`,
            { componentId, status: component.status },
          );
        }
        const operabilityStatus = String(component.operabilityStatus || "").trim() || "working";
        if (operabilityStatus !== "working") {
          throw createEquipmentKitActionError(
            409,
            "KIT_COMPONENT_INOPERABLE",
            `Позиция «${component.name}» неисправна или находится в ремонте.`,
            { componentId, operabilityStatus },
          );
        }
        if (isEquipmentKit(component) && await equipmentKitContains(component.id, bundle.id)) {
          throw createEquipmentKitActionError(
            409,
            "KIT_NESTING_CYCLE",
            `Добавление «${component.name}» создаст циклическую вложенность комплектов.`,
            { componentId, parentBundleId: bundle.id },
          );
        }
        components.push(component);
      }

      snapshots = [
        { ...bundle, specifications: equipmentSpecs(bundle) },
        ...components.map((component) => ({ ...component, specifications: equipmentSpecs(component) })),
      ];
      const at = new Date().toISOString();
      const actorUserId = (req.user as any)?.id || null;
      const actorName = (req.user as any)?.name || (req.user as any)?.username || null;
      const nextBundleSpecs = equipmentSpecs(bundle);
      const existingIds = getEquipmentKitComponentIds(bundle);
      nextBundleSpecs.bundleComponentIds = [...new Set([...existingIds, ...componentIds])];
      const existingSnapshots = Array.isArray(nextBundleSpecs.bundleComponents) ? nextBundleSpecs.bundleComponents : [];
      const snapshotById = new Map(existingSnapshots.map((entry: any) => [String(entry?.id || ""), entry]));

      for (const component of components) {
        const audit = {
          id: crypto.randomUUID(),
          action: "added",
          componentId: component.id,
          componentName: component.name,
          parentBundleId: bundle.id,
          parentBundleName: bundle.name,
          actorUserId,
          actorName,
          at,
          reason: String(req.body?.reason || "").trim() || "Добавлено в комплект вручную",
          context: "manual-kit-component-add",
          managerOverride: isActive,
          projectId: directProjectLink?.projectId || parentContext?.projectLink?.projectId || null,
        };
        const nextComponentSpecs = equipmentSpecs(component);
        nextComponentSpecs.parentBundleId = bundle.id;
        nextComponentSpecs.parentBundleName = bundle.name;
        nextComponentSpecs.parentBundleCreatedAt = at;
        nextComponentSpecs.kitExtractionHistory = [
          ...(Array.isArray(nextComponentSpecs.kitExtractionHistory) ? nextComponentSpecs.kitExtractionHistory : []),
          audit,
        ].slice(-100);
        const updatedComponent = await storage.updateEquipment(component.id, {
          status: "in-use",
          assignedTo: null,
          location: `В составе: ${bundle.name}`,
          specifications: nextComponentSpecs,
        } as any);
        if (!updatedComponent) throw new Error(`Не удалось добавить «${component.name}» в комплект`);
        snapshotById.set(String(component.id), {
          id: component.id,
          name: component.name,
          model: component.model,
          inventoryNumber: component.inventoryNumber,
          type: component.type,
        });
        nextBundleSpecs.bundleExtractionHistory = [
          ...(Array.isArray(nextBundleSpecs.bundleExtractionHistory) ? nextBundleSpecs.bundleExtractionHistory : []),
          audit,
        ].slice(-100);
      }
      nextBundleSpecs.bundleComponents = [...snapshotById.values()];
      const updatedBundle = await storage.updateEquipment(bundle.id, { specifications: nextBundleSpecs } as any);
      if (!updatedBundle) throw new Error("Не удалось обновить состав комплекта");
      const updatedComponents = await Promise.all(componentIds.map((id) => storage.getEquipmentById(id)));
      res.json({
        success: true,
        bundle: updatedBundle,
        components: updatedComponents.filter(Boolean),
        addedComponentIds: componentIds,
      });
    } catch (error: any) {
      if (snapshots.length > 0) {
        try {
          await restoreEquipmentSnapshots(snapshots);
        } catch (rollbackError) {
          console.error("[Equipment kits] Failed to roll back component add:", rollbackError);
        }
      }
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(500).json({ message: error?.message || "Не удалось добавить позиции в комплект" });
    } finally {
      lockedIds.forEach((id) => equipmentKitActionLocks.delete(id));
    }
  });

  app.delete("/api/equipment/:bundleId/components/:componentId", async (req, res) => {
    let bundleLocked = false;
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }
      const bundle = await storage.getEquipmentById(req.params.bundleId).catch(() => undefined);
      const component = await storage.getEquipmentById(req.params.componentId).catch(() => undefined);
      if (!bundle || bundle.status === "archived") return res.status(404).json({ message: "Комплект не найден" });
      if (!component || component.status === "archived") return res.status(404).json({ message: "Компонент не найден" });
      if (!isEquipmentKit(bundle)) return res.status(400).json({ message: "Выбранная позиция не является комплектом" });
      if (String(equipmentSpecs(component).parentBundleId || "").trim() !== String(bundle.id)) {
        throw createEquipmentKitActionError(
          409,
          "KIT_COMPONENT_PARENT_MISMATCH",
          `Позиция «${component.name}» больше не входит в комплект «${bundle.name}».`,
          { componentId: component.id, parentBundleId: bundle.id },
        );
      }
      await ensureEquipmentCompanyAccess(req.user, component, bundle);
      if (!(await canManageEquipmentKit(req.user, bundle))) {
        return res.status(403).json({ message: "Нет прав на изменение состава комплекта" });
      }
      if (equipmentKitActionLocks.has(String(bundle.id))) {
        throw createEquipmentKitActionError(
          409,
          "KIT_COMPONENT_BUSY",
          "Состав комплекта уже изменяется. Обновите склад и повторите действие.",
          { componentId: component.id, parentBundleId: bundle.id },
        );
      }
      equipmentKitActionLocks.add(String(bundle.id));
      bundleLocked = true;

      const updatedComponent = await runEquipmentActionWithKitSafety({
        componentId: component.id,
        user: req.user,
        confirmation: req.body?.kitExtraction,
        actionContext: "manual-kit-component-remove",
        action: async (freshItem) => freshItem,
      });
      const updatedBundle = await storage.getEquipmentById(bundle.id).catch(() => undefined);
      res.json({
        success: true,
        bundle: updatedBundle,
        component: updatedComponent,
        removedComponentId: component.id,
      });
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(500).json({ message: error?.message || "Не удалось убрать позицию из комплекта" });
    } finally {
      if (bundleLocked) equipmentKitActionLocks.delete(String(req.params.bundleId));
    }
  });

  app.post("/api/equipment-checkout-requests", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;

      const currentUser = req.user as any;
      const body = req.body || {};
      const equipmentId = String(body.equipmentId || "").trim();
      if (!equipmentId) {
        return res.status(400).json({ message: "Выберите оборудование для запроса" });
      }

      const item = await storage.getEquipmentById(equipmentId).catch(() => undefined);
      if (!item || item.status === "archived") {
        return res.status(404).json({ message: "Оборудование не найдено" });
      }
      await ensureEquipmentCompanyAccess(currentUser, item);
      const operabilityStatus = String((item as any).operabilityStatus || "").trim() ||
        (item.status === "broken" ? "broken" : item.status === "maintenance" ? "on_repair" : "working");
      if (operabilityStatus !== "working") {
        return res.status(400).json({
          message: operabilityStatus === "broken"
            ? "Оборудование неисправно и недоступно для выдачи"
            : "Оборудование находится в ремонте и недоступно для выдачи",
        });
      }

      const itemCompanyId = equipmentCompanyId(item);
      const companyId = String(workspace.companyId);
      if (itemCompanyId !== companyId) {
        return res.status(403).json({ message: "Оборудование принадлежит другой компании" });
      }
      if (body.taskId && String(body.taskId).trim()) {
        return res.status(400).json({
          message: "Новые связи с Legacy Task Manager не поддерживаются. Выберите карточку Kanban V2",
          code: "LEGACY_TASK_LINK_FORBIDDEN",
        });
      }

      const requestType = body.requestType === "transfer" ? "transfer" : "checkout";
      if (body.quantity === undefined || body.quantity === null || String(body.quantity).trim() === "") {
        return res.status(400).json({ message: "Количество обязательно" });
      }
      const rawQuantity = Number(body.quantity);
      if (!Number.isInteger(rawQuantity) || rawQuantity <= 0) {
        return res.status(400).json({ message: "Количество должно быть положительным целым числом" });
      }
      const physicalDestination = await validatePhysicalDestination({
        body,
        user: currentUser,
        companyId,
        required: true,
      });
      const workContext = await validateEquipmentWorkContext({
        body,
        user: currentUser,
        companyId,
      });
      const requestData = insertEquipmentCheckoutRequestSchema.parse({
        companyId: companyId || undefined,
        equipmentId,
        requestedBy: currentUser.id,
        kanbanCardId: workContext.kanbanCardIds[0] || undefined,
        kanbanCardIds: workContext.kanbanCardIds,
        projectId: workContext.projectId || undefined,
        locationId: physicalDestination.locationId || undefined,
        manualLocation: physicalDestination.manualLocation || undefined,
        quantity: rawQuantity,
        requestType,
        currentHolder: requestType === "transfer" ? item.assignedTo || null : null,
        status: "pending",
        location: physicalDestination.displayName || undefined,
        note: body.note && String(body.note).trim() ? String(body.note).trim() : undefined,
      });

      const request = await runEquipmentActionWithKitSafety({
        componentId: equipmentId,
        user: currentUser,
        confirmation: body.kitExtraction,
        actionContext: requestType === "transfer" ? "equipment-transfer-request" : "equipment-checkout-request",
        action: async () => {
          const createdRequest = await storage.createEquipmentCheckoutRequest(requestData);
          if (workContext.provided) {
            await storage.replaceEquipmentContextLinks({
              equipmentId,
              source: "checkout",
              checkoutRequestId: createdRequest.id,
              projectId: workContext.projectId,
              kanbanCardIds: workContext.kanbanCardIds,
              createdByUserId: currentUser.id,
            });
          }
          return createdRequest;
        },
      });
      publishEquipmentContextChanged(item);
      res.json(await serializeEquipmentCheckoutRequest(request));
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(error?.statusCode || 400).json({
        message: error?.message || "Не удалось создать запрос на оборудование",
        code: error?.code,
      });
    }
  });

  app.post("/api/equipment-checkout-requests/:id/approve", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;

      const currentUser = req.user as any;
      const request = await storage.getEquipmentCheckoutRequestById(req.params.id).catch(() => undefined);
      if (!request) return res.status(404).json({ message: "Запрос не найден" });
      if (request.status !== "pending") return res.status(400).json({ message: "Запрос уже обработан" });

      const companyId = String(request.companyId || "").trim();
      if (companyId !== String(workspace.companyId)) {
        return res.status(404).json({ message: "Запрос не найден" });
      }
      const canApprove = await canManageCompany(currentUser, companyId).catch(() => false) ||
        currentUser?.role === "manager";
      if (!canApprove) return res.status(403).json({ message: "Нет прав на подтверждение запроса" });

      const item = await storage.getEquipmentById(request.equipmentId).catch(() => undefined);
      if (!item || item.status === "archived") return res.status(404).json({ message: "Оборудование не найдено" });
      await ensureEquipmentCompanyAccess(currentUser, item);

      if (request.requestType === "kit-extraction") {
        const kit = await getEquipmentKitContext(item);
        if (!kit) {
          const updatedRequest = await storage.updateEquipmentCheckoutRequest(request.id, {
            status: "approved",
            reviewedBy: currentUser.id,
            reviewedAt: new Date(),
            decisionNote: "Компонент уже извлечён из комплекта",
          } as any);
          return res.json({ request: updatedRequest, equipment: item, alreadyExtracted: true });
        }
        if (req.body?.kitExtractionApproval !== true) {
          return res.status(409).json({
            message: `Подтвердите извлечение «${item.name}» из активного комплекта «${kit.bundle.name}».`,
            code: "KIT_OVERRIDE_CONFIRMATION_REQUIRED",
            parentBundleId: kit.bundle.id,
            parentBundleName: kit.bundle.name,
          });
        }

        const outcome = await runEquipmentActionWithKitSafety({
          componentId: item.id,
          user: currentUser,
          confirmation: {
            confirmed: true,
            override: true,
            bundleName: kit.bundle.name,
            reason: request.note || "Запрос сотрудника на извлечение",
            context: "manager-approved-kit-extraction",
          },
          actionContext: "manager-approved-kit-extraction",
          action: async (freshItem) => {
            const updatedRequest = await storage.updateEquipmentCheckoutRequest(request.id, {
              status: "approved",
              reviewedBy: currentUser.id,
              reviewedAt: new Date(),
              decisionNote: req.body?.decisionNote
                ? String(req.body.decisionNote).trim()
                : "Извлечение из активного комплекта подтверждено",
            } as any);
            return { request: updatedRequest, equipment: freshItem };
          },
        });
        return res.json(outcome);
      }

      const operabilityStatus = String((item as any).operabilityStatus || "").trim() ||
        (item.status === "broken" ? "broken" : item.status === "maintenance" ? "on_repair" : "working");
      if (operabilityStatus !== "working") {
        return res.status(400).json({ message: "Оборудование сейчас недоступно для выдачи" });
      }

      const outcome = await runEquipmentActionWithKitSafety({
        componentId: request.equipmentId,
        user: currentUser,
        confirmation: req.body?.kitExtraction,
        actionContext: request.requestType === "transfer" ? "approved-equipment-transfer" : "approved-equipment-checkout",
        action: async (freshItem) => {
          const updatedEquipment = await storage.updateEquipment(request.equipmentId, {
            status: "in-use",
            assignedTo: request.requestedBy,
            location: request.location || freshItem.location,
            locationId: request.locationId || null,
            manualLocation: request.manualLocation || null,
            lastUsed: new Date(),
          } as any);
          const updatedRequest = await storage.updateEquipmentCheckoutRequest(request.id, {
            status: "approved",
            reviewedBy: currentUser.id,
            reviewedAt: new Date(),
          } as any);
          return { request: updatedRequest, equipment: updatedEquipment };
        },
      });

      if (outcome.equipment) publishEquipmentContextChanged(outcome.equipment, "status");
      res.json({
        request: outcome.request ? await serializeEquipmentCheckoutRequest(outcome.request) : outcome.request,
        equipment: outcome.equipment ? await serializeEquipmentContext(outcome.equipment) : outcome.equipment,
      });
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(500).json({ message: error?.message || "Не удалось подтвердить запрос" });
    }
  });

  app.post("/api/equipment-checkout-requests/:id/reject", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;

      const currentUser = req.user as any;
      const request = await storage.getEquipmentCheckoutRequestById(req.params.id).catch(() => undefined);
      if (!request) return res.status(404).json({ message: "Запрос не найден" });
      if (request.status !== "pending") return res.status(400).json({ message: "Запрос уже обработан" });

      const companyId = String(request.companyId || "").trim();
      if (companyId !== String(workspace.companyId)) {
        return res.status(404).json({ message: "Запрос не найден" });
      }
      const canReject = await canManageCompany(currentUser, companyId).catch(() => false) ||
        currentUser?.role === "manager";
      if (!canReject) return res.status(403).json({ message: "Нет прав на отклонение запроса" });

      const updatedRequest = await storage.updateEquipmentCheckoutRequest(request.id, {
        status: "rejected",
        reviewedBy: currentUser.id,
        reviewedAt: new Date(),
        decisionNote: req.body?.decisionNote ? String(req.body.decisionNote).trim() : undefined,
      } as any);
      await storage.deactivateEquipmentContextLinks(request.equipmentId, {
        source: "checkout",
        checkoutRequestId: request.id,
      });
      const item = await storage.getEquipmentById(request.equipmentId).catch(() => undefined);
      if (item) publishEquipmentContextChanged(item, "status");

      res.json({
        request: updatedRequest ? await serializeEquipmentCheckoutRequest(updatedRequest) : updatedRequest,
      });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось отклонить запрос" });
    }
  });

  app.delete("/api/equipment/:id", async (req, res) => {
    try {
      if (!(await requireActiveCompanyWorkspace(req, res))) return;
      const { id } = req.params;
      const item = await storage.getEquipmentById(id).catch(() => undefined);
      if (!item) return res.status(404).json({ message: "Оборудование не найдено" });
      await ensureEquipmentCompanyAccess(req.user, item);
      const specs = item.specifications && typeof item.specifications === "object" ? item.specifications as any : {};
      const activityAttachments = (await storage.getEquipmentComments(id).catch(() => []))
        .flatMap((comment: any) => Array.isArray(comment.attachments) ? comment.attachments : [])
        .map((attachment: any) => String(attachment?.fileUrl || ""))
        .filter((fileUrl: string) => fileUrl.startsWith("/uploads/equipment-comments/"));
      const permissions = Array.isArray((req.user as any)?.permissions) ? (req.user as any).permissions : [];
      const canDelete =
        (req.user as any)?.role === "admin" ||
        (req.user as any)?.role === "manager" ||
        permissions.includes("equipment:delete") ||
        (specs.createdByUserId && specs.createdByUserId === (req.user as any)?.id) ||
        (specs.companyId && await canManageCompany(req.user, String(specs.companyId)));
      if (!canDelete) return res.status(403).json({ message: "Нет прав на удаление оборудования" });
      const result = await runEquipmentActionWithKitSafety({
        componentId: id,
        user: req.user,
        confirmation: req.body?.kitExtraction,
        actionContext: "delete-equipment",
        action: async (freshItem) => {
          const disassembly = await disassembleEquipmentBundle(freshItem, req.user, "bundle-deleted");
          try {
            try {
              const deleted = await storage.deleteEquipment(id);
              if (deleted) {
                for (let index = projectEquipmentBundles.length - 1; index >= 0; index--) {
                  projectEquipmentBundles[index].equipmentIds = projectEquipmentBundles[index].equipmentIds
                    .filter((equipmentId) => String(equipmentId) !== String(id));
                  if (projectEquipmentBundles[index].equipmentIds.length === 0) {
                    projectEquipmentBundles.splice(index, 1);
                  }
                }
                return {
                  success: true,
                  mode: "deleted",
                  disassembledComponentIds: disassembly.releasedComponentIds,
                };
              }
            } catch (error: any) {
              console.warn("[Equipment] hard delete failed, archiving:", error?.message || error);
            }
            const freshSpecs = equipmentSpecs(freshItem);
            const archived = await storage.updateEquipment(id, {
              status: "archived",
              location: "Архив",
              specifications: {
                ...freshSpecs,
                archivedAt: new Date().toISOString(),
                archivedByUserId: (req.user as any)?.id || null,
              },
            } as any);
            if (!archived) throw new Error("Не удалось удалить или архивировать оборудование");
            for (let index = projectEquipmentBundles.length - 1; index >= 0; index--) {
              projectEquipmentBundles[index].equipmentIds = projectEquipmentBundles[index].equipmentIds
                .filter((equipmentId) => String(equipmentId) !== String(id));
              if (projectEquipmentBundles[index].equipmentIds.length === 0) {
                projectEquipmentBundles.splice(index, 1);
              }
            }
            return {
              success: true,
              mode: "archived",
              equipment: archived,
              disassembledComponentIds: disassembly.releasedComponentIds,
            };
          } catch (error) {
            await restoreEquipmentSnapshots(disassembly.snapshots);
            throw error;
          }
        },
      });
      if ((result as any)?.mode === "deleted") {
        await Promise.all(activityAttachments.map((fileUrl: string) =>
          fs.unlink(path.join(process.cwd(), fileUrl.replace(/^\/+/, ""))).catch(() => undefined),
        ));
      }
      publishEquipmentContextChanged(item, "status");
      res.json(result);
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      console.error("[Equipment] delete failed:", error?.message || error);
      res.status(500).json({ message: error?.message || "Не удалось удалить оборудование" });
    }
  });

  // Systems
  app.get("/api/systems", async (req, res) => {
    try {
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      if (workspace.type !== "company" || !workspace.companyId) return res.json([]);
      const systems = await withDbTimeout(() => storage.getSystems(), 5000, []);
      const list = (Array.isArray(systems) ? systems : []).filter((system: any) => {
        const spec = system?.specifications && typeof system.specifications === "object" ? system.specifications as any : {};
        return String(spec.companyId || "") === String(workspace.companyId);
      }).map((system: any) => {
        const spec = system?.specifications && typeof system.specifications === "object" ? system.specifications as any : {};
        const agent = spec.agent && typeof spec.agent === "object" ? spec.agent : {};
        if (!spec.agentKey && !agent.agentKey) return system;
        const lastPingMs = system.lastPing ? new Date(system.lastPing).getTime() : 0;
        const intervalSec = Math.max(15, Number(agent.intervalSec || 15));
        const staleSec = lastPingMs ? Math.round((Date.now() - lastPingMs) / 1000) : 999999;
        const status = staleSec <= intervalSec * 4 ? "online" : "offline";
        return {
          ...system,
          status,
          specifications: {
            ...spec,
            agent: { ...agent, staleSec },
          },
        };
      });
      Promise.all(
        list.map(async (system: any) => {
          const spec = system?.specifications && typeof system.specifications === "object" ? system.specifications as any : {};
          const agent = spec.agent && typeof spec.agent === "object" ? spec.agent : {};
          if (spec.agentKey || agent.agentKey) {
            if (system.id && system.status !== "maintenance") {
              withDbTimeout(() => storage.updateSystem(system.id, { status: system.status, specifications: system.specifications } as any), 3000, undefined).catch(() => {});
            }
            return;
          }
          if (system?.ipAddress && system.status !== "maintenance") {
            try {
              const isOnline = await checkIP(system.ipAddress);
              const newStatus = isOnline ? "online" : "offline";
              if (system.status !== newStatus) {
                withDbTimeout(() => storage.pingSystem(system.id, newStatus), 3000, undefined).catch(() => {});
              }
            } catch (_) {}
          }
        })
      ).catch(() => {});
      res.json(list);
    } catch (e: any) {
      console.warn("[API] GET /api/systems:", e?.message || e);
      res.json([]);
    }
  });

  app.post("/api/systems", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const requestedSpecifications = req.body?.specifications && typeof req.body.specifications === "object"
        ? req.body.specifications
        : {};
      const parsed = insertSystemSchema.safeParse(req.body);
      const systemData = parsed.success ? parsed.data : {
        name: req.body?.name ?? "",
        type: req.body?.type ?? "server",
        location: req.body?.location ?? "",
        ipAddress: req.body?.ipAddress ?? undefined,
        status: req.body?.status ?? "offline",
        specifications: req.body?.specifications ?? undefined,
      };
      systemData.specifications = {
        ...(systemData.specifications && typeof systemData.specifications === "object"
          ? systemData.specifications
          : requestedSpecifications),
        companyId: workspace.companyId,
      };
      const system = await storage.createSystem(systemData);
      res.status(201).json(system);
    } catch (error) {
      res.status(500).json({ message: "Failed to create system" });
    }
  });

  app.put("/api/systems/:id", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const { id } = req.params;
      const existing = await storage.getSystemById(id);
      if (!existing) return res.status(404).json({ message: "System not found" });
      const existingSpecifications = existing.specifications && typeof existing.specifications === "object"
        ? existing.specifications as any
        : {};
      if (String(existingSpecifications.companyId || "") !== String(workspace.companyId)) {
        return res.status(404).json({ message: "System not found" });
      }
      const requestedSpecifications = req.body?.specifications && typeof req.body.specifications === "object"
        ? req.body.specifications
        : existingSpecifications;
      const system = await storage.updateSystem(id, {
        ...req.body,
        specifications: {
          ...requestedSpecifications,
          companyId: workspace.companyId,
        },
      });
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }
      res.json(system);
    } catch (error) {
      res.status(500).json({ message: "Failed to update system" });
    }
  });

  app.get("/api/agents/script/windows", async (_req, res) => {
    try {
      const scriptPath = path.join(process.cwd(), "scripts", "streamdesk-agent.ps1");
      const body = await fs.readFile(scriptPath, "utf8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(body);
    } catch (error) {
      res.status(500).send("StreamDesk agent script is not available");
    }
  });

  app.get("/api/companies/:companyId/agent-download", async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { companyId } = req.params;
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      if (String(workspace.companyId) !== String(companyId)) {
        return res.status(404).json({ message: "Компания не найдена" });
      }
      if (!(await canManageCompany(currentUser, companyId))) {
        return res.status(403).json({ message: "Нет прав на скачивание агента" });
      }
      const osName = String(req.query.os || "windows").toLowerCase();
      const deviceType = ["server", "computer", "vmix"].includes(String(req.query.type)) ? String(req.query.type) : "computer";
      if (osName !== "windows") {
        return res.status(400).json({ message: "Пока доступен Windows agent" });
      }
      const workspaceKey = await ensureCompanyWorkspaceKey(companyId);
      const agentKey = `agent_${companyId.slice(0, 8)}_${deviceType}_${crypto.randomBytes(8).toString("hex")}`;
      const autostart = String(req.query.autostart || "1") !== "0";
      const serverUrl = inviteOrigin(req);
      const company = await storage.getCompanyById(companyId).catch(() => undefined);
      const location = `${company?.name || "StreamDesk"} / ${deviceType}`;
      const runnerScript = `
$ErrorActionPreference = 'Stop'
$ServerUrl = '${psString(serverUrl)}'
$AgentDir = Join-Path $env:ProgramData 'StreamDeskAgent'
$AgentScript = Join-Path $AgentDir 'streamdesk-agent.ps1'
$RunnerScript = Join-Path $AgentDir 'run-streamdesk-agent.ps1'
New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null

$MachineGuid = try { (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid } catch { $env:COMPUTERNAME }
$Sha = [System.Security.Cryptography.SHA256]::Create()
$MachineHash = [BitConverter]::ToString($Sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$env:COMPUTERNAME|$MachineGuid"))).Replace('-', '').Substring(0, 10).ToLowerInvariant()
$AgentKey = '${psString(agentKey)}_' + $env:COMPUTERNAME + '_' + $MachineHash

$env:STREAMDESK_URL = $ServerUrl
$env:STREAMDESK_COMPANY_ID = '${psString(companyId)}'
$env:STREAMDESK_WORKSPACE_KEY = '${psString(workspaceKey)}'
$env:STREAMDESK_AGENT_KEY = $AgentKey
$env:STREAMDESK_AGENT_TYPE = '${psString(deviceType)}'
$env:STREAMDESK_AGENT_LOCATION = '${psString(location)}'
$env:STREAMDESK_AGENT_INTERVAL_SEC = '15'
$env:STREAMDESK_AGENT_HARDWARE_INTERVAL_SEC = '1800'
${deviceType === "vmix" ? "$env:STREAMDESK_VMIX_URL = 'http://127.0.0.1:8088/api'" : ""}

Write-Host 'StreamDesk: installing company-bound agent...'
Invoke-WebRequest -Uri "$ServerUrl/api/agents/script/windows" -OutFile $AgentScript -UseBasicParsing

@'
$MachineGuid = try { (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid } catch { $env:COMPUTERNAME }
$Sha = [System.Security.Cryptography.SHA256]::Create()
$MachineHash = [BitConverter]::ToString($Sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$env:COMPUTERNAME|$MachineGuid"))).Replace('-', '').Substring(0, 10).ToLowerInvariant()
$AgentKey = '${psString(agentKey)}_' + $env:COMPUTERNAME + '_' + $MachineHash
$env:STREAMDESK_URL = '${psString(serverUrl)}'
$env:STREAMDESK_COMPANY_ID = '${psString(companyId)}'
$env:STREAMDESK_WORKSPACE_KEY = '${psString(workspaceKey)}'
$env:STREAMDESK_AGENT_KEY = $AgentKey
$env:STREAMDESK_AGENT_TYPE = '${psString(deviceType)}'
$env:STREAMDESK_AGENT_LOCATION = '${psString(location)}'
$env:STREAMDESK_AGENT_INTERVAL_SEC = '15'
$env:STREAMDESK_AGENT_HARDWARE_INTERVAL_SEC = '1800'
${deviceType === "vmix" ? "$env:STREAMDESK_VMIX_URL = 'http://127.0.0.1:8088/api'" : ""}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$AgentScript'
'@ | Set-Content -Path $RunnerScript -Encoding UTF8

if (${autostart ? "$true" : "$false"}) {
  try {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $RunnerScript + '"')
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
    Register-ScheduledTask -TaskName 'StreamDesk Agent' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
    Write-Host 'Autostart enabled: StreamDesk Agent scheduled task created.'
  } catch {
    Write-Warning ('Autostart was not enabled: {0}. Agent will run in this window now. Run BAT as administrator later to enable autostart.' -f $_.Exception.Message)
  }
}

Write-Host 'Starting StreamDesk Agent. You can close this window after the computer appears in Monitoring.'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $AgentScript
`.trimStart();
      const encodedScript = Buffer.from(runnerScript, "utf16le").toString("base64");
      const batScript = [
        "@echo off",
        "chcp 65001 >nul",
        "title StreamDesk Agent",
        "echo StreamDesk Agent installer",
        "echo Company-bound file. Do not share it with another company.",
        "echo.",
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`,
        "if errorlevel 1 (",
        "  echo.",
        "  echo StreamDesk Agent failed to start. Run this file as administrator if autostart is enabled.",
        "  pause",
        ")",
        "endlocal",
        "",
      ].join("\r\n");
      const fileName = `streamdesk-agent-${deviceType}-${companyId.slice(0, 8)}.bat`;
      res.setHeader("Content-Type", "application/x-msdownload; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Cache-Control", "no-store");
      res.send(batScript);
    } catch (error: any) {
      console.error("[Agent] download failed:", error?.message || error);
      res.status(500).json({ message: "Не удалось подготовить файл агента" });
    }
  });

  app.post("/api/agents/heartbeat", async (req, res) => {
    try {
      const payload = req.body || {};
      const companyId = String(payload.companyId || "");
      const workspaceKey = String(payload.workspaceKey || "");
      const company = companyId ? await storage.getCompanyById(companyId).catch(() => undefined) : undefined;
      const settings = company?.settings && typeof company.settings === "object" ? company.settings as any : {};
      const expectedKey = String(settings.monitoring?.workspaceKey || "");
      if (!company || !expectedKey || workspaceKey !== expectedKey) {
        return res.status(403).json({ message: "Agent workspace rejected" });
      }
      const agentKey = String(payload.agentKey || "").trim();
      if (!agentKey) return res.status(400).json({ message: "agentKey is required" });
      const systems = await storage.getSystems().catch(() => []);
      const existing = (systems as any[]).find((system) => {
        const spec = system.specifications && typeof system.specifications === "object" ? system.specifications as any : {};
        const agent = spec.agent && typeof spec.agent === "object" ? spec.agent : {};
        return spec.agentKey === agentKey || agent.agentKey === agentKey;
      });
      const now = new Date();
      const previousSpec = existing?.specifications && typeof existing.specifications === "object" ? existing.specifications as any : {};
      const history = Array.isArray(previousSpec.metricsHistory) ? previousSpec.metricsHistory.slice(-359) : [];
      history.push({
        timestamp: now.toISOString(),
        ...(payload.metrics && typeof payload.metrics === "object" ? payload.metrics : {}),
        vmixDroppedFrames: payload.vmix?.droppedFramesTotal ?? payload.vmix?.droppedFrames ?? null,
      });
      const specifications = {
        ...previousSpec,
        companyId,
        workspaceKey,
        agentKey,
        agent: {
          agentKey,
          companyId,
          workspaceKey,
          deviceType: payload.type || "computer",
          version: payload.version || "1.0.0",
          localIps: Array.isArray(payload.localIps) ? payload.localIps : [],
          capabilities: Array.isArray(payload.capabilities) ? payload.capabilities : [],
          intervalSec: payload.intervalSec,
          staleSec: 0,
          sampleLagMs: payload.metrics?.collectedAt ? Math.max(0, now.getTime() - new Date(payload.metrics.collectedAt).getTime()) : null,
        },
        metrics: payload.metrics || {},
        hardware: payload.hardware || previousSpec.hardware || {},
        vmix: payload.vmix || {},
        metricsHistory: history,
      };
      const systemData = {
        name: String(payload.name || payload.hostname || agentKey),
        type: payload.type === "server" ? "server" : "computer",
        location: String(payload.location || company.name || "StreamDesk Agent"),
        ipAddress: String(payload.ipAddress || ""),
        status: "online",
        lastPing: now,
        specifications,
      } as any;
      const system = existing
        ? await storage.updateSystem(existing.id, systemData)
        : await storage.createSystem(systemData);
      const hardware = specifications.hardware && typeof specifications.hardware === "object" ? specifications.hardware as any : {};
      const metrics = specifications.metrics && typeof specifications.metrics === "object" ? specifications.metrics as any : {};
      const cpuName = String(metrics.cpuName || hardware.cpu?.[0]?.name || hardware.cpu?.name || "").trim();
      const gpuNames = [
        ...(Array.isArray(hardware.gpus) ? hardware.gpus : []),
        ...(Array.isArray(hardware.videoControllers) ? hardware.videoControllers : []),
      ]
        .map((gpu: any) => String(gpu?.name || gpu?.caption || gpu?.description || "").trim())
        .filter(Boolean);
      const gpuName = Array.from(new Set(gpuNames)).join(", ");
      const memoryTotalGb = metrics.memoryTotalGb ?? hardware.memory?.totalGb ?? hardware.ram?.totalGb ?? null;
      const diskTotalGb = metrics.diskTotalGb ?? hardware.storage?.totalGb ?? null;
      const equipmentSpecs = {
        companyId,
        source: "streamdesk-agent",
        agentKey,
        systemId: system?.id,
        syncedAt: now.toISOString(),
        hostname: payload.hostname || payload.name,
        ipAddress: payload.ipAddress || "",
        localIps: Array.isArray(payload.localIps) ? payload.localIps : [],
        deviceType: payload.type || "computer",
        metrics,
        hardware,
        cpu: cpuName,
        gpu: gpuName,
        ram: memoryTotalGb ? `${memoryTotalGb} GB` : undefined,
        disk: diskTotalGb ? `${diskTotalGb} GB` : undefined,
        os: metrics.osCaption || hardware.os?.caption || "",
      };
      const equipmentItems = await storage.getEquipment().catch(() => []);
      const existingEquipment = (equipmentItems as any[]).find((item) => {
        const spec = item.specifications && typeof item.specifications === "object" ? item.specifications as any : {};
        return spec.agentKey === agentKey;
      });
      const equipmentData = {
        name: String(payload.name || payload.hostname || "StreamDesk computer"),
        type: "computer",
        model: [cpuName, gpuName, memoryTotalGb ? `${memoryTotalGb}GB RAM` : ""].filter(Boolean).join(" / ").slice(0, 180),
        inventoryNumber: agentKey,
        status: "available",
        location: String(payload.location || company.name || "StreamDesk Agent"),
        specifications: equipmentSpecs,
        notes: "Автоматически синхронизировано агентом StreamDesk.",
      } as any;
      if (existingEquipment) {
        await storage.updateEquipment(existingEquipment.id, equipmentData).catch(() => undefined);
      } else {
        await storage.createEquipment(equipmentData).catch((error: any) => {
          console.warn("[Agent] equipment sync failed:", error?.message || error);
        });
      }
      res.json({ ok: true, systemId: system?.id });
    } catch (error: any) {
      console.error("[Agent] heartbeat failed:", error?.message || error);
      res.status(500).json({ message: "Heartbeat failed" });
    }
  });

  app.get("/api/agents/metrics", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const system = await storage.getSystemById(String(req.query.systemId || "")).catch(() => undefined);
      if (!system) return res.json({ points: [] });
      const spec = system.specifications && typeof system.specifications === "object" ? system.specifications as any : {};
      if (String(spec.companyId || "") !== String(workspace.companyId)) return res.json({ points: [] });
      const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 240)));
      const hours = Math.max(0.1, Math.min(24 * 30, Number(req.query.hours || 24)));
      const since = Date.now() - hours * 60 * 60 * 1000;
      const points = (Array.isArray(spec.metricsHistory) ? spec.metricsHistory : [])
        .filter((point: any) => new Date(point.timestamp || 0).getTime() >= since)
        .slice(-limit);
      res.json({ points });
    } catch (error) {
      res.json({ points: [] });
    }
  });

  // IP ping functionality
  app.post("/api/systems/ping", async (req, res) => {
    try {
      const { ip } = req.body;
      if (!ip) {
        return res.status(400).json({ message: "IP address is required" });
      }

      const startTime = Date.now();
      const isOnline = await checkIP(ip);
      const responseTime = Date.now() - startTime;

      res.json({
        ip,
        isOnline,
        responseTime: isOnline ? responseTime : undefined,
        error: isOnline ? undefined : "Host is unreachable"
      });
    } catch (error) {
      console.error("Error pinging IP:", error);
      res.status(500).json({
        ip: req.body.ip,
        isOnline: false,
        error: "Failed to ping host"
      });
    }
  });

  // Streams
  app.get("/api/streams", async (req, res) => {
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return;
    if (workspace.type !== "company" || !workspace.companyId) return res.json([]);
    const { active, userId } = req.query;

    const streams = await withDbTimeout(async () => {
      if (active === "true") {
        return await storage.getActiveStreams();
      } else if (userId) {
        return await storage.getStreamsByUser(userId as string);
      } else {
        return await storage.getStreams();
      }
    }, 3000, []); // 3 секунды для быстрого ответа

    res.json((streams as any[]).filter((stream) => {
      const metadata = stream?.metadata && typeof stream.metadata === "object" ? stream.metadata : {};
      return String(metadata.companyId || "") === String(workspace.companyId);
    }));
  });

  app.post("/api/streams", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const streamData = insertStreamSchema.parse({
        ...req.body,
        userId: (req.user as any).id,
        metadata: {
          ...(req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {}),
          companyId: workspace.companyId,
        },
      });
      const stream = await storage.createStream(streamData);
      res.json(stream);
    } catch (error) {
      res.status(400).json({ message: "Invalid stream data" });
    }
  });

  app.put("/api/streams/:id", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const { id } = req.params;
      const existingStreams = await storage.getStreams();
      const existing = (existingStreams as any[]).find((stream) => String(stream.id) === String(id));
      const metadata = existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
      if (!existing || String(metadata.companyId || "") !== String(workspace.companyId)) {
        return res.status(404).json({ message: "Stream not found" });
      }
      const stream = await storage.updateStream(id, {
        ...req.body,
        metadata: {
          ...(req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : metadata),
          companyId: workspace.companyId,
        },
      });
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      res.json(stream);
    } catch (error) {
      res.status(500).json({ message: "Failed to update stream" });
    }
  });

  // External API integrations
  app.get("/api/integrations/youtube/stats", async (req, res) => {
    try {
      // Mock YouTube API response - in real app would use YouTube Data API
      const youtubeStats = {
        viewers: Math.floor(Math.random() * 2000) + 500,
        duration: "1ч 25м",
        status: "live",
        bitrate: "6000 kbps",
        fps: 60,
      };
      res.json(youtubeStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch YouTube stats" });
    }
  });

  app.get("/api/integrations/vk/stats", async (req, res) => {
    try {
      // Mock VK API response - in real app would use VK API
      const vkStats = {
        viewers: Math.floor(Math.random() * 1500) + 300,
        duration: "1ч 25м",
        status: "live",
        bitrate: "5800 kbps",
        fps: 60,
      };
      res.json(vkStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch VK stats" });
    }
  });

  // vMix Scheduler Integration
  app.get("/api/integrations/vmix/scheduler", async (req, res) => {
    try {
      // In production, this would fetch from vmix.rullz.ru API
      // For now, return mock data showing the scheduler structure
      const now = new Date();
      const mockEvents = [
        {
          id: "1",
          title: "Утренний эфир",
          startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
          status: "scheduled" as const,
          preset: "morning_show",
          channel: "main",
        },
        {
          id: "2",
          title: "Вечерний стрим",
          startTime: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 11 * 60 * 60 * 1000).toISOString(),
          status: "scheduled" as const,
          preset: "evening_stream",
          channel: "main",
        },
        {
          id: "3",
          title: "Ночной повтор",
          startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          status: "scheduled" as const,
          preset: "replay",
          channel: "secondary",
        },
      ];

      res.json({
        connected: true,
        events: mockEvents,
        lastSync: new Date().toISOString(),
        nextEvent: mockEvents[0],
      });
    } catch (error) {
      res.status(500).json({
        connected: false,
        events: [],
        message: "Failed to fetch vMix scheduler data"
      });
    }
  });

  // ChatGPT - работа с локальными LLM моделями
  app.post("/api/chat/completions", async (req, res) => {
    try {
      const { model, messages, endpoint } = req.body;

      if (!model || !messages || !endpoint) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Проверяем доступность локальной модели
      try {
        const healthCheck = await fetch(endpoint.replace('/v1/chat/completions', '/health'), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!healthCheck.ok) {
          throw new Error("Local model is not available");
        }
      } catch (error: any) {
        return res.status(503).json({
          message: "Локальная модель недоступна. Убедитесь, что модель запущена.",
          error: error.message,
        });
      }

      // Отправка запроса к локальной модели
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Model returned error: ${response.statusText}`);
      }

      const data = await response.json();

      res.json({
        content: data.choices?.[0]?.message?.content || "Не удалось получить ответ от модели",
        model: data.model || model,
      });
    } catch (error: any) {
      console.error("ChatGPT API error:", error);
      res.status(500).json({
        message: error.message || "Failed to get response from local model",
      });
    }
  });

  // ChatGPT Sessions - получение списка чатов пользователя
  app.get("/api/chat/sessions", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: "UserId is required" });
      }

      console.log(`[ChatGPT] Fetching sessions for user: ${userId}`);
      const sessions = await storage.getChatSessionsByUser(userId);
      console.log(`[ChatGPT] Found ${sessions.length} sessions for user ${userId}`);
      res.json(sessions);
    } catch (error: any) {
      console.error("Failed to fetch chat sessions:", error);
      const msg = (error.message || "").toLowerCase();
      const isDb = /timeout|econnrefused|connection|password|auth|database/i.test(msg);
      res.status(500).json({
        message: isDb
          ? "Ошибка подключения к базе данных. Проверьте PostgreSQL и DATABASE_URL в .env (postgresql://USER:PASSWORD@HOST:PORT/DATABASE)."
          : "Не удалось загрузить список чатов",
        error: error.message,
      });
    }
  });

  // ChatGPT Sessions - создание нового чата
  app.post("/api/chat/sessions", async (req, res) => {
    try {
      const { userId, title, modelId } = req.body;
      console.log(`[ChatGPT] Creating session - userId: ${userId}, title: ${title}, modelId: ${modelId}`);

      if (!userId) {
        console.error("[ChatGPT] Missing userId in request");
        return res.status(400).json({ message: "UserId is required" });
      }
      if (!title || title.trim() === "") {
        console.error("[ChatGPT] Missing or empty title in request");
        return res.status(400).json({ message: "Title is required" });
      }

      // Проверяем, что пользователь существует (в stub-режиме разрешаем любой userId для совместимости с localStorage после перезапуска)
      const user = await storage.getUser(userId);
      if (!user && !isStubStorage) {
        console.error(`[ChatGPT] User not found: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }

      const session = await storage.createChatSession({
        userId,
        title: title.trim(),
        modelId: modelId || null,
      });

      console.log(`[ChatGPT] Session created successfully: ${session.id}`);
      res.json(session);
    } catch (error: any) {
      console.error("Failed to create chat session:", error);
      res.status(500).json({
        message: "Failed to create chat session",
        error: error.message
      });
    }
  });

  // ChatGPT Sessions - удаление чата
  app.delete("/api/chat/sessions/:id", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: "UserId is required" });
      }

      const { id } = req.params;
      const session = await storage.getChatSessionById(id);

      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: "Chat session not found" });
      }

      await storage.deleteChatSession(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete chat session:", error);
      res.status(500).json({ message: "Failed to delete chat session" });
    }
  });

  // ChatGPT Messages - получение сообщений чата
  app.get("/api/chat/sessions/:id/messages", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: "UserId is required" });
      }

      const { id } = req.params;
      const session = await storage.getChatSessionById(id);

      if (!session) {
        return res.status(404).json({ message: "Chat session not found" });
      }

      // Проверяем, что пользователь имеет доступ к этому чату
      if (session.userId !== userId) {
        console.warn(`[ChatGPT] User ${userId} tried to access session ${id} owned by ${session.userId}`);
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getChatMessagesBySession(id);
      res.json(messages);
    } catch (error: any) {
      console.error("Failed to fetch chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // ChatGPT Messages - создание сообщения
  app.post("/api/chat/sessions/:id/messages", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "UserId is required" });
      }

      const { id } = req.params;
      const session = await storage.getChatSessionById(id);

      if (!session) {
        return res.status(404).json({ message: "Chat session not found" });
      }

      // Проверяем, что пользователь имеет доступ к этому чату
      if (session.userId !== userId) {
        console.warn(`[ChatGPT] User ${userId} tried to post to session ${id} owned by ${session.userId}`);
        return res.status(403).json({ message: "Access denied" });
      }

      const { role, content, attachments } = req.body;
      if (!role || !content) {
        return res.status(400).json({ message: "Role and content are required" });
      }

      const message = await storage.createChatMessage({
        sessionId: id,
        role,
        content,
        attachments: attachments || [],
      });

      res.json(message);
    } catch (error: any) {
      console.error("Failed to create chat message:", error);
      res.status(500).json({ message: "Failed to create chat message" });
    }
  });

  // ChatGPT Upload - загрузка файлов для чатов
  app.post("/api/chat/upload", chatUpload.single("file"), async (req, res) => {
    try {
      const { userId, sessionId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "UserId is required" });
      }
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const session = await storage.getChatSessionById(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: "Chat session not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      const filePath = path.relative(process.cwd(), req.file.path);
      const fileUrl = `/${filePath.replace(/\\\\/g, "/")}`;

      let transcription: string | undefined;

      // Если это аудио файл, транскрибируем через Whisper X (или fallback на whisper.cpp)
      if (req.file.mimetype.startsWith("audio/") || req.file.mimetype.startsWith("video/")) {
        try {
          transcription = await transcribeAudioWithWhisper(req.file.path);
        } catch (error: any) {
          console.error("Failed to transcribe audio:", error);
          // Не прерываем загрузку, просто не добавляем транскрипцию
        }
      }

      res.json({
        id: crypto.randomUUID(),
        name: req.file.originalname,
        url: fileUrl,
        type: req.file.mimetype,
        size: req.file.size,
        transcription,
      });
    } catch (error: any) {
      console.error("Failed to upload chat file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Импортируем сервисы для транскрибации (генератор документов импортируется динамически при необходимости)
  const { whisperXClient } = await import("./services/whisper-x-client.js");

  // Функция для транскрипции аудио через whisper.cpp (fallback для локальной транскрибации)
  async function transcribeAudioWithWhisper(audioPath: string): Promise<string> {
    // Сначала пробуем использовать удаленный Whisper X API (если настроен)
    try {
      if (whisperXClient.isConfigured()) {
        const result = await whisperXClient.transcribe(audioPath, {
          language: "ru",
          returnTimestamps: false,
        });
        return result.text;
      }
      } catch (error: any) {
        console.warn("[Transcription] Whisper X failed, trying local whisper.cpp:", error.message);

      // Fallback на локальный whisper.cpp если удаленный API недоступен
      const { spawn } = await import("child_process");
      const whisperBasePath = process.env.WHISPER_CPP_PATH || "./whisper.cpp";
      const modelPath = process.env.WHISPER_MODEL_PATH || path.join(whisperBasePath, "models", "ggml-base.bin");

      return new Promise((resolve, reject) => {
        // Определяем путь к исполняемому файлу whisper.cpp
        const whisperExecutable = process.platform === "win32"
          ? path.join(whisperBasePath, "main.exe")
          : path.join(whisperBasePath, "main");

        // Запускаем whisper.cpp для транскрипции
        const whisper = spawn(whisperExecutable, [
          "-m", modelPath,
          "-f", audioPath,
          "-l", "ru", // Язык: русский (можно изменить)
          "-t", "4", // Количество потоков
          "--no-timestamps", // Без временных меток
        ], {
          cwd: process.cwd(),
        });

        let output = "";
        let errorOutput = "";

        whisper.stdout.on("data", (data) => {
          output += data.toString();
        });

        whisper.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        whisper.on("close", (code) => {
          if (code === 0) {
            // Парсим вывод whisper.cpp
            // Whisper.cpp выводит транскрипцию в stdout, обычно после строк с временными метками
            const lines = output.split("\n")
              .filter(line => line.trim() && !line.includes("[") && !line.includes("]"))
              .map(line => line.trim())
              .filter(line => line.length > 0);

            // Берем последние строки, которые обычно содержат транскрипцию
            const transcription = lines.slice(-5).join(" ").trim();
            resolve(transcription || "Транскрипция не получена");
          } else {
            // Если whisper.cpp не найден или произошла ошибка
            console.warn("Whisper.cpp error:", errorOutput);
            reject(new Error(`Whisper.cpp failed with code ${code}: ${errorOutput}`));
          }
        });

        whisper.on("error", (error) => {
          // Если whisper.cpp не установлен
          console.warn("Whisper.cpp not found or error:", error.message);
          reject(new Error(`Whisper.cpp not available: ${error.message}`));
        });
      });
    }
    throw new Error("Transcription service is not configured");
  }

  // vMix API - подключение и статус
  app.post("/api/vmix/connect", async (req, res) => {
    try {
      const { host, port } = req.body;

      if (!host || !port) {
        return res.status(400).json({ message: "Host and port are required" });
      }

      const vmixUrl = `http://${host}:${port}/api`;

      // Проверка подключения к vMix
      const response = await fetch(`${vmixUrl}?Function=GetVersion`);

      if (!response.ok) {
        throw new Error("Failed to connect to vMix");
      }

      const data = await response.text();

      res.json({
        connected: true,
        host,
        port,
        version: data,
      });
    } catch (error: any) {
      console.error("vMix connection error:", error);
      res.status(500).json({
        connected: false,
        message: error.message || "Failed to connect to vMix",
      });
    }
  });

  // vMix API - получение статуса
  app.get("/api/vmix/status", async (req, res) => {
    try {
      const host = req.query.host as string || "localhost";
      const port = req.query.port as string || "8088";
      const vmixUrl = `http://${host}:${port}/api`;

      // Получение информации о vMix с таймаутом и обработкой ошибок
      let versionResponse, xmlResponse;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 секунды таймаут

        [versionResponse, xmlResponse] = await Promise.all([
          fetch(`${vmixUrl}?Function=GetVersion`, { signal: controller.signal as any }),
          fetch(`${vmixUrl}`, { signal: controller.signal as any }),
        ]);

        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        // vMix недоступен - возвращаем статус "не подключен" без ошибки
        return res.json({
          connected: false,
          message: "vMix недоступен. Проверьте, что vMix запущен и доступен по указанному адресу.",
        });
      }

      if (!versionResponse.ok || !xmlResponse.ok) {
        return res.json({
          connected: false,
          message: "vMix не отвечает",
        });
      }

      const xmlText = await xmlResponse.text();

      // Парсинг XML для получения входов и статуса
      const inputsMatch = xmlText.match(/<inputs count="(\d+)"/);
      const inputsCount = inputsMatch ? parseInt(inputsMatch[1]) : 0;

      const previewMatch = xmlText.match(/preview="(\d+)"/);
      const programMatch = xmlText.match(/active="(\d+)"/);
      const recordingMatch = xmlText.match(/recording="(True|False)"/);
      const streamingMatch = xmlText.match(/streaming="(True|False)"/);

      const inputs: Array<{ number: number; title: string; state: string }> = [];

      // Парсинг входов из XML
      const inputRegex = /<input key="([^"]+)" number="(\d+)" title="([^"]+)"/g;
      let match;
      while ((match = inputRegex.exec(xmlText)) !== null && inputs.length < 20) {
        inputs.push({
          number: parseInt(match[2]),
          title: match[3],
          state: match[1],
        });
      }

      res.json({
        connected: true,
        host,
        port: parseInt(port),
        inputs,
        preview: previewMatch ? parseInt(previewMatch[1]) : 0,
        program: programMatch ? parseInt(programMatch[1]) : 0,
        recording: recordingMatch?.[1] === "True",
        streaming: streamingMatch?.[1] === "True",
      });
    } catch (error: any) {
      // vMix недоступен - это нормально, не крашим приложение
      console.warn("vMix status: недоступен (это нормально, если vMix не запущен)");
      res.json({
        connected: false,
        message: "vMix недоступен"
      });
    }
  });

  // vMix API — таймкод (режиссёр задаёт в vMix; читаем из XML состояния)
  app.get("/api/vmix/timecode", async (req, res) => {
    try {
      const host = (req.query.host as string) || "localhost";
      const port = (req.query.port as string) || "8088";
      const vmixUrl = `http://${host}:${port}/api`;
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const xmlResponse = await fetch(vmixUrl, { signal: controller.signal as any });
      if (!xmlResponse.ok) {
        return res.json({ timecode: null, source: "vmix", error: "vMix не отвечает" });
      }
      const xmlText = await xmlResponse.text();
      // vMix XML может содержать время записи/таймкод в разных тегах
      const tcMatch = xmlText.match(/<timecode[^>]*>([^<]+)<\/timecode>/i)
        || xmlText.match(/recordingTimecode="([^"]+)"/)
        || xmlText.match(/timecode="([^"]+)"/);
      const timecode = tcMatch ? tcMatch[1].trim() : null;
      res.json({ timecode, source: "vmix" });
    } catch (e: any) {
      res.json({ timecode: null, source: "vmix", error: e?.message || "vMix недоступен" });
    }
  });

  // vMix API - выполнение команды
  app.post("/api/vmix/command", async (req, res) => {
    try {
      const { command, host, port, input } = req.body;

      if (!command) {
        return res.status(400).json({ message: "Command is required" });
      }

      const vmixHost = host || "localhost";
      const vmixPort = port || 8088;
      const vmixUrl = `http://${vmixHost}:${vmixPort}/api`;

      // Формирование URL для команды
      let commandUrl = `${vmixUrl}?Function=${command}`;
      if (input !== undefined) {
        commandUrl += `&Input=${input}`;
      }

      const response = await fetch(commandUrl);

      if (!response.ok) {
        throw new Error(`Command failed: ${response.statusText}`);
      }

      res.json({
        success: true,
        command,
        response: await response.text(),
      });
    } catch (error: any) {
      console.error("vMix command error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to execute vMix command",
      });
    }
  });

  // vMix API - получение расписания
  app.get("/api/vmix/scheduler", async (req, res) => {
    try {
      const events = await storage.getVmixSchedulerEvents();

      // Преобразуем в формат для фронтенда
      const formattedEvents = events.map(event => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime?.toISOString() || new Date().toISOString(),
        endTime: event.endTime?.toISOString(),
        status: event.status,
        actions: Array.isArray(event.actions) ? event.actions : [],
        input: event.input,
        vmixHost: event.vmixHost,
        vmixPort: event.vmixPort,
      }));

      res.json({
        events: formattedEvents,
      });
    } catch (error: any) {
      console.error("vMix scheduler error:", error);
      res.status(500).json({
        events: [],
        message: error.message || "Failed to fetch scheduler events",
      });
    }
  });

  // vMix API - создание события
  app.get("/api/agents/:agentKey/vmix-scheduler/due", async (req, res) => {
    try {
      const agentKey = String(req.params.agentKey || "").trim();
      const companyId = String(req.query.companyId || "").trim();
      const workspaceKey = String(req.query.workspaceKey || "").trim();
      const includeGlobal = String(req.query.global || "") === "true";
      const lookAheadSec = Math.max(5, Math.min(300, Number(req.query.lookAheadSec || 30)));
      if (!agentKey) return res.status(400).json({ events: [], message: "agentKey is required" });

      const company = companyId ? await storage.getCompanyById(companyId).catch(() => undefined) : undefined;
      const settings = company?.settings && typeof company.settings === "object" ? company.settings as any : {};
      const expectedKey = String(settings.monitoring?.workspaceKey || "");
      if (!company || !expectedKey || workspaceKey !== expectedKey) {
        return res.status(403).json({ events: [], message: "Agent workspace rejected" });
      }

      const now = Date.now();
      const windowEnd = now + lookAheadSec * 1000;
      const events = await storage.getVmixSchedulerEvents();
      const dueEvents = events.filter((event: any) => {
        if (event.status !== "scheduled") return false;
        const startMs = new Date(event.startTime).getTime();
        if (!Number.isFinite(startMs) || startMs < now - 5000 || startMs > windowEnd) return false;
        const target = String(event.vmixHost || "").trim();
        return target === agentKey || (includeGlobal && !target);
      });

      for (const event of dueEvents) {
        await storage.updateVmixSchedulerEvent(event.id, {
          status: "live",
          executedAt: new Date(),
        } as any).catch(() => undefined);
      }

      res.json({
        events: dueEvents.map((event: any) => ({
          id: event.id,
          title: event.title,
          startTime: event.startTime?.toISOString?.() || new Date(event.startTime).toISOString(),
          actions: Array.isArray(event.actions) ? event.actions : [],
          input: event.input,
        })),
      });
    } catch (error: any) {
      console.error("[Agent vMix scheduler] due failed:", error?.message || error);
      res.status(500).json({ events: [], message: error?.message || "Failed to fetch due events" });
    }
  });

  app.post("/api/agents/vmix-scheduler/:eventId/result", async (req, res) => {
    try {
      const { eventId } = req.params;
      const { agentKey, companyId, workspaceKey, status, message, executedAt } = req.body || {};
      const company = companyId ? await storage.getCompanyById(String(companyId)).catch(() => undefined) : undefined;
      const settings = company?.settings && typeof company.settings === "object" ? company.settings as any : {};
      const expectedKey = String(settings.monitoring?.workspaceKey || "");
      if (!company || !expectedKey || String(workspaceKey || "") !== expectedKey) {
        return res.status(403).json({ message: "Agent workspace rejected" });
      }

      const event = await storage.getVmixSchedulerEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const target = String((event as any).vmixHost || "").trim();
      if (target && target !== String(agentKey || "").trim()) {
        return res.status(403).json({ message: "Event belongs to another agent" });
      }

      const normalizedStatus = status === "completed" ? "completed" : status === "error" ? "error" : "live";
      const updated = await storage.updateVmixSchedulerEvent(eventId, {
        status: normalizedStatus,
        executedAt: executedAt ? new Date(executedAt) : new Date(),
        errorMessage: normalizedStatus === "error" ? String(message || "Agent execution failed") : null,
      } as any);
      res.json({ ok: true, event: updated });
    } catch (error: any) {
      console.error("[Agent vMix scheduler] result failed:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to save result" });
    }
  });

  app.post("/api/vmix/scheduler/events", async (req, res) => {
    try {
      const { title, startTime, input, actions, vmixHost, vmixPort } = req.body;

      if (!title || !startTime) {
        return res.status(400).json({ message: "Title and startTime are required" });
      }

      const newEvent = await storage.createVmixSchedulerEvent({
        title,
        startTime: new Date(startTime),
        status: "scheduled",
        actions: actions || [],
        input: input || null,
        vmixHost: vmixHost || null,
        vmixPort: vmixPort || null,
      });

      res.json({
        id: newEvent.id,
        title: newEvent.title,
        startTime: newEvent.startTime?.toISOString(),
        endTime: newEvent.endTime?.toISOString(),
        status: newEvent.status,
        actions: Array.isArray(newEvent.actions) ? newEvent.actions : [],
        input: newEvent.input,
        vmixHost: newEvent.vmixHost,
        vmixPort: newEvent.vmixPort,
      });
    } catch (error: any) {
      console.error("vMix create event error:", error);
      res.status(500).json({
        message: error.message || "Failed to create event",
      });
    }
  });

  // vMix API - обновление события
  app.put("/api/vmix/scheduler/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, startTime, input, actions, status, vmixHost, vmixPort, executedAt, errorMessage } = req.body;

      const updateData: any = {};
      if (title) updateData.title = title;
      if (startTime) updateData.startTime = new Date(startTime);
      if (input !== undefined) updateData.input = input;
      if (actions) updateData.actions = actions;
      if (status) updateData.status = status;
      if (vmixHost !== undefined) updateData.vmixHost = vmixHost;
      if (vmixPort !== undefined) updateData.vmixPort = vmixPort;
      if (executedAt !== undefined) updateData.executedAt = executedAt ? new Date(executedAt) : null;
      if (errorMessage !== undefined) updateData.errorMessage = errorMessage;

      const updatedEvent = await storage.updateVmixSchedulerEvent(id, updateData);

      if (!updatedEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json({
        id: updatedEvent.id,
        title: updatedEvent.title,
        startTime: updatedEvent.startTime?.toISOString(),
        endTime: updatedEvent.endTime?.toISOString(),
        status: updatedEvent.status,
        actions: Array.isArray(updatedEvent.actions) ? updatedEvent.actions : [],
        input: updatedEvent.input,
        vmixHost: updatedEvent.vmixHost,
        vmixPort: updatedEvent.vmixPort,
        executedAt: updatedEvent.executedAt?.toISOString(),
        errorMessage: updatedEvent.errorMessage,
      });
    } catch (error: any) {
      console.error("vMix update event error:", error);
      res.status(500).json({
        message: error.message || "Failed to update event",
      });
    }
  });

  // vMix API - удаление события
  app.delete("/api/vmix/scheduler/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteVmixSchedulerEvent(id);

      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("vMix delete event error:", error);
      res.status(500).json({
        message: error.message || "Failed to delete event",
      });
    }
  });

  // Rooms (аудитории/кабинеты для карт: редактируемые вместимость и уровень доступа)
  type RoomRow = { id: string; name: string; type: string; capacity: number; accessLevel: string; floorId: string };
  const defaultRoomsList: RoomRow[] = [
    { id: "100", name: "100", type: "Кабинет", capacity: 4, accessLevel: "green", floorId: "floor-1" },
    { id: "101", name: "101", type: "Кабинет", capacity: 6, accessLevel: "green", floorId: "floor-1" },
    { id: "102", name: "102", type: "Переговорная", capacity: 8, accessLevel: "green", floorId: "floor-1" },
    { id: "103", name: "103", type: "Переговорная", capacity: 10, accessLevel: "green", floorId: "floor-1" },
    { id: "107", name: "107", type: "Большая лекционная «Север»", capacity: 150, accessLevel: "red", floorId: "floor-1" },
    { id: "109", name: "109", type: "Лекционная", capacity: 80, accessLevel: "yellow", floorId: "floor-1" },
    { id: "110", name: "110", type: "Аудитория", capacity: 40, accessLevel: "yellow", floorId: "floor-1" },
    { id: "111", name: "111", type: "Кабинет", capacity: 2, accessLevel: "red", floorId: "floor-1" },
    { id: "112", name: "112", type: "Студия", capacity: 15, accessLevel: "yellow", floorId: "floor-1" },
    { id: "200", name: "200", type: "Лекционная", capacity: 100, accessLevel: "yellow", floorId: "floor-2" },
    { id: "201", name: "201", type: "Кабинет", capacity: 4, accessLevel: "green", floorId: "floor-2" },
    { id: "202", name: "202", type: "Переговорная", capacity: 12, accessLevel: "green", floorId: "floor-2" },
    { id: "300", name: "300", type: "Конференц-зал", capacity: 200, accessLevel: "red", floorId: "floor-3" },
    { id: "301", name: "301", type: "Кабинет", capacity: 4, accessLevel: "green", floorId: "floor-3" },
  ];
  let roomsStore: RoomRow[] = defaultRoomsList.map((r) => ({ ...r }));
  app.get("/api/rooms", async (_req, res) => {
    res.json(roomsStore);
  });
  app.get("/api/rooms/:id", async (req, res) => {
    const room = roomsStore.find((r) => r.id === req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  });
  app.put("/api/rooms/:id", async (req, res) => {
    const { id } = req.params;
    const { capacity, accessLevel, name, type } = req.body;
    const index = roomsStore.findIndex((r) => r.id === id);
    if (index === -1) return res.status(404).json({ message: "Room not found" });
    if (capacity != null) roomsStore[index].capacity = Number(capacity);
    if (accessLevel != null) roomsStore[index].accessLevel = String(accessLevel);
    if (name != null) roomsStore[index].name = String(name);
    if (type != null) roomsStore[index].type = String(type);
    res.json(roomsStore[index]);
  });

  // Notifications
  app.get("/api/notifications/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!req.user?.id || String(userId) !== String(req.user.id)) {
      return res.status(404).json({ message: "Notifications not found" });
    }
    // Используем withDbTimeout для быстрой обработки ошибок БД
    const notifications = await withDbTimeout(
      () => storage.getNotificationsByUser(userId),
      3000,
      [] // Пустой массив по умолчанию
    );
    res.json(notifications);
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const notificationData = insertNotificationSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      const notification = await storage.createNotification(notificationData);
      res.json(notification);
    } catch (error) {
      res.status(400).json({ message: "Invalid notification data" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const ownNotifications = await storage.getNotificationsByUser(req.user.id);
      if (!(ownNotifications as any[]).some((notification) => String(notification.id) === String(id))) {
        return res.status(404).json({ message: "Notification not found" });
      }
      const success = await storage.markNotificationRead(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const ownNotifications = await storage.getNotificationsByUser(req.user.id);
      if (!(ownNotifications as any[]).some((notification) => String(notification.id) === String(id))) {
        return res.status(404).json({ message: "Notification not found" });
      }
      const success = await storage.markNotificationRead(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Требуется авторизация" });
      const count = await storage.markAllNotificationsRead(userId);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const ownNotifications = await storage.getNotificationsByUser(req.user.id);
      if (!(ownNotifications as any[]).some((notification) => String(notification.id) === String(id))) {
        return res.status(404).json({ message: "Notification not found" });
      }
      const success = await storage.deleteNotification(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  const requireEquipmentPhotoWorkspace = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!(await requireActiveCompanyWorkspace(req, res))) return;
    next();
  };

  const requireEquipmentPhotoTarget = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    try {
      if (!(await requireActiveCompanyWorkspace(req, res))) return;
      const item = await storage.getEquipmentById(req.params.id);
      if (!item) return res.status(404).json({ message: "Equipment not found" });
      await ensureEquipmentCompanyAccess(req.user, item);
      (req as any).equipmentPhotoTarget = item;
      next();
    } catch (error: any) {
      if (sendEquipmentKitActionError(res, error)) return;
      res.status(403).json({ message: "Нет доступа к оборудованию" });
    }
  };

  // Equipment Photo Upload
  app.post("/api/equipment/photos/upload", requireEquipmentPhotoWorkspace, upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No photo file provided" });
      }

      res.json({ url: `/uploads/${req.file.filename}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  app.post("/api/equipment/:id/photos", requireEquipmentPhotoTarget, upload.single('photo'), async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No photo file provided" });
      }

      const photoUrl = `/uploads/${req.file.filename}`;
      const equipment = await storage.uploadEquipmentPhoto(id, photoUrl);

      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      res.json(equipment);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ============= TRANSCRIPTIONS (PODCAST FOLDERS & FILES) =============

  const TRANSCRIPTIONS_BASE_DIR = path.join(process.cwd(), "uploads", "transcriptions");

  // Helper to safely join paths inside transcriptions directory
  function getSafeTranscriptionPath(...segments: string[]) {
    const safeSegments = segments.map((seg) =>
      seg
        .toString()
        .trim()
        .replace(/(\.\.[/\\])/g, "")
        .replace(/[^\p{L}0-9_\-/\\ .]/gu, "_") // точка разрешена для расширений файлов (.mp3 и т.д.)
    );
    return path.join(TRANSCRIPTIONS_BASE_DIR, ...safeSegments);
  }

  // List all podcast folders
  app.get("/api/transcriptions/podcasts", async (req, res) => {
    try {
      try {
        await fs.mkdir(TRANSCRIPTIONS_BASE_DIR, { recursive: true });
      } catch {
        // ignore
      }

      const entries = await fs.readdir(TRANSCRIPTIONS_BASE_DIR, { withFileTypes: true });
      const podcasts = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          name: entry.name,
        }));

      res.json(podcasts);
    } catch (error) {
      console.error("Failed to list podcasts:", error);
      res.status(500).json({ message: "Failed to list podcasts" });
    }
  });

  // Create new podcast folder
  app.post("/api/transcriptions/podcasts", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Название подкаста обязательно" });
      }

      const dirPath = getSafeTranscriptionPath(name);
      await fs.mkdir(dirPath, { recursive: true });

      res.json({ name });
    } catch (error) {
      console.error("Failed to create podcast:", error);
      res.status(500).json({ message: "Не удалось создать подкаст" });
    }
  });

  // Delete entire podcast (folder and all contents)
  app.delete("/api/transcriptions/podcasts/:podcast", async (req, res) => {
    try {
      const { podcast } = req.params;
      const dirPath = getSafeTranscriptionPath(podcast);
      const realPath = path.resolve(dirPath);
      const realBase = path.resolve(TRANSCRIPTIONS_BASE_DIR);
      if (!realPath.startsWith(realBase) || realPath === realBase) {
        return res.status(400).json({ message: "Недопустимое имя подкаста" });
      }
      const stat = await fs.stat(realPath).catch(() => null);
      if (!stat || !stat.isDirectory()) {
        return res.status(404).json({ message: "Подкаст не найден" });
      }
      await fs.rm(realPath, { recursive: true });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete podcast:", error);
      res.status(500).json({ message: error?.message || "Не удалось удалить подкаст" });
    }
  });

  // List contents of a podcast (folders + files)
  app.get("/api/transcriptions/podcasts/:podcast/contents", async (req, res) => {
    try {
      const { podcast } = req.params;
      const { path: relativePath = "" } = req.query;

      const targetDir = getSafeTranscriptionPath(podcast, String(relativePath || ""));

      try {
        await fs.mkdir(targetDir, { recursive: true });
      } catch {
        // ignore
      }

      const entries = await fs.readdir(targetDir, { withFileTypes: true });

      const folders = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({
          name: e.name,
          type: "folder" as const,
        }));

      const files = entries
        .filter((e) => e.isFile())
        .map((e) => ({
          name: e.name,
          type: "file" as const,
        }));

      res.json({ folders, files });
    } catch (error) {
      console.error("Failed to list podcast contents:", error);
      res.status(500).json({ message: "Failed to list podcast contents" });
    }
  });

  // Create subfolder inside podcast
  app.post("/api/transcriptions/podcasts/:podcast/folders", async (req, res) => {
    try {
      const { podcast } = req.params;
      const { parentPath = "", name } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Название папки обязательно" });
      }

      const targetDir = getSafeTranscriptionPath(podcast, String(parentPath || ""), name);
      await fs.mkdir(targetDir, { recursive: true });

      res.json({ name });
    } catch (error) {
      console.error("Failed to create subfolder:", error);
      res.status(500).json({ message: "Failed to create subfolder" });
    }
  });

  // Delete file or folder inside podcast
  app.delete("/api/transcriptions/podcasts/:podcast/contents", async (req, res) => {
    try {
      const { podcast } = req.params;
      const { path: relativePath } = req.query;
      if (relativePath === undefined || relativePath === "") {
        return res.status(400).json({ message: "Укажите path (файл или папку)" });
      }
      const targetPath = getSafeTranscriptionPath(podcast, String(relativePath));
      const basePath = getSafeTranscriptionPath(podcast);
      const realTarget = path.resolve(targetPath);
      const realBase = path.resolve(basePath);
      if (!realTarget.startsWith(realBase)) {
        return res.status(400).json({ message: "Недопустимый путь" });
      }
      const stat = await fs.stat(realTarget).catch(() => null);
      if (!stat) {
        return res.status(404).json({ message: "Файл или папка не найдены" });
      }
      if (stat.isDirectory()) {
        await fs.rm(realTarget, { recursive: true });
      } else {
        await fs.unlink(realTarget);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete transcription item:", error);
      res.status(500).json({ message: error?.message || "Не удалось удалить" });
    }
  });

  // Upload file into podcast/folder (сохраняем во временную папку, затем переносим — req.body в multer destination может быть ещё пуст)
  const transcriptionUploadTempDir = path.join(process.cwd(), "uploads", "transcriptions", "_upload");
  const transcriptionUploadToTemp = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdir(transcriptionUploadTempDir, { recursive: true }).then(() => cb(null, transcriptionUploadTempDir)).catch((err) => cb(err as any, ""));
      },
      filename: (_, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const originalName = file.originalname || "file";
        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext).replace(/[^\p{L}0-9_\- ]/gu, "_");
        cb(null, base + "-" + uniqueSuffix + ext);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  app.post(
    "/api/transcriptions/upload",
    transcriptionUploadToTemp.single("file"),
    async (req, res) => {
      try {
        const podcast = (req.body?.podcast || "").toString().trim();
        const relativePath = (req.body?.path || "").toString().trim();

        if (!podcast) {
          if (req.file) await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({ message: "Выберите подкаст (папку) для загрузки" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "Файл не выбран" });
        }

        const safePodcast = podcast.replace(/[^\p{L}0-9_\- ]/gu, "_");
        const safeRelative = relativePath.replace(/(\.\.[/\\])/g, "").replace(/[^\p{L}0-9_\-/\\ ]/gu, "_");
        const targetDir = safeRelative
          ? path.join(TRANSCRIPTIONS_BASE_DIR, safePodcast, safeRelative)
          : path.join(TRANSCRIPTIONS_BASE_DIR, safePodcast);
        await fs.mkdir(targetDir, { recursive: true });
        const targetPath = path.join(targetDir, req.file.filename);
        await fs.rename(req.file.path, targetPath);

        const storagePath = path.relative(process.cwd(), targetPath);
        res.json({
          name: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          podcast: safePodcast,
          path: relativePath,
          url: `/${storagePath.replace(/\\\\/g, "/")}`,
        });
      } catch (error: any) {
        if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
        console.error("Failed to upload transcription file:", error);
        res.status(500).json({ message: error?.message || "Не удалось загрузить файл" });
      }
    }
  );

  // Health check для AI транскрибации
  app.get("/api/ai-transcription/health", async (req, res) => {
    try {
      const { whisperXClient } = await import("./services/whisper-x-client.js");
      if (!whisperXClient.isConfigured()) {
        return res.json({ available: false, message: "Whisper X API не настроен" });
      }
      const isAvailable = await whisperXClient.healthCheck();
      res.json({ available: isAvailable });
    } catch (error: any) {
      res.json({ available: false, message: error.message });
    }
  });

  // Новый endpoint для AI транскрибации с сохранением в чат
  app.post(
    "/api/ai-transcription/transcribe",
    transcriptionUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "File is required" });
        }

        const {
          format = "txt",
          language = "ru",
          numSpeakers,
          diarize = true,
          chatSessionId, // ID чата для сохранения результата
          userId, // ID пользователя
        } = req.body;
        const outputFormat = format.toLowerCase();

        const speakerCount = numSpeakers ? parseInt(numSpeakers, 10) : undefined;

        const isAudioVideo =
          req.file.mimetype.startsWith("audio/") ||
          req.file.mimetype.startsWith("video/");

        if (!isAudioVideo) {
          return res.status(400).json({
            message: "File must be an audio or video file"
          });
        }

        // Проверяем доступность Whisper X
        const { whisperXClient } = await import("./services/whisper-x-client.js");
        if (!whisperXClient.isConfigured()) {
          return res.status(503).json({
            message: "Whisper X API не настроен. Проверьте переменные окружения.",
            available: false
          });
        }

        console.log(`[AI Transcription] Starting transcription for ${req.file.originalname}...`);

        // Транскрибируем через Whisper X
        const transcriptionResult = await whisperXClient.transcribe(req.file.path, {
          language: language === "auto" ? undefined : language,
          returnTimestamps: outputFormat !== "txt",
          diarize: diarize === true || diarize === "true",
          numSpeakers: speakerCount && speakerCount > 0 ? speakerCount : undefined,
        });

        console.log(`[AI Transcription] Transcription completed, generating ${outputFormat.toUpperCase()}...`);

        // Импортируем генератор документов (с обработкой ошибок)
        let documentGenerator;
        try {
          const docGenModule = await import("./services/document-generator.js");
          documentGenerator = docGenModule.documentGenerator;
        } catch (error: any) {
          return res.status(503).json({
            message: "Генератор документов недоступен. Установите зависимости: npm install docx pdfkit",
            error: error.message,
            available: false
          });
        }

        // Генерируем файл
        const outputDir = path.join(process.cwd(), "uploads", "transcriptions", "output");
        await fs.mkdir(outputDir, { recursive: true });

        const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));
        const timestamp = Date.now();
        let outputPath: string;
        let mimeType: string;
        let downloadFileName: string;

        try {
          if (outputFormat === "doc" || outputFormat === "docx") {
            outputPath = path.join(outputDir, `${originalName}-${timestamp}.docx`);
            await documentGenerator.generateDOC(transcriptionResult, outputPath);
            mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            downloadFileName = `${originalName}-transcription.docx`;
          } else if (outputFormat === "pdf") {
            outputPath = path.join(outputDir, `${originalName}-${timestamp}.pdf`);
            await documentGenerator.generatePDF(transcriptionResult, outputPath);
            mimeType = "application/pdf";
            downloadFileName = `${originalName}-transcription.pdf`;
          } else {
            // TXT формат
            outputPath = path.join(outputDir, `${originalName}-${timestamp}.txt`);
            let textContent = transcriptionResult.text;

            if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
              const formatTime = (seconds: number): string => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
              };
              textContent = transcriptionResult.segments
                .map((seg) => {
                  const timeStr = `[${formatTime(seg.start)}]`;
                  const speakerStr = seg.speakerLabel ? `${seg.speakerLabel}: ` : "";
                  return `${speakerStr}${timeStr} ${seg.text}`;
                })
                .join("\n\n");
            }

            await fs.writeFile(outputPath, textContent, "utf-8");
            mimeType = "text/plain";
            downloadFileName = `${originalName}-transcription.txt`;
          }
        } catch (genError: any) {
          // Если ошибка связана с отсутствием пакетов, возвращаем понятное сообщение
          if (genError.message && (genError.message.includes("docx") || genError.message.includes("pdfkit"))) {
            return res.status(503).json({
              message: genError.message,
              available: false
            });
          }
          throw genError;
        }

        const relativePath = path.relative(process.cwd(), outputPath);
        const fileUrl = `/${relativePath.replace(/\\\\/g, "/")}`;
        const stats = await fs.stat(outputPath);

        let chatMessageId: string | undefined;

        // Сохраняем результат в чат, если указан chatSessionId
        if (chatSessionId && userId) {
          try {
            const messageContent = `Транскрибация завершена:\n\nЯзык: ${transcriptionResult.language || language}\nФормат: ${outputFormat.toUpperCase()}\n${transcriptionResult.speakerCount ? `Спикеров: ${transcriptionResult.speakerCount}\n` : ""}\nФайл: ${downloadFileName}`;

            const message = await storage.createChatMessage({
              sessionId: chatSessionId,
              role: "assistant",
              content: messageContent,
              attachments: [{
                id: crypto.randomUUID(),
                name: downloadFileName,
                url: fileUrl,
                type: mimeType,
                size: stats.size,
              }],
            });

            chatMessageId = message.id;
          } catch (chatError: any) {
            console.warn("[AI Transcription] Failed to save to chat:", chatError);
            // Не прерываем процесс, просто не сохраняем в чат
          }
        }

        res.json({
          success: true,
          transcription: transcriptionResult.text,
          segments: transcriptionResult.segments,
          language: transcriptionResult.language || language,
          format: outputFormat,
          speakerCount: transcriptionResult.speakerCount,
          file: {
            url: fileUrl,
            name: downloadFileName,
            size: stats.size,
            mimeType,
          },
          chatMessageId,
        });
      } catch (error: any) {
        console.error("[AI Transcription] Failed to transcribe:", error);
        res.status(500).json({
          message: "Failed to transcribe file",
          error: error.message
        });
      }
      throw new Error("Transcription service is not configured");
    }
  );

  // Старый endpoint для обратной совместимости (deprecated)
  app.post(
    "/api/transcriptions/transcribe",
    transcriptionUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "File is required" });
        }

        const {
          format = "txt",
          language = "ru",
          numSpeakers,
          diarize = true, // По умолчанию включаем диаризацию
        } = req.body;
        const outputFormat = format.toLowerCase(); // "txt", "doc", "pdf"

        // Парсим количество спикеров
        const speakerCount = numSpeakers ? parseInt(numSpeakers, 10) : undefined;

        // Проверяем, что файл является аудио или видео
        const isAudioVideo =
          req.file.mimetype.startsWith("audio/") ||
          req.file.mimetype.startsWith("video/");

        if (!isAudioVideo) {
          return res.status(400).json({
            message: "File must be an audio or video file"
          });
        }

        console.log(`[Transcription] Starting transcription for ${req.file.originalname}...`);

        // Импортируем сервисы
        const { whisperXClient } = await import("./services/whisper-x-client.js");

        // Импортируем генератор документов (с обработкой ошибок)
        let documentGenerator;
        try {
          const docGenModule = await import("./services/document-generator.js");
          documentGenerator = docGenModule.documentGenerator;
        } catch (error: any) {
          return res.status(503).json({
            message: "Генератор документов недоступен. Установите зависимости: npm install docx pdfkit",
            error: error.message,
            available: false
          });
        }

        // Транскрибируем через Whisper X с диаризацией спикеров
        const transcriptionResult = await whisperXClient.transcribe(req.file.path, {
          language: language === "auto" ? undefined : language,
          returnTimestamps: outputFormat !== "txt", // Временные метки для DOC/PDF
          diarize: diarize === true || diarize === "true",
          numSpeakers: speakerCount && speakerCount > 0 ? speakerCount : undefined,
        });

        console.log(`[Transcription] Transcription completed, generating ${outputFormat.toUpperCase()}...`);

        // Генерируем файл в нужном формате
        const outputDir = path.join(process.cwd(), "uploads", "transcriptions", "output");
        await fs.mkdir(outputDir, { recursive: true });

        const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));
        const timestamp = Date.now();
        let outputPath: string;
        let mimeType: string;
        let downloadFileName: string;

        try {
          if (outputFormat === "doc" || outputFormat === "docx") {
            outputPath = path.join(outputDir, `${originalName}-${timestamp}.docx`);
            await documentGenerator.generateDOC(transcriptionResult, outputPath);
            mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            downloadFileName = `${originalName}-transcription.docx`;
          } else if (outputFormat === "pdf") {
            outputPath = path.join(outputDir, `${originalName}-${timestamp}.pdf`);
            await documentGenerator.generatePDF(transcriptionResult, outputPath);
            mimeType = "application/pdf";
            downloadFileName = `${originalName}-transcription.pdf`;
          } else {
            // TXT формат
            outputPath = path.join(outputDir, `${originalName}-${timestamp}.txt`);
            let textContent = transcriptionResult.text;

            // Если есть сегменты, добавляем временные метки и спикеров
            if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
              const formatTime = (seconds: number): string => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
              };
              textContent = transcriptionResult.segments
                .map((seg) => {
                  const timeStr = `[${formatTime(seg.start)}]`;
                  const speakerStr = seg.speakerLabel ? `${seg.speakerLabel}: ` : "";
                  return `${speakerStr}${timeStr} ${seg.text}`;
                })
                .join("\n\n");
            }

            await fs.writeFile(outputPath, textContent, "utf-8");
            mimeType = "text/plain";
            downloadFileName = `${originalName}-transcription.txt`;
          }
        } catch (genError: any) {
          // Если ошибка связана с отсутствием пакетов, возвращаем понятное сообщение
          if (genError.message && (genError.message.includes("docx") || genError.message.includes("pdfkit"))) {
            return res.status(503).json({
              message: genError.message,
              available: false
            });
          }
          throw genError;
        }

        const relativePath = path.relative(process.cwd(), outputPath);
        const fileUrl = `/${relativePath.replace(/\\\\/g, "/")}`;

        // Получаем размер файла
        const stats = await fs.stat(outputPath);

        res.json({
          success: true,
          transcription: transcriptionResult.text,
          segments: transcriptionResult.segments,
          language: transcriptionResult.language || language,
          format: outputFormat,
          file: {
            url: fileUrl,
            name: downloadFileName,
            size: stats.size,
            mimeType,
          },
        });
      } catch (error: any) {
        console.error("[Transcription] Failed to transcribe:", error);
        res.status(500).json({
          message: "Failed to transcribe file",
          error: error.message
        });
      }
    }
  );

  // Equipment Reservations
  app.get("/api/equipment-reservations", async (req, res) => {
    try {
      if (!(await requireActiveCompanyWorkspace(req, res))) return;
      const { equipmentId } = req.query;
      let reservations;

      if (equipmentId) {
        reservations = await storage.getEquipmentReservationsByEquipment(equipmentId as string);
      } else {
        reservations = await storage.getEquipmentReservations();
      }

      const visibleReservations = [];
      for (const reservation of reservations as any[]) {
        const item = reservation.equipmentId
          ? await storage.getEquipmentById(String(reservation.equipmentId)).catch(() => undefined)
          : undefined;
        if (!item) continue;
        try {
          await ensureEquipmentCompanyAccess(req.user, item);
          visibleReservations.push(reservation);
        } catch {
          // Records without the selected company are quarantined from this workspace.
        }
      }
      res.json(visibleReservations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch equipment reservations" });
    }
  });

  app.post("/api/equipment-reservations", async (req, res) => {
    try {
      if (!(await requireActiveCompanyWorkspace(req, res))) return;
      const equipmentId = String(req.body?.equipmentId || "").trim();
      const item = equipmentId
        ? await storage.getEquipmentById(equipmentId).catch(() => undefined)
        : undefined;
      if (!item) return res.status(404).json({ message: "Equipment not found" });
      await ensureEquipmentCompanyAccess(req.user, item);
      const reservationData = insertEquipmentReservationSchema.parse({
        ...req.body,
        equipmentId,
        userId: (req.user as any).id,
      });

      // Check for conflicts
      const conflicts = await storage.checkEquipmentConflicts(
        reservationData.equipmentId!,
        new Date(reservationData.startTime),
        new Date(reservationData.endTime)
      );

      if (conflicts.length > 0) {
        return res.status(409).json({
          message: "Equipment is already reserved for this time period",
          conflicts
        });
      }

      const reservation = await storage.createEquipmentReservation(reservationData);
      res.json(reservation);
    } catch (error) {
      res.status(400).json({ message: "Invalid reservation data" });
    }
  });

  // System Management
  app.post("/api/systems", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const systemData = req.body;
      systemData.specifications = {
        ...(systemData.specifications && typeof systemData.specifications === "object"
          ? systemData.specifications
          : {}),
        companyId: workspace.companyId,
      };
      const system = await storage.createSystem(systemData);
      res.json(system);
    } catch (error) {
      res.status(400).json({ message: "Invalid system data" });
    }
  });

  app.delete("/api/systems/:id", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const { id } = req.params;
      const existing = await storage.getSystemById(id);
      const specifications = existing?.specifications && typeof existing.specifications === "object"
        ? existing.specifications as any
        : {};
      if (!existing || String(specifications.companyId || "") !== String(workspace.companyId)) {
        return res.status(404).json({ message: "System not found" });
      }
      const deleted = await storage.deleteSystem(id);
      if (!deleted) {
        return res.status(404).json({ message: "System not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete system" });
    }
  });

  app.post("/api/systems/:id/ping", async (req, res) => {
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const { id } = req.params;
      const system = await storage.getSystemById(id);

      if (!system || !system.ipAddress) {
        return res.status(404).json({ message: "System not found or no IP address" });
      }
      const specifications = system.specifications && typeof system.specifications === "object"
        ? system.specifications as any
        : {};
      if (String(specifications.companyId || "") !== String(workspace.companyId)) {
        return res.status(404).json({ message: "System not found or no IP address" });
      }

      const isOnline = await checkIP(system.ipAddress);
      const status = isOnline ? "online" : "offline";

      const updatedSystem = await storage.pingSystem(id, status);
      res.json({ system: updatedSystem, status });
    } catch (error) {
      res.status(500).json({ message: "Failed to ping system" });
    }
  });

  // Telegram Authentication
  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const telegramData = insertTelegramUserSchema.parse(req.body);

      // Check if telegram user already exists
      let telegramUser = await storage.getTelegramUserByTelegramId(telegramData.telegramId);

      if (!telegramUser) {
        telegramUser = await storage.createTelegramUser(telegramData);
      }

      res.json(telegramUser);
    } catch (error) {
      res.status(400).json({ message: "Invalid telegram data" });
    }
  });

  app.post("/api/auth/telegram/link", async (req, res) => {
    try {
      const { telegramId, userId } = req.body;
      const telegramUser = await storage.linkTelegramUser(telegramId, userId);

      if (!telegramUser) {
        return res.status(404).json({ message: "Telegram user not found" });
      }

      res.json(telegramUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to link telegram user" });
    }
  });

  // OBS Studio Integration
  app.get("/api/obs/connections", async (req, res) => {
    try {
      const connections = await storage.getObsConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch OBS connections" });
    }
  });

  app.post("/api/obs/connections", async (req, res) => {
    try {
      const obsData = insertObsConnectionSchema.parse(req.body);
      const connection = await storage.createObsConnection(obsData);
      res.json(connection);
    } catch (error) {
      res.status(400).json({ message: "Invalid OBS connection data" });
    }
  });

  app.put("/api/obs/connections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const connection = await storage.updateObsConnection(id, req.body);
      if (!connection) {
        return res.status(404).json({ message: "OBS connection not found" });
      }
      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: "Failed to update OBS connection" });
    }
  });

  app.delete("/api/obs/connections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteObsConnection(id);
      if (!deleted) {
        return res.status(404).json({ message: "OBS connection not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete OBS connection" });
    }
  });

  // Analytics
  app.get("/api/analytics", async (req, res) => {
    try {
      const { entityType, startDate, endDate } = req.query;
      const events = await storage.getAnalyticsEvents(
        entityType as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.post("/api/analytics", async (req, res) => {
    try {
      const analyticsData = insertAnalyticsEventSchema.parse(req.body);
      const event = await storage.createAnalyticsEvent(analyticsData);
      res.json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid analytics data" });
    }
  });

  // ============= TASKS API =============
  const canAccessTask = async (
    currentUser: any,
    task: any,
    providedWorkspace?: WorkspaceContext,
  ) => {
    if (!currentUser?.id || !task) return false;
    const workspace = providedWorkspace || await getActiveWorkspaceForUser(currentUser);
    if (!workspace.type || workspace.requiresSelection) return false;
    if (workspace.type === "company") {
      return Boolean(
        task.companyId &&
        String(task.companyId) === String(workspace.companyId || ""),
      );
    }
    if (task.companyId) return false;
    const userId = String(currentUser.id);
    if (
      String(task.creatorId || "") === userId ||
      String(task.assigneeId || "") === userId
    ) {
      return true;
    }
    if (!task.projectId) return false;
    const project = await storage.getProjectById(String(task.projectId)).catch(() => undefined);
    return Boolean(project && await canAccessProject(currentUser, project));
  };

  app.get("/api/tasks", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const userPermissions = (currentUser?.permissions || []) as string[];

      const { assigneeId, creatorId, status, yougileBoardId } = req.query;

      let tasks = await withDbTimeout(async () => {
        if (yougileBoardId) {
          const boardId = yougileBoardId as string;
          return await storage.getTasksByYougileBoardId(boardId);
        }
        let list: any[];
        if (assigneeId) {
          list = await storage.getTasksByAssignee(assigneeId as string);
        } else if (creatorId) {
          list = await storage.getTasksByCreator(creatorId as string);
        } else if (status) {
          list = await storage.getTasksByStatus(status as string);
        } else {
          list = await storage.getTasks();
        }
        // «Мои задачи»: только локальные задачи (без привязки к YouGile), чтобы задачи из досок YouGile не дублировались
        return list.filter((t: any) => !t.yougileBoardId);
      }, 3000, []); // 3 секунды для быстрого ответа

      const canViewAllInCompany = workspace.type === "company" &&
        userPermissions.includes("tasks:view_all");
      const accessResults = await Promise.all((tasks || []).map(async (task: any) => {
        if (
          canViewAllInCompany &&
          String(task.companyId || "") === String(workspace.companyId || "")
        ) {
          return task;
        }
        return (await canAccessTask(currentUser, task, workspace)) ? task : null;
      }));
      tasks = accessResults.filter(Boolean);

      res.json(tasks || []);
    } catch (error: any) {
      console.error("[Tasks API] Error fetching tasks:", error);
      // Возвращаем пустой массив вместо ошибки, чтобы UI не крашился
      res.status(500).json([]);
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTaskById(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (!(await canAccessTask(req.user, task))) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      console.log("[Tasks] Creating task...");
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const body = { ...(req.body || {}) };
      body.creatorId = currentUser.id;
      body.companyId = workspace.type === "company" ? workspace.companyId : null;
      for (const key of ["dueDate", "startDate", "completedAt"] as const) {
        if (body[key] === "" || body[key] === undefined) {
          delete body[key];
        } else if (body[key] === null) {
          body[key] = null;
        } else if (typeof body[key] === "string") {
          const date = new Date(body[key]);
          body[key] = Number.isNaN(date.getTime()) ? null : date;
        }
      }
      if (body.projectId) {
        const project = await storage.getProjectById(String(body.projectId)).catch(() => undefined);
        if (!project || !(await canAccessProject(currentUser, project))) {
          return res.status(403).json({ message: "Проект недоступен в выбранном пространстве" });
        }
        if (String(project.companyId || "") !== String(body.companyId || "")) {
          return res.status(400).json({ message: "Проект принадлежит другому рабочему пространству" });
        }
      }
      if (body.assigneeId) {
        const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
        if (!visibleUserIds.has(String(body.assigneeId))) {
          return res.status(403).json({ message: "Исполнитель недоступен в выбранном пространстве" });
        }
      }
      const taskData = insertTaskSchema.parse(body);

      console.log("[Tasks] Saving to database...");
      // Убираем таймаут для создания задач - пусть работает нормально
      const task = await storage.createTask(taskData);

      if (!task) {
        throw new Error("Failed to create task");
      }

      // Create history entry (не блокируем, если не получится)
      try {
        await storage.createTaskHistory({
          taskId: task.id,
          userId: taskData.creatorId,
          action: "created",
          newValue: task
        });
      } catch (historyError) {
        console.warn("[Tasks] Failed to create history entry:", historyError);
        // Не прерываем создание задачи, если история не создалась
      }

      // Уведомление исполнителю, если задача назначена
      if (task.assigneeId) {
        try {
          await storage.createNotification({
            userId: task.assigneeId,
            title: "Новая задача",
            message: `Вам назначена задача: ${task.title}`,
            type: "info",
          });
        } catch (notifErr) {
          console.warn("[Tasks] Failed to create notification:", notifErr);
        }
      }

      // Синхронизация с YouGile: создаём задачу в той колонке, которую выбрал пользователь (status = id колонки YouGile для досок)
      if (task) {
        try {
          const { isYouGileConfigured, yougileEnqueueCreate, yougileGetColumns, getYouGileDefaultColumnId, getYouGileColumnMap } = await import("./yougile");
          if (isYouGileConfigured()) {
            const taskAny = task as any;
            let yougileColumnId: string | null = null;
            if (taskAny.yougileBoardId) {
              let cols = await storage.getYougileColumns(taskAny.yougileBoardId);
              if (!cols.length) {
                const ygCols = await yougileGetColumns(taskAny.yougileBoardId);
                await storage.upsertYougileColumns(ygCols.map((c: any) => ({ id: c.id, boardId: taskAny.yougileBoardId, title: c.title ?? null, order: c.order ?? 0, color: (c as any).color ?? null })));
                cols = await storage.getYougileColumns(taskAny.yougileBoardId);
              }
              const statusFromClient = taskAny.status;
              if (statusFromClient && typeof statusFromClient === "string" && statusFromClient.length > 0) {
                const exists = cols.some((c: any) => c.id === statusFromClient);
                yougileColumnId = exists ? statusFromClient : (cols[0]?.id ?? null);
              }
              if (!yougileColumnId) yougileColumnId = cols[0]?.id ?? null;
            }
            if (!yougileColumnId) {
              const columnMap = getYouGileColumnMap();
              const status = taskAny.status;
              yougileColumnId = (status && columnMap[status]) ? columnMap[status] : null;
            }
            if (!yougileColumnId) yougileColumnId = await getYouGileDefaultColumnId();
            if (yougileColumnId) {
              const boardId = taskAny.yougileBoardId || "";
              yougileEnqueueCreate(task.id, boardId, {
                title: task.title,
                description: task.description || undefined,
                columnId: yougileColumnId,
                deadline: task.dueDate ? new Date(task.dueDate).getTime() : undefined,
              }, async (ygTask) => {
                await storage.updateTask(task.id, { yougileTaskId: ygTask.id, yougileBoardId: boardId || ygTask.boardId });
              });
            }
          }
        } catch (ygErr: any) {
          console.warn("[Tasks] YouGile sync on create failed:", ygErr?.message || ygErr);
        }
      }

      console.log("[Tasks] Task created successfully:", task.id);
      res.json(task);
    } catch (error: any) {
      const errMsg = error?.message ?? String(error);
      console.error("[Tasks] Error creating task:", errMsg);
      if (error?.stack) console.error(error.stack);
      const isZod = error?.name === "ZodError" || errMsg.includes("Invalid");
      const message = isZod
        ? "Проверьте поля: название обязательно; статус и приоритет — из списка"
        : (errMsg || "Не удалось создать задачу");
      res.status(400).json({
        message,
        error: errMsg
      });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const oldTask = await storage.getTaskById(id);
      if (!oldTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      const currentUser = req.user as any;
      if (!(await canAccessTask(currentUser, oldTask))) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Extract userId from request body before updating
      const { userId: _ignoredUserId, ...updateData } = req.body;
      delete updateData.companyId;
      delete updateData.creatorId;
      const workspace = await getActiveWorkspaceForUser(currentUser);
      if (updateData.projectId) {
        const project = await storage.getProjectById(String(updateData.projectId)).catch(() => undefined);
        if (!project || !(await canAccessProject(currentUser, project))) {
          return res.status(403).json({ message: "Проект недоступен в выбранном пространстве" });
        }
        if (String(project.companyId || "") !== String(oldTask.companyId || "")) {
          return res.status(400).json({ message: "Проект принадлежит другому рабочему пространству" });
        }
      }
      if (updateData.assigneeId) {
        const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
        if (!visibleUserIds.has(String(updateData.assigneeId))) {
          return res.status(403).json({ message: "Исполнитель недоступен в выбранном пространстве" });
        }
      }
      for (const key of ["dueDate", "startDate", "completedAt"] as const) {
        if (updateData[key] === "" || updateData[key] === undefined) {
          delete updateData[key];
        } else if (updateData[key] === null) {
          updateData[key] = null;
        } else if (typeof updateData[key] === "string") {
          const date = new Date(updateData[key]);
          updateData[key] = Number.isNaN(date.getTime()) ? null : date;
        }
      }
      if (updateData.projectColumnId) {
        const projectId = updateData.projectId || oldTask.projectId;
        if (projectId) {
          const columns = await storage.getProjectColumns(projectId).catch(() => []);
          const exists = (columns as any[]).some((column) => column.id === updateData.projectColumnId);
          if (!exists) delete updateData.projectColumnId;
        } else {
          delete updateData.projectColumnId;
        }
      }

      const task = await storage.updateTask(id, updateData);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Уведомление новому исполнителю при смене назначения
      if (updateData.assigneeId != null && updateData.assigneeId !== oldTask.assigneeId && task.assigneeId) {
        try {
          await storage.createNotification({
            userId: task.assigneeId,
            title: "Задача назначена",
            message: `Вам назначена задача: ${task.title}`,
            type: "info",
          });
        } catch (notifErr) {
          console.warn("[Tasks] Failed to create notification:", notifErr);
        }
      }

      // Create history entry
      if (currentUser?.id) {
        try {
          await storage.createTaskHistory({
            taskId: id,
            userId: currentUser.id,
            action: "updated",
            oldValue: oldTask,
            newValue: task
          });
        } catch (historyError) {
          console.error("Error creating task history:", historyError);
          // Don't fail the update if history creation fails
        }
      }

      if (oldTask?.dueDate && !task?.dueDate) {
        // Если дедлайн удален, удаляем событие из календаря
        try {
          const existingEvents = await storage.getEvents();
          const taskEvent = existingEvents.find(e =>
            String(e.companyId || "") === String(oldTask.companyId || "") &&
            (
              e.title === `Дедлайн: ${task.title}` ||
              e.title === `Дедлайн: ${oldTask.title}`
            )
          );
          if (taskEvent) {
            await storage.deleteEvent(taskEvent.id);
          }
        } catch (eventError) {
          console.warn("[Tasks] Failed to delete calendar event:", eventError);
        }
      }

      // Синхронизация с YouGile: ставим в очередь (при лимите API запросы выполнятся позже)
      if (oldTask && (oldTask as any).yougileTaskId) {
        try {
          const { isYouGileConfigured, yougileEnqueueUpdate, getYouGileColumnMap } = await import("./yougile");
          if (isYouGileConfigured()) {
            const payload: { title?: string; description?: string; deadline?: number; columnId?: string } = {
              title: task.title,
              description: task.description ?? undefined,
              deadline: task.dueDate ? new Date(task.dueDate).getTime() : undefined,
            };
            if (updateData.status != null) {
              const taskBoardId = (oldTask as any).yougileBoardId;
              const yougileColumnId = taskBoardId
                ? updateData.status
                : getYouGileColumnMap()[updateData.status];
              if (yougileColumnId) payload.columnId = yougileColumnId;
            }
            yougileEnqueueUpdate((oldTask as any).yougileTaskId, payload);
          }
        } catch (ygErr: any) {
          console.warn("[Tasks] YouGile sync on update failed:", ygErr?.message || ygErr);
        }
      }

      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTaskById(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (!(await canAccessTask(req.user, task))) {
        return res.status(404).json({ message: "Task not found" });
      }
      const yougileTaskId = (task as any).yougileTaskId;
      const deleted = await storage.deleteTask(id);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (yougileTaskId) {
        try {
          const { isYouGileConfigured, yougileEnqueueDelete } = await import("./yougile");
          if (isYouGileConfigured()) yougileEnqueueDelete(yougileTaskId);
        } catch (ygErr: any) {
          console.warn("[Tasks] YouGile sync on delete failed:", ygErr?.message || ygErr);
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Task Comments
  app.get("/api/tasks/:taskId/comments", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTaskById(taskId);
      if (!task || !(await canAccessTask(req.user, task))) {
        return res.status(404).json({ message: "Task not found" });
      }
      const comments = await storage.getTaskComments(taskId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/tasks/:taskId/comments", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTaskById(taskId);
      if (!task || !(await canAccessTask(req.user, task))) {
        return res.status(404).json({ message: "Task not found" });
      }
      const commentData = insertTaskCommentSchema.parse({
        ...req.body,
        taskId,
        userId: (req.user as any).id,
      });
      const comment = await storage.createTaskComment(commentData);
      try {
        await storage.createTaskHistory({
          taskId,
          userId: commentData.userId,
          action: "commented",
          newValue: { commentId: comment.id, content: comment.content?.slice(0, 200) },
        });
      } catch (e) {
        console.warn("[Tasks] Task history (comment) failed:", e);
      }
      if (task?.assigneeId && task.assigneeId !== commentData.userId) {
        try {
          await storage.createNotification({
            userId: task.assigneeId,
            title: "Новый комментарий к задаче",
            message: `Добавлен комментарий к задаче: ${task.title}`,
            type: "info",
          });
        } catch (e) {
          console.warn("[Tasks] Comment notification failed:", e);
        }
      }
      res.json(comment);
    } catch (error) {
      res.status(400).json({ message: "Invalid comment data" });
    }
  });

  app.delete("/api/tasks/:taskId/comments/:commentId", async (req, res) => {
    try {
      const { taskId, commentId } = req.params;
      const task = await storage.getTaskById(taskId);
      if (!task || !(await canAccessTask(req.user, task))) {
        return res.status(404).json({ message: "Task not found" });
      }
      const deleted = await storage.deleteTaskComment(commentId);
      if (!deleted) {
        return res.status(404).json({ message: "Comment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Task History
  app.get("/api/tasks/:taskId/history", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTaskById(taskId);
      if (!task || !(await canAccessTask(req.user, task))) {
        return res.status(404).json({ message: "Task not found" });
      }
      const history = await storage.getTaskHistory(taskId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task history" });
    }
  });

  // User Activity Logs (Admin only)
  app.get("/api/admin/user-logs", async (req, res) => {
    try {
      // Проверка аутентификации через заголовки или сессию
      // В будущем можно добавить middleware для проверки токена
      // Пока разрешаем доступ (в продакшене нужно добавить проверку токена и роли admin)

      const { userId, startDate, endDate, eventType, entityType } = req.query;

      let taskHistory: any[] = [];
      let analyticsEvents: any[] = [];

      // Получаем историю задач пользователя
      if (userId) {
        const allTasks = await storage.getTasks();
        const userTasks = allTasks.filter(t => t.creatorId === userId || t.assigneeId === userId);
        for (const task of userTasks) {
          const history = await storage.getTaskHistory(task.id);
          taskHistory.push(...history.filter(h => h.userId === userId));
        }
      } else {
        // Если userId не указан, получаем все логи
        const allTasks = await storage.getTasks();
        for (const task of allTasks) {
          const history = await storage.getTaskHistory(task.id);
          taskHistory.push(...history);
        }
      }

      // Получаем аналитические события
      const entityTypeFilter = entityType && entityType !== "all" ? entityType as string : undefined;
      analyticsEvents = await storage.getAnalyticsEvents(
        entityTypeFilter || "user",
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      // Фильтруем по userId, если указан
      if (userId) {
        analyticsEvents = analyticsEvents.filter(e => e.data?.userId === userId);
      }

      // Фильтруем по eventType, если указан
      if (eventType && eventType !== "all") {
        analyticsEvents = analyticsEvents.filter(e => e.eventType === eventType);
      }

      // Объединяем и сортируем по дате
      const allLogs = [
        ...taskHistory.map(h => ({
          id: h.id,
          type: "task_history",
          userId: h.userId,
          action: h.action,
          description: `Задача: ${h.action}`,
          data: { taskId: h.taskId, oldValue: h.oldValue, newValue: h.newValue },
          timestamp: h.createdAt
        })),
        ...analyticsEvents.map(e => ({
          id: e.id,
          type: "analytics",
          userId: e.data?.userId,
          action: e.eventType,
          description: `${e.entityType}: ${e.eventType}`,
          data: e.data,
          timestamp: e.timestamp
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(allLogs);
    } catch (error: any) {
      console.error("Error fetching user logs:", error);
      res.status(500).json({ message: "Failed to fetch user logs", error: error.message });
    }
  });

  // ============= ROLES API =============
  app.get("/api/roles", async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const role = await storage.getRoleById(id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", async (req, res) => {
    try {
      const roleData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(roleData);
      res.json(role);
    } catch (error) {
      res.status(400).json({ message: "Invalid role data" });
    }
  });

  app.put("/api/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existingRole = await storage.getRoleById(id);
      if (!existingRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      if (existingRole.isSystem) {
        return res.status(403).json({ message: "Cannot modify system role" });
      }
      const role = await storage.updateRole(id, req.body);
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existingRole = await storage.getRoleById(id);
      if (!existingRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      if (existingRole.isSystem) {
        return res.status(403).json({ message: "Cannot delete system role" });
      }
      await storage.deleteRole(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // ============= BARCODE SCANNER =============
  app.get("/api/equipment/barcode/:barcode", async (req, res) => {
    try {
      if (!(await requireActiveCompanyWorkspace(req, res))) return;
      const barcode = decodeURIComponent(String(req.params.barcode || "")).trim();
      const normalizeBarcode = (value: unknown) => String(value ?? "").trim().toLowerCase();
      let equipmentItem = await storage.getEquipmentByBarcode(barcode).catch(() => undefined);
      if (!equipmentItem) {
        const items = await storage.getEquipment().catch(() => []);
        const needle = normalizeBarcode(barcode);
        equipmentItem = (items as any[]).find((item) => {
          const candidates = [
            item.barcode,
            item.inventoryNumber,
            item.serialNumber,
            item.id,
          ].map(normalizeBarcode).filter(Boolean);
          return candidates.includes(needle);
        });
      }
      if (!equipmentItem) {
        return res.status(404).json({ message: "Equipment not found with this barcode" });
      }
      await ensureEquipmentCompanyAccess(req.user, equipmentItem);
      res.json(equipmentItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to find equipment" });
    }
  });

  // ============= TELEGRAM AUTH =============
  // Verify Telegram Login Widget data
  function verifyTelegramAuth(data: any, botToken: string): boolean {
    const { hash, ...authData } = data;
    const dataCheckString = Object.keys(authData)
      .sort()
      .map(key => `${key}=${authData[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return hmac === hash;
  }

  app.post("/api/auth/telegram/login", async (req, res) => {
    try {
      const telegramData = req.body;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      // For development, skip verification if no bot token
      const isVerified = botToken ? verifyTelegramAuth(telegramData, botToken) : true;

      if (!isVerified) {
        return res.status(401).json({ message: "Invalid Telegram auth data" });
      }

      const telegramId = String(telegramData.id);

      // Check if user exists by telegram ID
      let user = await storage.getUserByTelegramId(telegramId);

      if (!user) {
        // Check if telegram user record exists
        let telegramUser = await storage.getTelegramUserByTelegramId(telegramId);

        if (!telegramUser) {
          // Create telegram user record
          telegramUser = await storage.createTelegramUser({
            telegramId,
            username: telegramData.username,
            firstName: telegramData.first_name,
            lastName: telegramData.last_name,
            photoUrl: telegramData.photo_url,
            authDate: new Date(telegramData.auth_date * 1000)
          });
        } else {
          // Update telegram user record
          await storage.updateTelegramUser(telegramId, {
            username: telegramData.username,
            firstName: telegramData.first_name,
            lastName: telegramData.last_name,
            photoUrl: telegramData.photo_url,
            authDate: new Date(telegramData.auth_date * 1000)
          });
        }

        // Create a new user account
        const name = [telegramData.first_name, telegramData.last_name].filter(Boolean).join(' ');
        user = await storage.createUser({
          username: telegramData.username || `tg_${telegramId}`,
          password: crypto.randomBytes(32).toString('hex'), // Random password for Telegram users
          name: name || `Telegram User ${telegramId}`,
          telegramId,
          avatar: telegramData.photo_url,
          role: 'employee',
          active: true
        });

        // Link telegram user to the new user
        await storage.linkTelegramUser(telegramId, user.id);
      } else {
        // Update last login
        await storage.updateUser(user.id, { lastLogin: new Date() });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          permissions: user.permissions
        }
      });
    } catch (error) {
      console.error("Telegram auth error:", error);
      res.status(500).json({ message: "Failed to authenticate with Telegram" });
    }
  });

  // Get telegram users for admin
  app.get("/api/telegram-users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const telegramUsers = users.filter(u => u.telegramId);
      res.json(telegramUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch telegram users" });
    }
  });

  // ============= TELEGRAM GATEWAY AUTH =============
  // Хранилище активных кодов авторизации (в production лучше использовать Redis)
  const authCodes = new Map<string, {
    code: string;
    telegramId: string; // Номер телефона
    chatId: string; // Номер телефона
    username?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
    expiresAt: number;
    hash: string;
  }>();

  // Очистка истекших кодов каждые 5 минут
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of authCodes.entries()) {
      if (value.expiresAt < now) {
        authCodes.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  /**
   * Запрос кода авторизации через Telegram
   * Пользователь отправляет /start или /login боту, бот отправляет код
   * Затем пользователь вводит код на сайте
   */
  app.post("/api/auth/telegram/request-code", async (req, res) => {
    try {
      const { telegramId, chatId } = req.body;

      if (!telegramId || !chatId) {
        return res.status(400).json({ message: "Telegram ID и Chat ID обязательны" });
      }

      if (!telegramBot.isConfigured()) {
        return res.status(503).json({
          message: "Telegram бот не настроен. Добавьте TELEGRAM_BOT_TOKEN в .env"
        });
      }

      // Получаем информацию о пользователе
      const userInfo = await telegramBot.getUserInfo(chatId);
      if (!userInfo) {
        return res.status(404).json({ message: "Пользователь не найден в Telegram" });
      }

      // Генерируем код
      const code = telegramBot.generateAuthCode();
      const timestamp = Date.now();
      const expiresAt = timestamp + 10 * 60 * 1000; // 10 минут
      const hash = telegramBot.createCodeHash(code, telegramId, timestamp);

      // Сохраняем код
      const codeKey = `${telegramId}:${timestamp}`;
      authCodes.set(codeKey, {
        code,
        telegramId,
        chatId: String(chatId),
        username: userInfo.username,
        firstName: userInfo.first_name,
        lastName: userInfo.last_name,
        photoUrl: userInfo.photo_url,
        expiresAt,
        hash,
      });

      // Отправляем код пользователю через бота
      const message = `🔐 Код авторизации для StreamDesk:\n\n` +
        `\`${code}\`\n\n` +
        `Введите этот код на сайте для входа.\n` +
        `Код действителен 10 минут.`;

      const sent = await telegramBot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
      });

      if (!sent) {
        return res.status(500).json({ message: "Не удалось отправить код через Telegram" });
      }

      // Возвращаем только timestamp для безопасности
      res.json({
        success: true,
        timestamp,
        message: "Код отправлен в Telegram",
      });
    } catch (error: any) {
      console.error("[Telegram Gateway] Error requesting code:", error);
      res.status(500).json({ message: "Ошибка при запросе кода авторизации" });
    }
  });

  /**
   * Проверка кода авторизации
   */
  app.post("/api/auth/telegram/verify-code", async (req, res) => {
    try {
      const { code, phoneNumber, timestamp } = req.body;

      if (!code || !phoneNumber || !timestamp) {
        return res.status(400).json({ message: "Код, номер телефона и timestamp обязательны" });
      }

      // Ищем код
      const codeKey = `${phoneNumber}:${timestamp}`;
      const codeData = authCodes.get(codeKey);

      if (!codeData) {
        return res.status(404).json({ message: "Код не найден или истек" });
      }

      // Проверяем срок действия
      if (codeData.expiresAt < Date.now()) {
        authCodes.delete(codeKey);
        return res.status(410).json({ message: "Код истек" });
      }

      // Проверяем код
      if (codeData.code !== code) {
        return res.status(401).json({ message: "Неверный код" });
      }

      // Удаляем использованный код
      authCodes.delete(codeKey);

      // Проверяем или создаем пользователя по номеру телефона
      // Ищем пользователя по телефону (если есть поле phone в схеме)
      let user = await storage.getUserByTelegramId(phoneNumber);

      // Если не нашли по telegramId, ищем по телефону
      if (!user) {
        const allUsers = await storage.getUsers();
        user = allUsers.find((u: any) => u.phone === phoneNumber || u.telegramId === phoneNumber);
      }

      if (!user) {
        // Создаем нового пользователя
        const name = `Пользователь ${phoneNumber.slice(-4)}`; // Последние 4 цифры номера

        user = await storage.createUser({
          username: `phone_${phoneNumber.replace(/\D/g, "")}`,
          password: crypto.randomBytes(32).toString("hex"), // Случайный пароль
          name,
          phone: phoneNumber,
          telegramId: phoneNumber, // Сохраняем номер как telegramId для совместимости
          role: "employee",
          active: true,
        });

        // Создаем запись telegram user
        await storage.createTelegramUser({
          telegramId: phoneNumber,
          authDate: new Date(),
        });

        // Связываем
        await storage.linkTelegramUser(phoneNumber, user.id);
      } else {
        // Обновляем последний вход
        await storage.updateUser(user.id, { lastLogin: new Date() });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          permissions: user.permissions,
        },
      });
    } catch (error: any) {
      console.error("[Telegram Gateway] Error verifying code:", error);
      res.status(500).json({ message: "Ошибка при проверке кода" });
    }
  });

  // ============= USERS MANAGEMENT =============
  app.get("/api/users", async (req, res) => {
    const currentUser = req.user as any;
    if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return;
    const allUsers = await withDbTimeout(() => storage.getUsers(), 3000, []);
    const visibleIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
    res.json((allUsers as any[])
      .filter((u: any) => visibleIds.has(String(u.id)))
      .map((u: any) => ({ ...u, password: undefined })));
  });

  app.get("/api/platform/users", async (req, res) => {
    try {
      if (!requirePlatformAdmin(req, res)) return;
      const [users, companies, memberships] = await Promise.all([
        storage.getAllUsers(),
        storage.getCompanies().catch(() => []),
        Promise.all((await storage.getCompanies().catch(() => [])).map((company: any) => storage.getCompanyMembers(company.id).catch(() => []))).then((rows) => rows.flat()),
      ]);
      const companyById = new Map((companies as any[]).map((company) => [company.id, company]));
      const byUser = new Map<string, any[]>();
      for (const membership of memberships as any[]) {
        const list = byUser.get(membership.userId) || [];
        list.push({ ...membership, company: companyById.get(membership.companyId) || null });
        byUser.set(membership.userId, list);
      }
      res.json((users as any[]).map((user) => ({
        ...user,
        password: undefined,
        memberships: byUser.get(user.id) || [],
      })));
    } catch (error: any) {
      console.error("[Platform] users error:", error);
      res.status(500).json({ message: error?.message || "Не удалось загрузить пользователей" });
    }
  });

  app.post("/api/platform/users/:id/reset-password", async (req, res) => {
    try {
      if (!requirePlatformAdmin(req, res)) return;
      const { id } = req.params;
      const password = String(req.body?.password || "").trim();
      if (password.length < 6) return res.status(400).json({ message: "Пароль должен быть минимум 6 символов" });
      const user = await storage.updateUser(id, { password: hashPassword(password) } as any);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось сбросить пароль" });
    }
  });

  app.delete("/api/platform/users/:id", async (req, res) => {
    try {
      const currentUser = requirePlatformAdmin(req, res);
      if (!currentUser) return;
      const { id } = req.params;
      if (String(id) === String(currentUser.id)) {
        return res.status(400).json({ message: "Нельзя удалить свой аккаунт владельца" });
      }
      const target = await storage.getUser(id);
      if (!target) return res.status(404).json({ message: "Пользователь не найден" });
      const targetPermissions = Array.isArray((target as any).permissions) ? (target as any).permissions : [];
      if (target.role === "admin" && targetPermissions.includes("platform:admin")) {
        const allUsers = await storage.getAllUsers().catch(() => []);
        const activePlatformAdmins = (allUsers as any[]).filter((user) => {
          const permissions = Array.isArray(user.permissions) ? user.permissions : [];
          return user.active !== false && user.role === "admin" && permissions.includes("platform:admin");
        });
        if (activePlatformAdmins.length <= 1) {
          return res.status(400).json({ message: "Нельзя удалить последнего владельца платформы" });
        }
      }
      const memberships = await storage.getUserCompanyMemberships(id).catch(() => []);
      await Promise.all((memberships as any[]).map((member) =>
        storage.updateCompanyMember(member.id, { status: "removed", updatedAt: new Date() } as any).catch(() => undefined)
      ));
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось удалить пользователя" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const { id } = req.params;
      const visibleIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
      if (!visibleIds.has(String(id))) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      if (!requirePlatformAdmin(req, res)) return;
      const body = { ...req.body };
      if (body.password) body.password = hashPassword(String(body.password));
      const userData = insertUserSchema.parse(body);
      const user = await storage.createUser(userData);
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user?.id || String(req.user.id) !== String(id)) {
        return res.status(403).json({ message: "Можно изменить только свой профиль" });
      }
      const {
        password,
        name,
        email,
        phone,
        position,
        department,
        avatar,
      } = req.body || {};
      const updateData: any = {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      };
      if (password != null && String(password).length > 0) {
        updateData.password = hashPassword(String(password));
      }
      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/users/:id/avatar", avatarUpload.single("avatar"), async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      if (!currentUser) return res.status(401).json({ message: "Требуется авторизация" });
      if (currentUser.id !== id) return res.status(403).json({ message: "Можно изменить только свой аватар" });
      if (!req.file) {
        return res.status(400).json({ message: "Файл не выбран" });
      }
      const avatarUrl = "/uploads/avatars/" + req.file.filename;
      const user = await storage.updateUser(id, { avatar: avatarUrl });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined, avatar: avatarUrl });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось загрузить аватар" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      if (!requirePlatformAdmin(req, res)) return;
      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update user role and permissions
  app.put("/api/users/:id/permissions", async (req, res) => {
    try {
      if (!requirePlatformAdmin(req, res)) return;
      const { id } = req.params;
      const { role, permissions } = req.body;
      const user = await storage.updateUser(id, { role, permissions });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user permissions" });
    }
  });

  // Computers
  app.get("/api/computers", async (req, res) => {
    try {
      const computers = await withDbTimeout(() => storage.getComputers(), 5000, []);
      res.json(Array.isArray(computers) ? computers : []);
    } catch (e: any) {
      console.warn("[API] GET /api/computers:", e?.message || e);
      res.json([]);
    }
  });

  app.post("/api/computers", async (req, res) => {
    try {
      const body = req.body || {};
      const data = {
        name: body.name ?? "",
        location: body.location ?? "",
        purpose: body.purpose ?? undefined,
        status: body.status ?? "active",
        ipAddress: body.ipAddress ?? undefined,
        components: body.components ?? undefined,
        notes: body.notes ?? undefined,
      };
      const computer = await storage.createComputer(data as any);
      res.status(201).json(computer);
    } catch (error: any) {
      console.error("[API] POST /api/computers:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to create computer" });
    }
  });

  app.put("/api/computers/:id", async (req, res) => {
    try {
      const computer = await storage.updateComputer(req.params.id, req.body);
      if (!computer) {
        return res.status(404).json({ message: "Computer not found" });
      }
      res.json(computer);
    } catch (error) {
      res.status(500).json({ message: "Failed to update computer" });
    }
  });

  app.delete("/api/computers/:id", async (req, res) => {
    try {
      await storage.deleteComputer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete computer" });
    }
  });

  // Привязка набора оборудования к проекту (корзина → проект). Обязательны: дата возврата, сотрудник.
  app.post("/api/projects/:projectId/equipment-bundle", async (req, res) => {
    const appliedExtractions: Array<{ component: any; bundle: any }> = [];
    try {
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const { projectId } = req.params;
      const { equipmentIds, returnDate, assignedByUserId, assignedByName, kitExtractions } = req.body || {};
      if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
        return res.status(400).json({ message: "Укажите список оборудования (equipmentIds)" });
      }
      if (!returnDate || typeof returnDate !== "string") {
        return res.status(400).json({ message: "Укажите дату возврата оборудования (returnDate)" });
      }
      const project = await storage.getProjectById(projectId);
      if (!project && !isStubStorage) return res.status(404).json({ message: "Project not found" });
      if (
        !project ||
        !(await canAccessProject(req.user, project)) ||
        String(project.companyId || "") !== String(workspace.companyId)
      ) {
        return res.status(404).json({ message: "Project not found" });
      }

      for (const equipmentId of equipmentIds.map((id: unknown) => String(id || "").trim())) {
        const component = await storage.getEquipmentById(equipmentId).catch(() => undefined);
        if (!component || component.status === "archived") {
          throw createEquipmentKitActionError(404, "EQUIPMENT_NOT_FOUND", "Оборудование не найдено.", { equipmentId });
        }
        await ensureEquipmentCompanyAccess(req.user, component);
        const kit = await getEquipmentKitContext(component);
        if (kit) {
          appliedExtractions.push({
            component: { ...component, specifications: equipmentSpecs(component) },
            bundle: { ...kit.bundle, specifications: equipmentSpecs(kit.bundle) },
          });
        }
        await runEquipmentActionWithKitSafety({
          componentId: equipmentId,
          user: req.user,
          confirmation: kitExtractions?.[equipmentId],
          actionContext: `send-equipment-to-project:${projectId}`,
          action: async () => ({ success: true }),
        });
      }

      const name = typeof assignedByName === "string" && assignedByName.trim() ? assignedByName.trim() : "Не указан";
      projectEquipmentBundles.push({
        projectId,
        equipmentIds,
        sentAt: new Date().toISOString(),
        returnDate: String(returnDate).slice(0, 10),
        assignedByUserId: assignedByUserId || undefined,
        assignedByName: name,
      });
      res.json({ success: true, message: "Оборудование привязано к проекту", count: equipmentIds.length });
    } catch (e: any) {
      for (const snapshot of [...appliedExtractions].reverse()) {
        const currentComponent = await storage.getEquipmentById(snapshot.component.id).catch(() => undefined);
        const currentParentId = String(equipmentSpecs(currentComponent).parentBundleId || "").trim();
        if (!currentParentId) {
          try {
            await restoreEquipmentKitSnapshots(snapshot.component, snapshot.bundle);
          } catch (rollbackError) {
            console.error("[Equipment kits] Failed to roll back project batch:", rollbackError);
          }
        }
      }
      if (sendEquipmentKitActionError(res, e)) return;
      res.status(500).json({ message: e?.message || "Failed to attach equipment to project" });
    }
  });
  app.get("/api/projects/:projectId/equipment-bundles", async (req, res) => {
    const project = await storage.getProjectById(req.params.projectId).catch(() => undefined);
    if (!project || !(await canAccessProject(req.user, project))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const list = projectEquipmentBundles.filter((b) => b.projectId === req.params.projectId);
    res.json(list);
  });

  app.post("/api/equipment-return", async (req, res) => {
    try {
      if (!(await requireActiveCompanyWorkspace(req, res))) return;
      const { equipmentId } = req.body || {};
      const currentUserId = (req as any).user?.id;
      if (!equipmentId || typeof equipmentId !== "string") {
        return res.status(400).json({ message: "Укажите equipmentId" });
      }
      const item = await storage.getEquipmentById(equipmentId).catch(() => undefined);
      if (!item) return res.status(404).json({ message: "Оборудование не найдено" });
      await ensureEquipmentCompanyAccess(req.user, item);
      await ensureEquipmentReturnAllowed(req.user, item);
      const companyId = equipmentCompanyId(item);
      const storageSelection = await validateEquipmentStorageSelection({
        body: req.body || {},
        companyId,
        existingStorageLocationId: item.storageLocationId,
      });
      const manualStorageLocation = String(req.body?.storageLocation || "").trim();
      if (!storageSelection.storageLocationId && !manualStorageLocation) {
        return res.status(400).json({ message: "Выберите место хранения или укажите его вручную" });
      }
      if (manualStorageLocation.length > 500) {
        return res.status(400).json({ message: "Описание места хранения не должно превышать 500 символов" });
      }
      let found = false;
      let bundleAssignedBy: string | undefined;
      for (let i = projectEquipmentBundles.length - 1; i >= 0; i--) {
        const b = projectEquipmentBundles[i];
        const idx = b.equipmentIds.indexOf(equipmentId);
        if (idx !== -1) {
          found = true;
          bundleAssignedBy = b.assignedByUserId;
          const isAdmin = (req as any).user?.role === "admin" || (req as any).user?.role === "tech_director";
          const canReturn = isAdmin || (currentUserId && bundleAssignedBy === currentUserId);
          if (!canReturn) {
            return res.status(403).json({ message: "Вернуть оборудование может только тот, кто отправил его на проект, или администратор." });
          }
          b.equipmentIds.splice(idx, 1);
          if (b.equipmentIds.length === 0) projectEquipmentBundles.splice(i, 1);
          break;
        }
      }
      if (!found) {
        return res.status(404).json({ message: "Оборудование не найдено на проекте или уже возвращено. Обновите страницу." });
      }
      const updated = await storage.updateEquipment(item.id, {
        status: "available",
        assignedTo: null,
        lastUsed: new Date(),
        location: null,
        locationId: null,
        manualLocation: null,
        storageLocationId: storageSelection.storageLocationId,
        storageLocation: storageSelection.storageLocationId
          ? storageSelection.displayName
          : manualStorageLocation,
      } as any);
      await deactivateCurrentEquipmentCheckoutContext(item.id);
      publishEquipmentContextChanged(updated || item, "status");
      res.json({
        success: true,
        message: "Оборудование возвращено на склад",
        equipment: updated ? await serializeEquipmentContext(updated) : null,
      });
    } catch (e: any) {
      if (sendEquipmentKitActionError(res, e)) return;
      res.status(500).json({ message: e?.message || "Не удалось вернуть" });
    }
  });

  // Сводка: какое оборудование на каких проектах (assignedByUserId — чтобы вернуть мог только тот, кто отправил)
  app.get("/api/equipment-on-projects", async (req, res) => {
    if (!(await requireActiveCompanyWorkspace(req, res))) return;
    const currentUser = req.user as any;
    const allContextLinks = (await storage.getEquipmentContextLinks().catch(() => []))
      .filter((link: any) => link.active && link.projectId);
    const projectIds = [...new Set([
      ...projectEquipmentBundles.map((bundle) => bundle.projectId),
      ...allContextLinks.map((link: any) => String(link.projectId)),
    ])];
    const projectList = (await Promise.all(projectIds.map((id) =>
      storage.getProjectById(id).catch(() => undefined),
    ))).filter(Boolean) as any[];
    const projectById = new Map(projectList.map((project) => [String(project.id), project]));
    const projectAccess = await Promise.all(projectList.map(async (project) =>
      (await canAccessProject(currentUser, project)) ? project : null,
    ));
    const visibleProjectIds = new Set(
      projectAccess.filter(Boolean).map((project: any) => String(project.id)),
    );
    const visibleEquipmentIds = new Set<string>();
    const candidateEquipmentIds = Array.from(new Set([
      ...projectEquipmentBundles.flatMap((bundle) => bundle.equipmentIds),
      ...allContextLinks.map((link: any) => String(link.equipmentId)),
    ]));
    await Promise.all(candidateEquipmentIds.map(async (equipmentId) => {
      const item = await storage.getEquipmentById(equipmentId).catch(() => undefined);
      if (!item) return;
      try {
        await ensureEquipmentCompanyAccess(currentUser, item);
        visibleEquipmentIds.add(equipmentId);
      } catch {
        // Equipment from other or ambiguous companies is hidden.
      }
    }));
    const contextLinks = allContextLinks.filter((link: any) =>
      visibleProjectIds.has(String(link.projectId)) &&
      visibleEquipmentIds.has(String(link.equipmentId)),
    );
    const projectNames: Record<string, string> = Object.fromEntries(
      projectList.map((project) => [String(project.id), String(project.name || "Проект")]),
    );
    const rows = new Map<string, {
      equipmentId: string;
      projectId: string;
      projectName?: string;
      sentAt: string;
      returnDate: string;
      assignedByName: string;
      assignedByUserId?: string;
      sources: string[];
      kanbanCardIds: string[];
    }>();
    for (const b of projectEquipmentBundles) {
      if (!visibleProjectIds.has(String(b.projectId))) continue;
      for (const equipmentId of b.equipmentIds) {
        if (!visibleEquipmentIds.has(String(equipmentId))) continue;
        rows.set(`${equipmentId}:${b.projectId}`, {
          equipmentId,
          projectId: b.projectId,
          projectName: projectNames[b.projectId],
          sentAt: b.sentAt,
          returnDate: b.returnDate,
          assignedByName: b.assignedByName,
          assignedByUserId: b.assignedByUserId,
          sources: ["project-bundle"],
          kanbanCardIds: [],
        });
      }
    }
    for (const link of contextLinks as any[]) {
      const key = `${link.equipmentId}:${link.projectId}`;
      const existing = rows.get(key);
      if (existing) {
        if (!existing.sources.includes(link.source)) existing.sources.push(link.source);
        if (link.kanbanCardId && !existing.kanbanCardIds.includes(String(link.kanbanCardId))) {
          existing.kanbanCardIds.push(String(link.kanbanCardId));
        }
        continue;
      }
      rows.set(key, {
        equipmentId: String(link.equipmentId),
        projectId: String(link.projectId),
        projectName: projectNames[String(link.projectId)],
        sentAt: new Date(link.createdAt || Date.now()).toISOString(),
        returnDate: "",
        assignedByName: link.source === "checkout" ? "Через выдачу" : "Ручная связь",
        assignedByUserId: link.createdByUserId || undefined,
        sources: [String(link.source)],
        kanbanCardIds: link.kanbanCardId ? [String(link.kanbanCardId)] : [],
      });
    }
    res.json(Array.from(rows.values()));
  });

  // Projects
  const getProjectDirectLocationIds = async (projectId: string) => {
    const links = await storage.getProjectLocationLinks(projectId).catch(() => []);
    return normalizeLocationIds((links as any[]).map((link) => link.locationId));
  };

  const getProjectCardLocationIds = async (projectId: string) => {
    const boards = await storage.getKanbanBoards().catch(() => []);
    const cards = (await Promise.all((boards as any[]).map(async (board) => {
      const boardCards = await storage.getKanbanCardsByBoardId(board.id).catch(() => []);
      return (boardCards as any[]).filter((card) =>
        String(card.projectId || board.projectId || "") === String(projectId),
      );
    }))).flat();
    const cardLocationIds = await Promise.all((cards as any[]).map(getKanbanCardLocationIds));
    return normalizeLocationIds(cardLocationIds.flat());
  };

  const buildProjectResponse = async (project: any) => {
    const [directLocationIds, cardLocationIds, allLocations, comments, allIssues] = await Promise.all([
      getProjectDirectLocationIds(project.id),
      getProjectCardLocationIds(project.id),
      storage.getCustomLocations().catch(() => []),
      storage.getProjectComments(project.id).catch(() => []),
      storage.getLocationIssues().catch(() => []),
    ]);
    const locationById = new Map((allLocations as any[]).map((location) => [String(location.id), location]));
    const locationIds = normalizeLocationIds([...directLocationIds, ...cardLocationIds])
      .filter((locationId) => {
        const location = locationById.get(locationId) as any;
        return Boolean(
          location &&
          project.companyId &&
          String(location.companyId || "") === String(project.companyId),
        );
      });
    const directSet = new Set(directLocationIds);
    const cardSet = new Set(cardLocationIds);
    const activeComments = (comments as any[]).filter((comment) => !comment.deletedAt);
    const latestCommentAt = activeComments.reduce<string | null>((latest, comment) => {
      const value = new Date(comment.updatedAt || comment.createdAt || 0).getTime();
      const latestValue = latest ? new Date(latest).getTime() : 0;
      return value > latestValue ? new Date(value).toISOString() : latest;
    }, null);
    return {
      ...project,
      commentCount: activeComments.length,
      latestCommentAt,
      directLocationIds,
      locationIds,
      locations: locationIds
        .map((locationId) => locationById.get(locationId))
        .filter(Boolean)
        .map((location: any) => ({
          id: location.id,
          name: location.name,
          archivedAt: location.archivedAt ?? null,
          source: directSet.has(String(location.id)) && cardSet.has(String(location.id))
            ? "direct_and_cards"
            : directSet.has(String(location.id)) ? "direct" : "cards",
        })),
      locationTopics: (allIssues as any[])
        .filter((issue) =>
          locationIds.includes(String(issue.locationId)) &&
          normalizeLocationTopicStatus(issue.status) === "active",
        )
        .sort((left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime(),
        )
        .slice(0, 5)
        .map((issue) => ({
          id: issue.id,
          locationId: issue.locationId,
          locationName: locationById.get(String(issue.locationId))?.name || "Площадка",
          title: issue.title,
          type: normalizeLocationTopicType(issue.type),
          severity: normalizeLocationTopicType(issue.type) === "issue" ? issue.severity || "medium" : null,
          status: normalizeLocationTopicStatus(issue.status),
          updatedAt: issue.updatedAt || issue.createdAt || null,
        })),
    };
  };

  const resolveProjectLocationIds = async (
    project: any,
    requestedLocationIds: unknown,
    existingLocationIds: string[] = [],
  ) => {
    const locationIds = normalizeLocationIds(requestedLocationIds);
    if (locationIds.length > 20) {
      return { ok: false as const, status: 400, message: "К проекту можно привязать не более 20 площадок" };
    }
    if (locationIds.length && !project.companyId) {
      return { ok: false as const, status: 400, message: "Сначала привяжите проект к компании" };
    }
    const existingSet = new Set(existingLocationIds.map(String));
    const locations = await Promise.all(locationIds.map((locationId) =>
      storage.getCustomLocationById(locationId).catch(() => undefined),
    ));
    for (let index = 0; index < locations.length; index += 1) {
      const location = locations[index] as any;
      const locationId = locationIds[index];
      if (!location) {
        return { ok: false as const, status: 400, message: "Выберите существующие площадки" };
      }
      if (location.archivedAt && !existingSet.has(locationId)) {
        return { ok: false as const, status: 409, message: "Архивную площадку нельзя добавить к новой связи" };
      }
      if (String(location.companyId || "") !== String(project.companyId || "")) {
        return { ok: false as const, status: 403, message: "Площадка принадлежит другой компании" };
      }
    }
    return { ok: true as const, locationIds };
  };

  const canAccessProject = async (currentUser: any, project: any) => {
    if (!currentUser?.id || !project) return false;
    const workspace = await getActiveWorkspaceForUser(currentUser);
    if (!workspace.type || workspace.requiresSelection) return false;
    const projectCompanyId = String(project.companyId || "");
    if (workspace.type === "company") {
      return Boolean(projectCompanyId && projectCompanyId === String(workspace.companyId || ""));
    }
    if (projectCompanyId) return false;
    const userId = String(currentUser.id);
    if (String(project.ownerId || "") === userId || String(project.assignedTo || "") === userId) return true;
    return Array.isArray(project.participants) && project.participants.map(String).includes(userId);
  };

  const publishProjectChanged = (
    project: any,
    action: "created" | "updated" | "deleted" = "updated",
  ) => {
    if (!project?.id) return;
    const version = project.updatedAt || project.createdAt || new Date();
    publishDiscussionEvent(createDiscussionRealtimeEvent({
      channel: `project:${project.id}:comments`,
      action,
      recordId: String(project.id),
      version,
    }));
    if (project.companyId) {
      publishDiscussionEvent(createDiscussionRealtimeEvent({
        channel: `company:${project.companyId}`,
        action,
        recordId: String(project.id),
        version,
      }));
    }
  };

  const canManageProjectDiscussion = async (currentUser: any, project: any) => {
    if (!currentUser?.id || !project) return false;
    const userId = String(currentUser.id);
    if (
      String(project.ownerId || "") === userId ||
      String(project.assignedTo || "") === userId
    ) {
      return true;
    }
    return Boolean(
      project.companyId &&
      await canManageCompany(currentUser, String(project.companyId)).catch(() => false)
    );
  };

  app.get("/api/projects/:projectId/comments", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const project = await storage.getProjectById(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Проект не найден" });
      if (!(await canAccessProject(currentUser, project))) {
        return res.status(403).json({ message: "Нет доступа к обсуждению проекта" });
      }
      const comments = await storage.getProjectComments(project.id).catch(() => []);
      res.json(await serializeDiscussionComments(
        comments as any[],
        currentUser,
        await canManageProjectDiscussion(currentUser, project),
      ));
    } catch (error) {
      console.error("[Projects] Failed to fetch comments:", error);
      res.status(500).json({ message: "Не удалось загрузить комментарии проекта" });
    }
  });

  app.post("/api/projects/:projectId/comments", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const project = await storage.getProjectById(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Проект не найден" });
      if (!(await canAccessProject(currentUser, project))) {
        return res.status(403).json({ message: "Нет доступа к обсуждению проекта" });
      }

      const payload = discussionCommentPayloadSchema.parse(req.body || {});
      const existingComments = await storage.getProjectComments(project.id).catch(() => []);
      const parentResolution = findDiscussionRoot(existingComments as any[], payload.parentCommentId);
      if (!parentResolution.ok) {
        return res.status(400).json({ message: parentResolution.message });
      }

      const comment = await storage.createProjectComment({
        projectId: project.id,
        userId: currentUser.id,
        parentCommentId: parentResolution.parentCommentId,
        authorName: String(currentUser.name || currentUser.username || "Пользователь"),
        content: payload.content,
        deletedAt: null,
      });
      publishDiscussionEvent(createDiscussionRealtimeEvent({
        channel: `project:${project.id}:comments`,
        action: comment.parentCommentId ? "replied" : "created",
        recordId: comment.id,
        version: comment.updatedAt,
      }));

      const [responseComment] = await serializeDiscussionComments(
        [comment],
        currentUser,
        await canManageProjectDiscussion(currentUser, project),
      );
      res.status(201).json(responseComment);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: error.issues?.[0]?.message || "Проверьте комментарий" });
      }
      console.error("[Projects] Failed to create comment:", error);
      res.status(500).json({ message: "Не удалось добавить комментарий проекта" });
    }
  });

  app.delete("/api/projects/:projectId/comments/:commentId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const project = await storage.getProjectById(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Проект не найден" });
      if (!(await canAccessProject(currentUser, project))) {
        return res.status(403).json({ message: "Нет доступа к обсуждению проекта" });
      }

      const comments = await storage.getProjectComments(project.id).catch(() => []);
      const comment = (comments as any[]).find((item) => String(item.id) === String(req.params.commentId));
      if (!comment) return res.status(404).json({ message: "Комментарий не найден" });
      const canManage = await canManageProjectDiscussion(currentUser, project);
      if (!canManage && String(comment.userId || "") !== String(currentUser.id)) {
        return res.status(403).json({ message: "Можно удалить только собственный комментарий" });
      }
      if (comment.deletedAt) return res.json({ success: true });

      const deleted = await storage.updateProjectComment(comment.id, {
        deletedAt: new Date(),
      } as any);
      if (!deleted) return res.status(404).json({ message: "Комментарий не найден" });
      publishDiscussionEvent(createDiscussionRealtimeEvent({
        channel: `project:${project.id}:comments`,
        action: "deleted",
        recordId: deleted.id,
        version: deleted.updatedAt,
      }));
      res.json({ success: true });
    } catch (error) {
      console.error("[Projects] Failed to delete comment:", error);
      res.status(500).json({ message: "Не удалось удалить комментарий проекта" });
    }
  });

  app.get("/api/projects", async (req, res) => {
    const currentUser = req.user as any;
    if (!currentUser?.id) return res.json([]);
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return;
    const projects = await withDbTimeout(
      () => storage.getProjects(),
      3000, // 3 секунды для быстрого ответа
      [] // Пустой массив по умолчанию
    );
    const userId = String(currentUser.id);
    const visibleProjects = (projects as any[]).filter((project) => {
      const participants = Array.isArray(project?.participants) ? project.participants.map(String) : [];
      if (workspace.type === "company") {
        return String(project.companyId || "") === String(workspace.companyId || "");
      }
      return !project.companyId && (
        String(project.ownerId || "") === userId ||
        String(project.assignedTo || "") === userId ||
        participants.includes(userId)
      );
    });
    res.json(await Promise.all(visibleProjects.map(buildProjectResponse)));
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      const { deadline, locationIds, ...rest } = req.body;
      rest.ownerId = currentUser.id;
      rest.companyId = workspace.type === "company" ? workspace.companyId : null;
      rest.visibility = workspace.type === "company" ? (rest.visibility || "company") : "personal";
      const participants: string[] = Array.isArray(rest.participants)
        ? Array.from(new Set(
          rest.participants
            .map((id: unknown) => String(id || "").trim())
            .filter((id: string) => Boolean(id)),
        ))
        : [];
      const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
      if (participants.some((userId: string) => !visibleUserIds.has(userId))) {
        return res.status(403).json({ message: "Один или несколько участников недоступны в выбранном пространстве" });
      }
      rest.participants = participants;
      const projectData = {
        ...rest,
        deadline: deadline && deadline !== "" ? new Date(deadline) : null,
      };
      const locationResolution = await resolveProjectLocationIds(projectData, locationIds ?? []);
      if (!locationResolution.ok) {
        return res.status(locationResolution.status).json({ message: locationResolution.message });
      }
      const project = await storage.createProject(projectData);
      await storage.setProjectLocations(project.id, locationResolution.locationIds);
      publishProjectChanged(project, "created");
      res.status(201).json(await buildProjectResponse(project));
    } catch (error: any) {
      console.error("Error creating project:", error);
      const msg = (error.message || "").toLowerCase();
      const isDb = /timeout|econnrefused|connection|password|auth|database/i.test(msg);
      res.status(500).json({
        message: isDb
          ? "Ошибка подключения к базе данных. Проверьте PostgreSQL и DATABASE_URL в .env."
          : (error.message || "Не удалось создать проект"),
      });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const existing = await storage.getProjectById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Project not found" });
      if (!(await canAccessProject(currentUser, existing))) {
        return res.status(403).json({ message: "Нет доступа к проекту" });
      }
      const { locationIds, ...projectData } = req.body || {};
      delete projectData.companyId;
      delete projectData.ownerId;
      if (projectData.participants !== undefined) {
        const workspace = await getActiveWorkspaceForUser(currentUser);
        const participants: string[] = Array.isArray(projectData.participants)
          ? Array.from(new Set(
            projectData.participants
              .map((id: unknown) => String(id || "").trim())
              .filter((id: string) => Boolean(id)),
          ))
          : [];
        const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
        if (participants.some((userId: string) => !visibleUserIds.has(userId))) {
          return res.status(403).json({ message: "Один или несколько участников недоступны в выбранном пространстве" });
        }
        projectData.participants = participants;
      }
      const previousLocationIds = await getProjectDirectLocationIds(existing.id);
      let nextLocationIds: string[] | undefined;
      if (locationIds !== undefined) {
        const locationResolution = await resolveProjectLocationIds(
          { ...existing, ...projectData },
          locationIds,
          previousLocationIds,
        );
        if (!locationResolution.ok) {
          return res.status(locationResolution.status).json({ message: locationResolution.message });
        }
        nextLocationIds = locationResolution.locationIds;
      }
      const project = await storage.updateProject(req.params.id, projectData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      if (nextLocationIds !== undefined) {
        await storage.setProjectLocations(project.id, nextLocationIds);
      }
      publishProjectChanged(project, "updated");
      res.json(await buildProjectResponse(project));
    } catch (error) {
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  /** Единая статистика проекта. Источник задач — только выделенная доска Kanban V2. */
  app.get("/api/projects/:id/task-stats", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const project = await storage.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ message: "Проект не найден" });
      if (!(await canAccessProject(currentUser, project))) {
        return res.status(403).json({ message: "Нет доступа к проекту" });
      }
      const now = new Date();
      const dueSoonBoundary = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const allBoards = await storage.getKanbanBoards().catch(() => []);
      const projectBoards = (allBoards as any[]).filter((board) =>
        String(board.projectId || "") === String(project.id),
      );
      const statusNames: Record<string, string> = {};
      const listById = new Map<string, any>();
      const cards: any[] = [];
      for (const board of projectBoards) {
        const [lists, boardCards] = await Promise.all([
          storage.getKanbanListsByBoardId(board.id).catch(() => []),
          storage.getKanbanCardsByBoardId(board.id).catch(() => []),
        ]);
        (lists as any[]).forEach((list) => {
          statusNames[list.id] = list.name || list.id;
          listById.set(String(list.id), list);
        });
        cards.push(...(boardCards as any[]).map((card) => ({
          ...card,
          projectId: card.projectId || board.projectId,
          boardId: board.id,
        })));
      }

      const visibleCards = cards.filter((card) =>
        String(listById.get(String(card.listId))?.type || "") !== "trash",
      );
      const isCompletedCard = (card: any) =>
        ["closed", "archive"].includes(String(listById.get(String(card.listId))?.type || ""));
      const isInProgressCard = (card: any) => {
        const listName = String(listById.get(String(card.listId))?.name || "").toLowerCase();
        return ["в работе", "in progress", "doing", "progress"].some((marker) => listName.includes(marker));
      };
      const cardDueDate = (card: any) => {
        if (!card.dueDate) return null;
        const date = new Date(card.dueDate);
        return Number.isNaN(date.getTime()) ? null : date;
      };
      const isOverdueCard = (card: any) => {
        const dueDate = cardDueDate(card);
        return Boolean(dueDate && !isCompletedCard(card) && dueDate.getTime() < now.getTime());
      };
      const activeCards = visibleCards.filter((card) => !isCompletedCard(card));
      const completedCards = visibleCards.filter(isCompletedCard);
      const inProgressCards = activeCards.filter(isInProgressCard);
      const overdueCards = activeCards.filter(isOverdueCard);
      const unassignedCards = activeCards.filter((card) => !card.assigneeUserId);

      const deadlines = {
        overdue: 0,
        dueSoon: 0,
        future: 0,
        noDeadline: 0,
      };
      for (const card of activeCards) {
        const dueDate = cardDueDate(card);
        if (!dueDate) deadlines.noDeadline += 1;
        else if (dueDate.getTime() < now.getTime()) deadlines.overdue += 1;
        else if (dueDate.getTime() <= dueSoonBoundary.getTime()) deadlines.dueSoon += 1;
        else deadlines.future += 1;
      }

      const byStatus: Record<string, number> = {};
      visibleCards.forEach((card) => {
        const status = String(card.listId || "unknown");
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      const workspace = await getActiveWorkspaceForUser(currentUser);
      const visibleUserIds = await getWorkspaceVisibleUserIds(currentUser, workspace);
      const boardMembers = (await Promise.all(projectBoards.map((board) =>
        storage.getKanbanBoardMembers(board.id).catch(() => []),
      ))).flat() as any[];
      const projectMemberIds = Array.from(new Set([
        project.ownerId,
        project.assignedTo,
        ...(Array.isArray(project.participants) ? project.participants : []),
        ...boardMembers.map((member) => member.userId),
        ...visibleCards.map((card) => card.assigneeUserId),
      ].map((id) => String(id || "").trim()).filter((id) => id && visibleUserIds.has(id))));
      const allUsers = await storage.getUsers().catch(() => []);
      const userNames: Record<string, string> = {};
      for (const user of allUsers as any[]) {
        if (projectMemberIds.includes(String(user.id))) {
          userNames[String(user.id)] = user.name || user.username || user.id;
        }
      }
      const assignees = projectMemberIds
        .map((userId) => {
          const assignedCards = visibleCards.filter((card) => String(card.assigneeUserId || "") === userId);
          return {
            userId,
            name: userNames[userId] || userId,
            total: assignedCards.length,
            active: assignedCards.filter((card) => !isCompletedCard(card)).length,
            completed: assignedCards.filter(isCompletedCard).length,
            overdue: assignedCards.filter(isOverdueCard).length,
          };
        })
        .sort((left, right) => right.active - left.active || left.name.localeCompare(right.name, "ru"));
      const byUser = Object.fromEntries(assignees.map((assignee) => [assignee.userId, assignee.total]));

      const [directLocationIds, cardLocationIds, allLocations, allLocationIssues] = await Promise.all([
        getProjectDirectLocationIds(project.id),
        getProjectCardLocationIds(project.id),
        storage.getCustomLocations().catch(() => []),
        storage.getLocationIssues().catch(() => []),
      ]);
      const projectIssues = (allLocationIssues as any[]).filter((issue) =>
        String(issue.projectId || "") === String(project.id),
      );
      const locationIds = new Set(normalizeLocationIds([
        ...directLocationIds,
        ...cardLocationIds,
        ...projectIssues.map((issue) => issue.locationId),
      ]));
      const projectLocations = (allLocations as any[]).filter((location) =>
        locationIds.has(String(location.id)) &&
        project.companyId &&
        String(location.companyId || "") === String(project.companyId),
      );
      const allowedLocationIds = new Set(projectLocations.map((location) => String(location.id)));
      const unresolvedLocationIssues = (allLocationIssues as any[]).filter((issue) =>
        allowedLocationIds.has(String(issue.locationId)) &&
        normalizeLocationTopicType(issue.type) === "issue" &&
        normalizeLocationTopicStatus(issue.status) === "active",
      );
      const issueSeverity: Record<string, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };
      for (const issue of unresolvedLocationIssues) {
        const severity = String(issue.severity || "medium").toLowerCase();
        issueSeverity[severity] = (issueSeverity[severity] || 0) + 1;
      }
      const locationItems = projectLocations
        .map((location) => {
          const issues = unresolvedLocationIssues.filter((issue) =>
            String(issue.locationId) === String(location.id),
          );
          return {
            id: location.id,
            name: location.name,
            archived: Boolean(location.archivedAt),
            source: directLocationIds.includes(String(location.id)) &&
              cardLocationIds.includes(String(location.id))
              ? "direct_and_cards"
              : directLocationIds.includes(String(location.id)) ? "direct" : "cards",
            unresolvedIssues: issues.length,
            bySeverity: issues.reduce<Record<string, number>>((result, issue) => {
              const severity = String(issue.severity || "medium").toLowerCase();
              result[severity] = (result[severity] || 0) + 1;
              return result;
            }, {}),
          };
        })
        .sort((left, right) =>
          Number(left.archived) - Number(right.archived) || left.name.localeCompare(right.name, "ru"),
        );

      const projectCardIds = new Set(visibleCards.map((card) => String(card.id)));
      const [allEquipmentLinks, allEquipmentRequests] = await Promise.all([
        storage.getEquipmentContextLinks().catch(() => []),
        storage.getEquipmentCheckoutRequests().catch(() => []),
      ]);
      const equipmentLinks = (allEquipmentLinks as any[]).filter((link) =>
        String(link.projectId || "") === String(project.id) ||
        projectCardIds.has(String(link.kanbanCardId || "")),
      );
      const equipmentRequests = (allEquipmentRequests as any[]).filter((request) =>
        String(request.projectId || "") === String(project.id) ||
        getEquipmentRequestCardIds(request).some((cardId) => projectCardIds.has(cardId)),
      );
      const equipmentBundles = projectEquipmentBundles.filter((bundle) =>
        String(bundle.projectId) === String(project.id),
      );
      const equipmentIds = Array.from(new Set([
        ...equipmentLinks.map((link) => String(link.equipmentId || "")),
        ...equipmentRequests.map((request) => String(request.equipmentId || "")),
        ...equipmentBundles.flatMap((bundle) => bundle.equipmentIds.map(String)),
      ].filter(Boolean)));
      const equipmentRows = (await Promise.all(equipmentIds.map((equipmentId) =>
        storage.getEquipmentById(equipmentId).catch(() => undefined),
      ))).filter((item) =>
        item &&
        item.status !== "archived" &&
        project.companyId &&
        equipmentCompanyId(item) === String(project.companyId),
      ) as any[];
      const equipmentMetrics = {
        linked: new Set<string>(),
        requested: new Set<string>(),
        approved: new Set<string>(),
        issued: new Set<string>(),
        returned: new Set<string>(),
        overdue: new Set<string>(),
        brokenOrRepair: new Set<string>(),
      };
      const equipmentItems = equipmentRows.map((item) => {
        const itemId = String(item.id);
        const itemLinks = equipmentLinks.filter((link) => String(link.equipmentId) === itemId);
        const itemRequests = equipmentRequests
          .filter((request) => String(request.equipmentId) === itemId)
          .sort((left, right) =>
            new Date(right.updatedAt || right.createdAt || 0).getTime() -
            new Date(left.updatedAt || left.createdAt || 0).getTime(),
          );
        const latestRequest = itemRequests[0];
        const requestLinks = latestRequest
          ? itemLinks.filter((link) => String(link.checkoutRequestId || "") === String(latestRequest.id))
          : [];
        const bundle = equipmentBundles.find((entry) => entry.equipmentIds.map(String).includes(itemId));
        const linked = itemLinks.some((link) => link.active) || Boolean(bundle);
        if (linked) equipmentMetrics.linked.add(itemId);

        let workflowStatus: "requested" | "approved" | "issued" | "returned" | "overdue" | null = null;
        if (latestRequest?.status === "pending") {
          workflowStatus = "requested";
        } else if (latestRequest?.status === "approved") {
          if (requestLinks.length > 0 && requestLinks.every((link) => !link.active)) {
            workflowStatus = "returned";
          } else if (item.status === "in-use" && (requestLinks.some((link) => link.active) || linked)) {
            workflowStatus = "issued";
          } else {
            workflowStatus = "approved";
          }
        } else if (bundle && item.status === "in-use") {
          workflowStatus = "issued";
        }

        const bundleReturnAt = bundle?.returnDate
          ? new Date(`${bundle.returnDate}T23:59:59.999`)
          : null;
        const requestReturnAt = latestRequest?.expectedReturnAt
          ? new Date(latestRequest.expectedReturnAt)
          : null;
        const overdue =
          workflowStatus !== "returned" &&
          (
            (bundleReturnAt && !Number.isNaN(bundleReturnAt.getTime()) && bundleReturnAt.getTime() < now.getTime()) ||
            (requestReturnAt && !Number.isNaN(requestReturnAt.getTime()) && requestReturnAt.getTime() < now.getTime())
          );
        if (overdue) workflowStatus = "overdue";
        if (workflowStatus) equipmentMetrics[workflowStatus].add(itemId);

        const operability = String(item.operabilityStatus || "").toLowerCase();
        const brokenOrRepair =
          ["broken", "on_repair", "maintenance"].includes(operability) ||
          ["broken", "maintenance"].includes(String(item.status || "").toLowerCase());
        if (brokenOrRepair) equipmentMetrics.brokenOrRepair.add(itemId);

        return {
          id: itemId,
          name: item.name,
          model: item.model || null,
          linked,
          workflowStatus,
          brokenOrRepair,
          cardIds: Array.from(new Set(itemLinks.map((link) => String(link.kanbanCardId || "")).filter(Boolean))),
        };
      }).sort((left, right) => left.name.localeCompare(right.name, "ru"));

      const taskItems = visibleCards.map((card) => ({
        id: card.id,
        boardId: card.boardId,
        title: card.title,
        listId: card.listId,
        listName: statusNames[String(card.listId)] || String(card.listId),
        completed: isCompletedCard(card),
        inProgress: isInProgressCard(card),
        overdue: isOverdueCard(card),
        unassigned: !card.assigneeUserId,
        assigneeUserId: card.assigneeUserId || null,
        dueDate: card.dueDate || null,
      }));
      const total = visibleCards.length;
      const done = completedCards.length;
      res.json({
        source: {
          type: "kanban-v2",
          boardIds: projectBoards.map((board) => String(board.id)),
        },
        total,
        done,
        byStatus,
        statusNames,
        byUser,
        userNames,
        tasks: {
          total,
          active: activeCards.length,
          inProgress: inProgressCards.length,
          completed: completedCards.length,
          overdue: overdueCards.length,
          unassigned: unassignedCards.length,
          deadlines,
          items: taskItems,
        },
        assignees,
        locations: {
          total: locationItems.length,
          active: locationItems.filter((location) => !location.archived).length,
          archived: locationItems.filter((location) => location.archived).length,
          unresolvedIssues: unresolvedLocationIssues.length,
          bySeverity: issueSeverity,
          items: locationItems,
        },
        equipment: {
          total: equipmentItems.length,
          linked: equipmentMetrics.linked.size,
          requested: equipmentMetrics.requested.size,
          approved: equipmentMetrics.approved.size,
          issued: equipmentMetrics.issued.size,
          returned: equipmentMetrics.returned.size,
          overdue: equipmentMetrics.overdue.size,
          brokenOrRepair: equipmentMetrics.brokenOrRepair.size,
          items: equipmentItems,
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка" });
    }
  });

  app.post("/api/projects/:id/kanban-board", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });

      const project = await storage.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ message: "Проект не найден" });
      if (!(await canOpenProjectKanbanBoard(currentUser, project))) {
        return res.status(403).json({ message: "Недостаточно прав для открытия доски проекта" });
      }

      const joinedExistingOperation = projectKanbanBoardOperations.has(project.id);
      let operation = projectKanbanBoardOperations.get(project.id);
      if (!operation) {
        operation = (async () => {
          const existingBoards = await storage.getKanbanBoards().catch(() => []);
          let board = (existingBoards as any[]).find((item) =>
            String(item.projectId || "") === String(project.id),
          );
          const created = !board;

          if (!board) {
            const companyId = String((project as any).companyId || "").trim() || null;
            board = await storage.createKanbanBoard({
              companyId,
              projectId: project.id,
              name: `${project.name || "Проект"} · Kanban`,
              description: project.description || null,
              visibility: companyId ? "members" : "personal",
              createdByUserId: currentUser.id,
            });
          }

          await syncProjectKanbanBoardMembers(board, project, currentUser);
          await ensureDefaultProjectKanbanLists(board.id);

          const updatedProject = (project as any).showInTaskManager === true
            ? project
            : await storage.updateProject(
                project.id,
                { showInTaskManager: true } as any,
              ).catch(() => undefined) || project;

          return {
            board,
            created,
            project: updatedProject,
          };
        })();
        projectKanbanBoardOperations.set(project.id, operation);
        void operation.finally(() => {
          if (projectKanbanBoardOperations.get(project.id) === operation) {
            projectKanbanBoardOperations.delete(project.id);
          }
        });
      }

      const result = await operation;
      const board = result.board;
      await syncProjectKanbanBoardMembers(board, project, currentUser);

      const membership = await storage.getKanbanBoardMember(board.id, currentUser.id).catch(() => undefined);
      const canManage = !board.companyId
        ? String(board.createdByUserId) === String(currentUser.id)
        : await canManageCompany(currentUser, String(board.companyId)).catch(() => false);

      res.json({
        board: buildKanbanBoardResponse(board, { canManage, membership }),
        project: await buildProjectResponse(result.project),
        created: joinedExistingOperation ? false : result.created,
      });
    } catch (e: any) {
      console.error("[Projects] Failed to open Kanban board:", e);
      res.status(500).json({ message: e?.message || "Не удалось открыть доску проекта" });
    }
  });

  /** Привязать видеопроект к доске YouGile (доска появится в таск-менеджере, колонки создаются в YouGile) */
  app.post("/api/projects/:id/link-yougile-board", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const project = await storage.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ message: "Проект не найден" });
      if (!(await canAccessProject(currentUser, project))) {
        return res.status(403).json({ message: "Нет доступа к проекту" });
      }
      const existing = (project as any).yougileBoardId;
      if (existing) {
        return res.json({ yougileBoardId: existing, message: "Доска уже привязана" });
      }
      const {
        isYouGileConfigured,
        yougileGetProjects,
        yougileCreateProject,
        yougileCreateBoard,
      } = await import("./yougile");
      if (!isYouGileConfigured()) {
        return res.status(400).json({ message: "YouGile не настроен. Настройте в Настройках." });
      }
      let ygProjects = await yougileGetProjects();
      if (!ygProjects.length) {
        const created = await yougileCreateProject("StreamDesk");
        ygProjects = [created];
      }
      const ygProjectId = ygProjects[0].id;
      const board = await yougileCreateBoard(ygProjectId, project.name || "Проект");
      await storage.updateProject(project.id, { yougileBoardId: board.id } as any);
      res.json({ yougileBoardId: board.id, message: "Доска создана в таск-менеджере" });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Не удалось создать доску YouGile" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const project = await storage.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ message: "Проект не найден" });
      if (!(await canAccessProject(currentUser, project))) {
        return res.status(403).json({ message: "Нет доступа к проекту" });
      }
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project Columns
  app.get("/api/projects/:projectId/columns", async (req, res) => {
    const currentUser = req.user as any;
    if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
    const project = await storage.getProjectById(req.params.projectId).catch(() => undefined);
    if (!project || !(await canAccessProject(currentUser, project))) {
      return res.status(404).json({ message: "Проект не найден или недоступен" });
    }
    const columns = await withDbTimeout(
      () => storage.getProjectColumns(req.params.projectId),
      3000,
      []
    );
    res.json(columns);
  });

  app.post("/api/projects/:projectId/columns", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, color } = req.body;
      const columnName = String(name || "").trim();
      if (!columnName) {
        return res.status(400).json({ message: "Введите название столбца" });
      }
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Доска не найдена" });
      }
      if (!(await canAccessProject(req.user, project))) {
        return res.status(403).json({ message: "Нет доступа к проекту" });
      }

      // Получаем текущие столбцы для определения следующего order
      const existingColumns = await storage.getProjectColumns(projectId);
      const nextOrder = existingColumns.length;

      const column = await storage.createProjectColumn({
        projectId,
        name: columnName,
        color: color || null,
        order: nextOrder,
      });

      res.status(201).json(column);
    } catch (error: any) {
      console.error("Error creating project column:", error);
      const msg = (error.message || "").toLowerCase();
      const isDb = /timeout|econnrefused|connection|password|auth|database/i.test(msg);
      res.status(500).json({
        message: isDb
          ? "Ошибка подключения к базе данных. Проверьте PostgreSQL и DATABASE_URL в .env."
          : (error.message || "Не удалось создать столбец"),
      });
    }
  });

  app.put("/api/projects/:projectId/columns/:id", async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.projectId);
      if (!project || !(await canAccessProject(req.user, project))) {
        return res.status(404).json({ message: "Проект не найден или недоступен" });
      }
      const updateData: any = {};
      if (req.body?.name !== undefined) {
        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ message: "Введите название столбца" });
        updateData.name = name;
      }
      if (req.body?.color !== undefined) updateData.color = req.body.color || null;
      if (req.body?.order !== undefined) updateData.order = Number(req.body.order) || 0;
      const column = await storage.updateProjectColumn(req.params.id, updateData);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      res.json(column);
    } catch (error) {
      res.status(500).json({ message: "Failed to update column" });
    }
  });

  app.delete("/api/projects/:projectId/columns/:id", async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.projectId);
      if (!project || !(await canAccessProject(req.user, project))) {
        return res.status(404).json({ message: "Проект не найден или недоступен" });
      }
      await storage.deleteProjectColumn(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete column" });
    }
  });

  app.post("/api/projects/:projectId/columns/reorder", async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProjectById(projectId);
      if (!project || !(await canAccessProject(req.user, project))) {
        return res.status(404).json({ message: "Проект не найден или недоступен" });
      }
      const { columnIds } = req.body;

      if (!Array.isArray(columnIds)) {
        return res.status(400).json({ message: "columnIds must be an array" });
      }

      await storage.reorderProjectColumns(projectId, columnIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering columns:", error);
      res.status(500).json({ message: "Failed to reorder columns" });
    }
  });

  // Custom Locations
  const recordingPlaceStatusSchema = z.enum(["available", "occupied", "reserved", "maintenance", "unavailable"]);
  const customLocationPayloadSchema = z.object({
    companyId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1, "Название площадки обязательно").max(160),
    type: z.string().trim().max(120).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    notes: z.string().trim().max(20_000).nullable().optional(),
    status: recordingPlaceStatusSchema.default("available"),
  });
  const customLocationUpdateSchema = customLocationPayloadSchema.partial().omit({ companyId: true });

  const canManageLocationCompany = async (user: any, companyId: string) => {
    if (!user?.id || !companyId) return false;
    const workspace = await getActiveWorkspaceForUser(user);
    if (workspace.type !== "company" || String(workspace.companyId || "") !== String(companyId)) {
      return false;
    }
    if (await canManageCompany(user, companyId).catch(() => false)) return true;
    return user.role === "manager";
  };

  const canAccessLocation = async (user: any, location: any) => {
    if (!user?.id || !location) return false;
    const companyId = String(location.companyId || "").trim();
    if (!companyId) return false;
    const workspace = await getActiveWorkspaceForUser(user);
    return workspace.type === "company" && String(workspace.companyId || "") === companyId;
  };

  const getLocationLinkedWork = async (location: any) => {
    const boards = (await storage.getKanbanBoards().catch(() => []))
      .filter((board: any) => !location.companyId || String(board.companyId || "") === String(location.companyId));
    const boardRows = await Promise.all((boards as any[]).map(async (board) => {
      const [lists, cards] = await Promise.all([
        storage.getKanbanListsByBoardId(board.id).catch(() => []),
        storage.getKanbanCardsByBoardId(board.id).catch(() => []),
      ]);
      const listById = new Map((lists as any[]).map((list) => [String(list.id), list]));
      const linkedCards = [];
      for (const card of cards as any[]) {
        const locationIds = await getKanbanCardLocationIds(card);
        if (!locationIds.includes(String(location.id))) continue;
        const list = listById.get(String(card.listId)) as any;
        linkedCards.push({
          id: card.id,
          title: card.title,
          boardId: board.id,
          boardName: board.name,
          projectId: card.projectId || board.projectId || null,
          listId: card.listId,
          listName: list?.name || "Список",
          listType: list?.type || "active",
          status: ["closed", "archive", "trash"].includes(String(list?.type || "")) ? "completed" : "active",
        });
      }
      return linkedCards;
    }));
    const cards = boardRows.flat();

    const directProjectLinks = await storage.getProjectLocationLinksByLocationId(location.id).catch(() => []);
    const directProjectIds = new Set((directProjectLinks as any[]).map((link) => String(link.projectId)));
    const cardProjectIds = new Set(cards.map((card) => String(card.projectId || "")).filter(Boolean));
    const projects = (await storage.getProjects().catch(() => []))
      .filter((project: any) =>
        (!location.companyId || String(project.companyId || "") === String(location.companyId)) &&
        (directProjectIds.has(String(project.id)) || cardProjectIds.has(String(project.id))),
      )
      .map((project: any) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        completed: ["completed", "archived"].includes(String(project.status || "")),
        source: directProjectIds.has(String(project.id)) && cardProjectIds.has(String(project.id))
          ? "direct_and_cards"
          : directProjectIds.has(String(project.id)) ? "direct" : "cards",
      }));

    return { cards, projects };
  };

  const getLocationActiveLinkSummary = async (
    location: any,
    linkedWork?: Awaited<ReturnType<typeof getLocationLinkedWork>>,
  ) => {
    const [issues, resolvedLinkedWork] = await Promise.all([
      storage.getLocationIssues(location.id).catch(() => []),
      linkedWork ? Promise.resolve(linkedWork) : getLocationLinkedWork(location),
    ]);
    const unresolvedIssues = (issues as any[])
      .filter((issue: any) => normalizeLocationTopicStatus(issue.status) === "active").length;
    const activeKanbanCards = resolvedLinkedWork.cards.filter((card) => card.status === "active").length;
    const activeProjects = resolvedLinkedWork.projects.filter((project) => !project.completed).length;
    return {
      activeKanbanCards,
      activeProjects,
      unresolvedDiscussions: unresolvedIssues,
      total: activeKanbanCards + activeProjects + unresolvedIssues,
    };
  };

  const serializeCustomLocation = async (location: any) => {
    const [updatedBy, archivedBy] = await Promise.all([
      location.updatedByUserId ? storage.getUser(String(location.updatedByUserId)).catch(() => undefined) : undefined,
      location.archivedByUserId ? storage.getUser(String(location.archivedByUserId)).catch(() => undefined) : undefined,
    ]);
    return {
      ...location,
      attachments: Array.isArray(location.attachments) ? location.attachments : [],
      updatedByName: updatedBy?.name || updatedBy?.username || null,
      archivedByName: archivedBy?.name || archivedBy?.username || null,
    };
  };

  app.get("/api/locations", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveWorkspace(req, res);
      if (!workspace) return;
      if (workspace.type !== "company" || !workspace.companyId) return res.json([]);
      const archive = ["active", "archived", "all"].includes(String(req.query.archive))
        ? String(req.query.archive)
        : "active";
      const locations = (await storage.getCustomLocations())
        .filter((location: any) =>
          String(location.companyId || "") === String(workspace.companyId),
        )
        .filter((location: any) =>
          archive === "all" ||
          (archive === "archived" ? Boolean(location.archivedAt) : !location.archivedAt),
        );
      res.json(await Promise.all(locations.map(serializeCustomLocation)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get("/api/locations/:id", async (req, res) => {
    try {
      const location = await storage.getCustomLocationById(req.params.id);
      if (!location) return res.status(404).json({ message: "Площадка не найдена" });
      if (!(await canAccessLocation(req.user, location))) return res.status(403).json({ message: "Нет доступа к площадке" });
      const linkedWork = await getLocationLinkedWork(location);
      const activeLinks = await getLocationActiveLinkSummary(location, linkedWork);
      res.json({
        ...(await serializeCustomLocation(location)),
        activeLinks,
        linkedWork,
      });
    } catch {
      res.status(500).json({ message: "Не удалось загрузить площадку" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const workspace = await requireActiveCompanyWorkspace(req, res);
      if (!workspace) return;
      const parsed = customLocationPayloadSchema.parse(req.body || {});
      const companyId = String(workspace.companyId);
      if (!(await canManageLocationCompany(currentUser, companyId))) {
        return res.status(403).json({ message: "Нет прав на создание площадки этой компании" });
      }
      const duplicate = (await storage.getCustomLocations()).some((location: any) =>
        String(location.companyId || "") === companyId &&
        String(location.name || "").trim().toLocaleLowerCase("ru-RU") === parsed.name.toLocaleLowerCase("ru-RU"),
      );
      if (duplicate) return res.status(409).json({ message: "Площадка с таким названием уже существует в компании" });
      const location = await storage.createCustomLocation({
        ...parsed,
        companyId,
        updatedByUserId: currentUser.id,
      } as any);
      res.status(201).json(await serializeCustomLocation(location));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные площадки", errors: error.flatten?.() });
      }
      res.status(500).json({ message: error?.message || "Не удалось создать площадку" });
    }
  });

  app.put("/api/locations/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const existing = await storage.getCustomLocationById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Площадка не найдена" });
      if (existing.archivedAt) {
        return res.status(409).json({ message: "Сначала восстановите площадку из архива" });
      }
      const companyId = String(existing.companyId || "").trim();
      if (!(await canManageLocationCompany(currentUser, companyId))) {
        return res.status(403).json({ message: "Нет прав на изменение площадки" });
      }
      const parsed = customLocationUpdateSchema.parse(req.body || {});
      const update = {
        ...parsed,
        ...(parsed.type !== undefined ? { type: parsed.type || null } : {}),
        ...(parsed.address !== undefined ? { address: parsed.address || null } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description || null } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes || null } : {}),
        updatedByUserId: currentUser.id,
      };
      if (Object.keys(update).length === 0) return res.status(400).json({ message: "Нет данных для обновления" });
      const location = await storage.updateCustomLocation(req.params.id, update as any);
      res.json(await serializeCustomLocation(location));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте данные площадки", errors: error.flatten?.() });
      }
      res.status(500).json({ message: "Не удалось обновить площадку" });
    }
  });

  app.get("/api/locations/:id/archive-preview", async (req, res) => {
    try {
      const location = await storage.getCustomLocationById(req.params.id);
      if (!location) return res.status(404).json({ message: "Площадка не найдена" });
      if (!(await canManageLocationCompany(req.user, String(location.companyId || "")))) {
        return res.status(403).json({ message: "Нет прав на архивирование площадки" });
      }
      res.json({ locationId: location.id, activeLinks: await getLocationActiveLinkSummary(location) });
    } catch {
      res.status(500).json({ message: "Не удалось проверить связи площадки" });
    }
  });

  app.post("/api/locations/:id/archive", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const location = await storage.getCustomLocationById(req.params.id);
      if (!location) return res.status(404).json({ message: "Площадка не найдена" });
      if (location.archivedAt) return res.status(409).json({ message: "Сначала восстановите площадку из архива" });
      if (!(await canManageLocationCompany(currentUser, String(location.companyId || "")))) {
        return res.status(403).json({ message: "Нет прав на архивирование площадки" });
      }
      const activeLinks = await getLocationActiveLinkSummary(location);
      if (activeLinks.total > 0 && req.body?.confirmed !== true) {
        return res.status(409).json({
          message: "У площадки есть активные связи. Подтвердите архивирование.",
          code: "LOCATION_ARCHIVE_CONFIRMATION_REQUIRED",
          activeLinks,
        });
      }
      const updated = await storage.updateCustomLocation(location.id, {
        archivedAt: new Date(),
        archivedByUserId: currentUser.id,
        updatedByUserId: currentUser.id,
      } as any);
      res.json({ location: await serializeCustomLocation(updated), activeLinks });
    } catch {
      res.status(500).json({ message: "Не удалось архивировать площадку" });
    }
  });

  app.post("/api/locations/:id/restore", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const location = await storage.getCustomLocationById(req.params.id);
      if (!location) return res.status(404).json({ message: "Площадка не найдена" });
      if (!(await canManageLocationCompany(currentUser, String(location.companyId || "")))) {
        return res.status(403).json({ message: "Нет прав на восстановление площадки" });
      }
      if (!location.archivedAt) return res.status(409).json({ message: "Площадка не находится в архиве" });
      const updated = await storage.updateCustomLocation(location.id, {
        archivedAt: null,
        archivedByUserId: null,
        updatedByUserId: currentUser.id,
      } as any);
      res.json(await serializeCustomLocation(updated));
    } catch {
      res.status(500).json({ message: "Не удалось восстановить площадку" });
    }
  });

  app.delete("/api/locations/:id", async (req, res) => {
    req.body = { ...(req.body || {}), confirmed: req.body?.confirmed === true };
    const location = await storage.getCustomLocationById(req.params.id).catch(() => undefined);
    if (!location) return res.status(404).json({ message: "Площадка не найдена" });
    const currentUser = req.user as any;
    if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
    if (!(await canManageLocationCompany(currentUser, String(location.companyId || "")))) {
      return res.status(403).json({ message: "Нет прав на архивирование площадки" });
    }
    const activeLinks = await getLocationActiveLinkSummary(location);
    if (activeLinks.total > 0 && req.body.confirmed !== true) {
      return res.status(409).json({
        message: "У площадки есть активные связи. Подтвердите архивирование.",
        code: "LOCATION_ARCHIVE_CONFIRMATION_REQUIRED",
        activeLinks,
      });
    }
    const updated = await storage.updateCustomLocation(location.id, {
      archivedAt: new Date(),
      archivedByUserId: currentUser.id,
      updatedByUserId: currentUser.id,
    } as any);
    res.json({ success: true, mode: "archived", location: await serializeCustomLocation(updated), activeLinks });
  });

  app.post("/api/locations/:id/attachments", locationAttachmentUpload.single("file"), async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const location = await storage.getCustomLocationById(req.params.id);
      if (!location) return res.status(404).json({ message: "Площадка не найдена" });
      if (location.archivedAt) return res.status(409).json({ message: "Сначала восстановите площадку из архива" });
      if (!(await canManageLocationCompany(currentUser, String(location.companyId || "")))) {
        return res.status(403).json({ message: "Нет прав на добавление файлов" });
      }
      if (!req.file) return res.status(400).json({ message: "Выберите поддерживаемый файл до 10 МБ" });
      const attachment = {
        id: crypto.randomUUID(),
        fileName: req.file.originalname,
        fileUrl: `/uploads/locations/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedByUserId: currentUser.id,
        uploadedByName: currentUser.name || currentUser.username || null,
        createdAt: new Date().toISOString(),
      };
      const attachments = Array.isArray(location.attachments) ? location.attachments : [];
      const updated = await storage.updateCustomLocation(location.id, {
        attachments: [...attachments, attachment],
        updatedByUserId: currentUser.id,
      } as any);
      res.status(201).json({ attachment, location: await serializeCustomLocation(updated) });
    } catch {
      res.status(500).json({ message: "Не удалось добавить файл площадки" });
    }
  });

  app.delete("/api/locations/:id/attachments/:attachmentId", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const location = await storage.getCustomLocationById(req.params.id);
      if (!location) return res.status(404).json({ message: "Площадка не найдена" });
      if (location.archivedAt) return res.status(409).json({ message: "Сначала восстановите площадку из архива" });
      if (!(await canManageLocationCompany(currentUser, String(location.companyId || "")))) {
        return res.status(403).json({ message: "Нет прав на удаление файлов" });
      }
      const attachments = Array.isArray(location.attachments) ? location.attachments as any[] : [];
      const attachment = attachments.find((item) => String(item?.id) === String(req.params.attachmentId));
      if (!attachment) return res.status(404).json({ message: "Файл площадки не найден" });
      const updated = await storage.updateCustomLocation(location.id, {
        attachments: attachments.filter((item) => String(item?.id) !== String(req.params.attachmentId)),
        updatedByUserId: currentUser.id,
      } as any);
      if (typeof attachment.fileUrl === "string" && attachment.fileUrl.startsWith("/uploads/locations/")) {
        await fs.unlink(path.join(process.cwd(), attachment.fileUrl)).catch(() => undefined);
      }
      res.json({ success: true, location: await serializeCustomLocation(updated) });
    } catch {
      res.status(500).json({ message: "Не удалось удалить файл площадки" });
    }
  });

  const locationTopicTypeSchema = z.enum(["note", "issue"]);
  const locationIssueSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
  const locationTopicStatusSchema = z.enum(["active", "resolved", "archived"]);
  const locationTopicCreateSchema = z.object({
    locationId: z.string().trim().min(1),
    type: locationTopicTypeSchema.default("issue"),
    title: z.string().trim().min(1, "Название темы обязательно").max(240),
    description: z.string().trim().min(1, "Описание темы обязательно").max(20_000),
    severity: locationIssueSeveritySchema.nullable().optional(),
    projectId: z.string().trim().min(1).max(160).nullable().optional(),
    kanbanCardId: z.string().trim().min(1).max(160).nullable().optional(),
  });
  const locationTopicUpdateSchema = locationTopicCreateSchema
    .omit({ locationId: true })
    .partial()
    .extend({ status: locationTopicStatusSchema.optional() });
  const locationTopicMessageSchema = z.object({
    content: z.string().trim().max(10_000).default(""),
  });

  const publishLocationTopicEvent = (
    location: any,
    action: DiscussionRealtimeEvent["action"],
    recordId: string,
    version?: string | Date | null,
  ) => {
    publishDiscussionEvent(createDiscussionRealtimeEvent({
      channel: `location:${location.id}:topics`,
      action,
      recordId,
      version,
    }));
    if (location.companyId) {
      publishDiscussionEvent(createDiscussionRealtimeEvent({
        channel: `company:${location.companyId}`,
        action,
        recordId,
        version,
      }));
    }
  };

  const validateLocationTopicLinks = async (
    currentUser: any,
    location: any,
    requestedProjectId: string | null,
    requestedCardId: string | null,
  ) => {
    let projectId = requestedProjectId;
    let project: any = null;
    let card: any = null;

    if (requestedCardId) {
      card = await storage.getKanbanCardById(requestedCardId).catch(() => undefined);
      if (!card) return { ok: false as const, status: 400, message: "Карточка Kanban V2 не найдена" };
      const access = await getKanbanBoardAccess(currentUser, String(card.boardId));
      if (!access) return { ok: false as const, status: 403, message: "Нет доступа к карточке Kanban V2" };
      if (!access.board.companyId || String(access.board.companyId) !== String(location.companyId || "")) {
        return { ok: false as const, status: 403, message: "Карточка принадлежит другой компании" };
      }
      const cardLocationIds = await getKanbanCardLocationIds(card);
      if (!cardLocationIds.includes(String(location.id))) {
        return { ok: false as const, status: 400, message: "Карточка не связана с выбранной площадкой" };
      }
      const cardProjectId = String(card.projectId || access.board.projectId || "").trim() || null;
      if (projectId && cardProjectId && String(projectId) !== cardProjectId) {
        return { ok: false as const, status: 400, message: "Карточка относится к другому проекту" };
      }
      projectId = projectId || cardProjectId;
    }

    if (projectId) {
      project = await storage.getProjectById(projectId).catch(() => undefined);
      if (!project) return { ok: false as const, status: 400, message: "Проект не найден" };
      if (!(await canAccessProject(currentUser, project))) {
        return { ok: false as const, status: 403, message: "Нет доступа к проекту" };
      }
      if (!project.companyId || String(project.companyId) !== String(location.companyId || "")) {
        return { ok: false as const, status: 403, message: "Проект принадлежит другой компании" };
      }
      const [directLocationIds, cardLocationIds] = await Promise.all([
        getProjectDirectLocationIds(project.id),
        getProjectCardLocationIds(project.id),
      ]);
      if (!normalizeLocationIds([...directLocationIds, ...cardLocationIds]).includes(String(location.id))) {
        return { ok: false as const, status: 400, message: "Проект не связан с выбранной площадкой" };
      }
    }

    return {
      ok: true as const,
      projectId: projectId || null,
      kanbanCardId: requestedCardId || null,
      project,
      card,
    };
  };

  const serializeLocationTopic = async (issue: any, currentUser: any, providedLocation?: any) => {
    const location = providedLocation || await storage.getCustomLocationById(issue.locationId).catch(() => undefined);
    const [comments, reporter, project, card] = await Promise.all([
      storage.getLocationIssueComments(issue.id).catch(() => []),
      issue.reportedByUserId ? storage.getUser(String(issue.reportedByUserId)).catch(() => undefined) : undefined,
      issue.projectId ? storage.getProjectById(String(issue.projectId)).catch(() => undefined) : undefined,
      issue.kanbanCardId ? storage.getKanbanCardById(String(issue.kanbanCardId)).catch(() => undefined) : undefined,
    ]);
    const users = await storage.getUsers().catch(() => []);
    const userById = new Map((users as any[]).map((user) => [String(user.id), user]));
    const canManage = Boolean(location && await canManageLocationCompany(currentUser, String(location.companyId || "")));
    const status = normalizeLocationTopicStatus(issue.status);
    const type = normalizeLocationTopicType(issue.type);
    return {
      ...issue,
      type,
      status,
      severity: type === "issue" ? String(issue.severity || "medium") : null,
      authorName: String(issue.authorName || reporter?.name || reporter?.username || "Пользователь"),
      comments: (comments as any[]).map((comment) => {
        const author = userById.get(String(comment.userId)) as any;
        return {
          ...comment,
          authorName: String(comment.authorName || author?.name || author?.username || "Пользователь"),
          attachments: Array.isArray(comment.attachments) ? comment.attachments : [],
        };
      }),
      project: project ? { id: project.id, name: project.name } : null,
      kanbanCard: card ? { id: card.id, title: card.title, boardId: card.boardId } : null,
      canEdit: status !== "archived" && (
        canManage || String(issue.reportedByUserId || "") === String(currentUser.id)
      ),
      canManage,
      canReply: status !== "archived" && !location?.archivedAt,
    };
  };

  app.get("/api/location-issues", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const locationId = typeof req.query.locationId === "string" ? req.query.locationId : undefined;
      const requestedStatus = typeof req.query.status === "string"
        ? locationTopicStatusSchema.safeParse(req.query.status)
        : null;
      const requestedType = typeof req.query.type === "string"
        ? locationTopicTypeSchema.safeParse(req.query.type)
        : null;
      const locations = await storage.getCustomLocations();
      const accessibleLocationIds = new Set((await Promise.all(locations.map(async (location) =>
        (await canAccessLocation(currentUser, location)) ? String(location.id) : "",
      ))).filter(Boolean));
      if (locationId && !accessibleLocationIds.has(locationId)) {
        return res.status(403).json({ message: "Нет доступа к площадке" });
      }
      const issues = (await storage.getLocationIssues(locationId))
        .filter((issue) => accessibleLocationIds.has(String(issue.locationId)))
        .filter((issue) => !requestedStatus?.success || normalizeLocationTopicStatus(issue.status) === requestedStatus.data)
        .filter((issue) => !requestedType?.success || normalizeLocationTopicType((issue as any).type) === requestedType.data);
      const locationById = new Map((locations as any[]).map((location) => [String(location.id), location]));
      res.json(await Promise.all(issues.map((issue) =>
        serializeLocationTopic(issue, currentUser, locationById.get(String(issue.locationId))),
      )));
    } catch {
      res.status(500).json({ message: "Не удалось загрузить темы площадок" });
    }
  });

  app.post("/api/location-issues", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const payload = locationTopicCreateSchema.parse(req.body || {});
      if (payload.type === "issue" && !payload.severity) {
        return res.status(400).json({ message: "Для проблемы укажите важность" });
      }
      const location = await storage.getCustomLocationById(payload.locationId);
      if (!location) return res.status(400).json({ message: "Выберите существующую площадку" });
      if (!(await canAccessLocation(currentUser, location))) {
        return res.status(403).json({ message: "Нет доступа к площадке" });
      }
      if (location.archivedAt) {
        return res.status(409).json({ message: "Нельзя создать тему для архивной площадки" });
      }
      const links = await validateLocationTopicLinks(
        currentUser,
        location,
        payload.projectId || null,
        payload.kanbanCardId || null,
      );
      if (!links.ok) return res.status(links.status).json({ message: links.message });
      const parsed = insertLocationIssueSchema.parse({
        locationId: payload.locationId,
        taskId: null,
        kanbanCardId: links.kanbanCardId,
        projectId: links.projectId,
        type: payload.type,
        title: payload.title,
        description: payload.description,
        reportedByUserId: currentUser.id,
        authorName: String(currentUser.name || currentUser.username || "Пользователь"),
        severity: payload.type === "issue" ? payload.severity : null,
        status: "active",
        photos: [],
        resolvedAt: null,
        resolvedByUserId: null,
        archivedAt: null,
        archivedByUserId: null,
      });
      const issue = await storage.createLocationIssue(parsed);
      publishLocationTopicEvent(location, "created", issue.id, issue.updatedAt);
      res.status(201).json(await serializeLocationTopic(issue, currentUser, location));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Проверьте обязательные поля темы", errors: error.flatten?.() });
      }
      console.error("[Location topics] Failed to create topic:", error);
      res.status(500).json({ message: "Не удалось создать тему площадки" });
    }
  });

  app.put("/api/location-issues/:id", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const issue = await storage.getLocationIssueById(req.params.id);
      if (!issue) return res.status(404).json({ message: "Тема площадки не найдена" });
      const location = await storage.getCustomLocationById(issue.locationId);
      if (!location || !(await canAccessLocation(currentUser, location))) {
        return res.status(403).json({ message: "Нет доступа к площадке" });
      }
      const payload = locationTopicUpdateSchema.parse(req.body || {});
      const canManage = await canManageLocationCompany(currentUser, String(location.companyId || ""));
      if (!canManage && String(issue.reportedByUserId) !== String(currentUser.id)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения темы" });
      }
      const currentStatus = normalizeLocationTopicStatus(issue.status);
      if (currentStatus === "archived") {
        return res.status(409).json({ message: "Архивную тему нельзя изменять" });
      }
      if (payload.status !== undefined && !canManage) {
        return res.status(403).json({ message: "Изменять статус темы может менеджер компании" });
      }
      const update: Record<string, unknown> = {};
      if (payload.title !== undefined) update.title = payload.title;
      if (payload.description !== undefined) update.description = payload.description;
      const nextType = payload.type ?? normalizeLocationTopicType((issue as any).type);
      if (payload.type !== undefined) update.type = payload.type;
      if (nextType === "note") {
        update.severity = null;
      } else if (payload.severity !== undefined) {
        if (!payload.severity) return res.status(400).json({ message: "Для проблемы укажите важность" });
        update.severity = payload.severity;
      } else if (!issue.severity) {
        update.severity = "medium";
      }
      if (
        payload.projectId !== undefined ||
        payload.kanbanCardId !== undefined
      ) {
        const links = await validateLocationTopicLinks(
          currentUser,
          location,
          payload.projectId === undefined ? (issue.projectId || null) : payload.projectId,
          payload.kanbanCardId === undefined ? (issue.kanbanCardId || null) : payload.kanbanCardId,
        );
        if (!links.ok) return res.status(links.status).json({ message: links.message });
        update.projectId = links.projectId;
        update.kanbanCardId = links.kanbanCardId;
      }
      if (payload.status !== undefined) {
        if (payload.status === "active") {
          update.status = "active";
          update.resolvedAt = null;
          update.resolvedByUserId = null;
        } else if (payload.status === "resolved") {
          update.status = "resolved";
          update.resolvedAt = new Date();
          update.resolvedByUserId = currentUser.id;
        } else {
          update.status = "archived";
          update.archivedAt = new Date();
          update.archivedByUserId = currentUser.id;
        }
      }
      const updated = await storage.updateLocationIssue(issue.id, update as any);
      if (!updated) return res.status(404).json({ message: "Тема площадки не найдена" });
      publishLocationTopicEvent(
        location,
        payload.status !== undefined ? "status" : "updated",
        updated.id,
        updated.updatedAt,
      );
      res.json(await serializeLocationTopic(updated, currentUser, location));
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Некорректные данные темы", errors: error.flatten?.() });
      }
      res.status(500).json({ message: "Не удалось обновить тему площадки" });
    }
  });

  app.get("/api/location-issues/:id/comments", async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const issue = await storage.getLocationIssueById(req.params.id);
      if (!issue) return res.status(404).json({ message: "Тема площадки не найдена" });
      const location = await storage.getCustomLocationById(issue.locationId);
      if (!location || !(await canAccessLocation(currentUser, location))) {
        return res.status(403).json({ message: "Нет доступа к площадке" });
      }
      const serialized = await serializeLocationTopic(issue, currentUser, location);
      res.json(serialized.comments);
    }
    catch { res.status(500).json({ message: "Не удалось загрузить комментарии" }); }
  });

  app.post("/api/location-issues/:id/comments", locationTopicMessageUpload, async (req, res) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    let filesPersisted = false;
    const cleanupUploadedFiles = async () => {
      await Promise.all(uploadedFiles.map((file) => fs.unlink(file.path).catch(() => undefined)));
    };
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) {
        await cleanupUploadedFiles();
        return res.status(401).json({ message: "Требуется авторизация" });
      }
      const issue = await storage.getLocationIssueById(req.params.id);
      if (!issue) {
        await cleanupUploadedFiles();
        return res.status(404).json({ message: "Тема площадки не найдена" });
      }
      const location = await storage.getCustomLocationById(issue.locationId);
      if (!location || !(await canAccessLocation(currentUser, location))) {
        await cleanupUploadedFiles();
        return res.status(403).json({ message: "Нет доступа к площадке" });
      }
      if (location.archivedAt || normalizeLocationTopicStatus(issue.status) === "archived") {
        await cleanupUploadedFiles();
        return res.status(409).json({ message: "В архивную тему нельзя добавлять ответы" });
      }
      if ((req as any).locationAttachmentRejected) {
        await cleanupUploadedFiles();
        return res.status(400).json({ message: "Формат одного или нескольких файлов не поддерживается" });
      }
      const payload = locationTopicMessageSchema.parse(req.body || {});
      if (!payload.content && uploadedFiles.length === 0) {
        return res.status(400).json({ message: "Добавьте текст или поддерживаемый файл до 10 МБ" });
      }
      const attachments = uploadedFiles.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.originalname,
        fileUrl: `/uploads/locations/${file.filename}`,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedByUserId: currentUser.id,
        uploadedByName: currentUser.name || currentUser.username || null,
        createdAt: new Date().toISOString(),
      }));
      const comment = insertLocationIssueCommentSchema.parse({
        issueId: req.params.id,
        userId: currentUser.id,
        authorName: String(currentUser.name || currentUser.username || "Пользователь"),
        content: payload.content,
        attachments,
      });
      const created = await storage.createLocationIssueComment(comment);
      filesPersisted = true;
      const refreshedIssue = await storage.updateLocationIssue(issue.id, {});
      publishLocationTopicEvent(location, "replied", created.id, refreshedIssue?.updatedAt || created.updatedAt);
      const serialized = await serializeLocationTopic(refreshedIssue || issue, currentUser, location);
      res.status(201).json(serialized.comments.find((item: any) => String(item.id) === String(created.id)) || created);
    } catch (error: any) {
      if (!filesPersisted) await cleanupUploadedFiles();
      if (error?.name === "ZodError") return res.status(400).json({ message: "Некорректный комментарий" });
      res.status(500).json({ message: "Не удалось добавить комментарий" });
    }
  });

  app.post("/api/location-issues/:id/photos", upload.single("photo"), async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser?.id) return res.status(401).json({ message: "Требуется авторизация" });
      const issue = await storage.getLocationIssueById(req.params.id);
      if (!issue) return res.status(404).json({ message: "Тема площадки не найдена" });
      const location = await storage.getCustomLocationById(issue.locationId);
      if (!location || !(await canAccessLocation(currentUser, location))) {
        return res.status(403).json({ message: "Нет доступа к площадке" });
      }
      if (!req.file) return res.status(400).json({ message: "Выберите изображение до 5 МБ" });
      const photos = Array.isArray(issue.photos) ? issue.photos : [];
      const updated = await storage.updateLocationIssue(issue.id, { photos: [...photos, `/uploads/${req.file.filename}`] } as any);
      if (updated) publishLocationTopicEvent(location, "updated", updated.id, updated.updatedAt);
      res.json(updated ? await serializeLocationTopic(updated, currentUser, location) : updated);
    } catch {
      res.status(500).json({ message: "Не удалось загрузить фото темы" });
    }
  });

  // Repositories
  app.get("/api/repositories", async (req, res) => {
    try {
      const repositories = await storage.getRepositories();
      res.json(repositories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch repositories" });
    }
  });

  app.post("/api/repositories", async (req, res) => {
    try {
      const currentUser = req.user;
      if (!currentUser) return res.status(401).json({ message: "Требуется авторизация" });
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Только администратор может создавать репозитории" });
      }
      const repository = await storage.createRepository(req.body);
      res.status(201).json(repository);
    } catch (error) {
      res.status(500).json({ message: "Failed to create repository" });
    }
  });

  app.put("/api/repositories/:id", async (req, res) => {
    try {
      const currentUser = req.user;
      if (!currentUser) return res.status(401).json({ message: "Требуется авторизация" });
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Только администратор может редактировать репозитории" });
      }
      const repository = await storage.updateRepository(req.params.id, req.body);
      if (!repository) {
        return res.status(404).json({ message: "Repository not found" });
      }
      res.json(repository);
    } catch (error) {
      res.status(500).json({ message: "Failed to update repository" });
    }
  });

  app.delete("/api/repositories/:id", async (req, res) => {
    try {
      const currentUser = req.user;
      if (!currentUser) return res.status(401).json({ message: "Требуется авторизация" });
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Только администратор может удалять репозитории" });
      }
      await storage.deleteRepository(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete repository" });
    }
  });

  // ——— YouGile API (двусторонняя синхронизация задач, https://ru.yougile.com/api-v2#/) ———
  const {
    isYouGileConfigured,
    yougileGetAuthKey,
    setYouGileApiKey,
    yougileGetProjects,
    yougileGetBoards,
    yougileGetColumns,
    yougileGetTasks,
    yougileGetUsers,
    yougileCreateTask,
    yougileUpdateTask,
    yougileDeleteTask,
    getYouGileColumnMap,
    setYouGileColumnMap,
  } = await import("./yougile");

  /** Получить API-ключ по логину и паролю YouGile (companyId берётся из YOUGILE_COMPANY_ID в .env) и сохранить в файл .yougile-key */
  app.post("/api/yougile/auth/key", async (req, res) => {
    try {
      const companyId = (process.env.YOUGILE_COMPANY_ID || "").trim();
      if (!companyId) {
        return res.status(400).json({ message: "Задайте YOUGILE_COMPANY_ID в .env" });
      }
      const { login, password } = req.body || {};
      if (!login || !password) {
        return res.status(400).json({ message: "Укажите login и password в теле запроса" });
      }
      const { key } = await yougileGetAuthKey(String(login), String(password), companyId);
      if (!key) {
        return res.status(500).json({ message: "YouGile не вернул ключ" });
      }
      setYouGileApiKey(key);
      res.json({ success: true, message: "Ключ сохранён. YouGile готов к работе." });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Не удалось получить ключ YouGile" });
    }
  });

  app.get("/api/yougile/config", (req, res) => {
    res.json({
      enabled: isYouGileConfigured(),
      companyId: process.env.YOUGILE_COMPANY_ID || null,
      defaultColumnId: process.env.YOUGILE_DEFAULT_COLUMN_ID || null,
    });
  });

  app.get("/api/yougile/status", (req, res) => {
    res.json({ configured: isYouGileConfigured() });
  });

  /** Проекты YouGile — из БД (без запросов к API). При ?sync=1 — сначала синхронизация кэша из YouGile, затем ответ из БД. */
  app.get("/api/yougile/projects", async (req, res) => {
    try {
      if (!isYouGileConfigured()) return res.json([]);
      const forceSync = req.query.sync === "1" || req.query.sync === "true";
      if (forceSync) {
        const { clearYougileCache } = await import("./yougile");
        clearYougileCache();
        const ygProjects = await yougileGetProjects();
        await storage.upsertYougileProjects(ygProjects.map((p: any) => ({ id: p.id, title: p.title ?? null })));
        for (const p of ygProjects) {
          const boards = await yougileGetBoards(p.id);
          await storage.upsertYougileBoards(boards.map((b: any) => ({ id: b.id, projectId: b.projectId || p.id, title: b.title ?? null })));
          for (const b of boards) {
            const cols = await yougileGetColumns(b.id);
            await storage.upsertYougileColumns(cols.map((c: any) => ({ id: c.id, boardId: b.id, title: c.title ?? null, order: c.order ?? 0, color: (c as any).color ?? null })));
          }
        }
        const ygUsers = await yougileGetUsers().catch(() => []);
        await storage.upsertYougileUsers(ygUsers.map((u: any) => ({ id: u.id, email: u.email ?? null, username: u.username ?? null })));
      }
      const list = await storage.getYougileProjects();
      res.json(list.map((p: any) => ({ id: p.id, title: p.title ?? undefined })));
    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ message: e?.message || "Ошибка YouGile" });
    }
  });

  /** Доски YouGile — из БД. При ?sync=1 — обновление кэша (см. GET /api/yougile/projects?sync=1). */
  app.get("/api/yougile/boards", async (req, res) => {
    try {
      if (!isYouGileConfigured()) return res.status(400).json({ message: "YouGile не настроен" });
      const projectId = req.query.projectId as string | undefined;
      const list = await storage.getYougileBoards(projectId);
      res.json(list.map((b: any) => ({ id: b.id, title: b.title ?? undefined, projectId: b.projectId })));
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка YouGile API" });
    }
  });

  /** Все доски YouGile — из БД (для таск-менеджера). */
  app.get("/api/yougile/boards-all", async (req, res) => {
    try {
      if (!isYouGileConfigured()) return res.json([]);
      const list = await storage.getYougileBoards();
      res.json(list.map((b: any) => ({ id: b.id, title: b.title || "Без названия", projectId: b.projectId })));
    } catch (e: any) {
      res.json([]);
    }
  });

  /** Синхронизация: для каждой доски YouGile создаётся локальный видеопроект, если его ещё нет (чтобы проекты из YouGile сразу появлялись в видеопроектах). */
  app.post("/api/yougile/sync-projects", async (req, res) => {
    try {
      if (!isYouGileConfigured()) {
        return res.json({ synced: 0, message: "YouGile не настроен" });
      }
      const existing = await storage.getProjects();
      const linkedBoardIds = new Set((existing as any[]).map((p: any) => p.yougileBoardId).filter(Boolean));
      const projects = await yougileGetProjects();
      let created = 0;
      for (const p of projects) {
        const boards = await yougileGetBoards(p.id);
        for (const b of boards) {
          if (linkedBoardIds.has(b.id)) continue;
          await storage.createProject({
            name: (b.title || p.title || "Проект YouGile").trim() || "Проект YouGile",
            status: "planning",
            yougileBoardId: b.id,
          } as any);
          linkedBoardIds.add(b.id);
          created++;
        }
      }
      res.json({ synced: created });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка синхронизации" });
    }
  });

  /** Колонки доски YouGile — из БД. При ?sync=1 — подтянуть колонки этой доски из API в БД и вернуть. */
  app.get("/api/yougile/columns", async (req, res) => {
    try {
      if (!isYouGileConfigured()) return res.status(400).json({ message: "YouGile не настроен" });
      const boardId = req.query.boardId as string;
      if (!boardId) return res.status(400).json({ message: "boardId обязателен" });
      const forceSync = req.query.sync === "1" || req.query.sync === "true";
      if (forceSync) {
        const { clearYougileCache } = await import("./yougile");
        clearYougileCache();
        const cols = await yougileGetColumns(boardId);
        await storage.upsertYougileColumns(cols.map((c: any) => ({ id: c.id, boardId, title: c.title ?? null, order: c.order ?? 0, color: (c as any).color ?? null })));
      }
      const list = await storage.getYougileColumns(boardId);
      res.json(list.map((c: any) => ({ id: c.id, title: c.title ?? undefined, boardId: c.boardId, order: c.order ?? 0, color: c.color ?? undefined })));
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка YouGile API" });
    }
  });

  /** Стикеры/фильтры доски YouGile с типом и опциями: list (выпадающий список), string (ввод текста), user (исполнитель). */
  app.get("/api/yougile/stickers", async (req, res) => {
    try {
      const { yougileGetStringStickerStates, yougileGetStringStickerValues, isYouGileConfigured } = await import("./yougile");
      if (!isYouGileConfigured()) return res.status(400).json({ message: "YouGile не настроен" });
      const boardId = req.query.boardId as string;
      if (!boardId) return res.status(400).json({ message: "boardId обязателен" });
      const list = await yougileGetStringStickerStates(boardId);
      const withOptions = await Promise.all(list.map(async (s: any) => {
        const title = ((s.title ?? s.id) || "").toString().trim();
        let type = (s.type || "").toString().toLowerCase();
        if (!type && /исполнитель|assignee|performer/i.test(title)) type = "user";
        let options = Array.isArray(s.options) ? s.options : undefined;
        if (!options && type !== "user" && s.id) {
          try {
            const values = await yougileGetStringStickerValues(s.id);
            if (values.length > 0) options = values.map((v: any) => ({ id: v.id ?? v.title, title: v.title ?? v.id }));
          } catch {
            /* ignore */
          }
        }
        if (options && options.length > 0 && !type) type = "list";
        if (!type) type = "string";
        return {
          id: s.id,
          title: title || s.id,
          boardId: s.boardId,
          order: s.order ?? 0,
          type,
          options: options && options.length > 0 ? options : undefined,
        };
      }));
      res.json(withOptions);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка YouGile API" });
    }
  });

  /** Создать колонку на доске YouGile (для видеопроекта: добавить колонку в таск-менеджер) */
  app.post("/api/yougile/columns", async (req, res) => {
    try {
      const { isYouGileConfigured, yougileCreateColumn } = await import("./yougile");
      if (!isYouGileConfigured()) {
        return res.status(400).json({ message: "YouGile не настроен" });
      }
      const { boardId, title, color } = req.body || {};
      if (!boardId || !title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ message: "Укажите boardId и title" });
      }
      const column = await yougileCreateColumn(boardId, title.trim(), color);
      res.status(201).json(column);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка создания колонки YouGile" });
    }
  });

  app.get("/api/yougile/column-map", (req, res) => {
    try {
      res.json(getYouGileColumnMap());
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка чтения маппинга колонок" });
    }
  });

  app.post("/api/yougile/column-map", (req, res) => {
    try {
      const map = req.body && typeof req.body === "object" ? req.body : {};
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(map)) {
        if (typeof k === "string" && typeof v === "string" && v.trim()) normalized[k.trim()] = v.trim();
      }
      setYouGileColumnMap(normalized);
      res.json(normalized);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Не удалось сохранить маппинг колонок" });
    }
  });

  /** Преобразует задачу из БД в формат YouGile (для ответов API). */
  function mapDbTaskToYouGileTask(t: any, boardIdToProjectId?: Map<string, string>): Record<string, unknown> {
    const boardId = t.yougileBoardId ?? undefined;
    const projectId = boardId && boardIdToProjectId ? boardIdToProjectId.get(boardId) : undefined;
    return {
      id: t.yougileTaskId || t.id,
      title: t.title,
      description: t.description ?? undefined,
      columnId: t.status ?? undefined,
      boardId,
      projectId,
      deadline: t.dueDate ? new Date(t.dueDate).getTime() : undefined,
      status: t.status,
      tags: t.tags ?? [],
      subtasks: t.subtasks ?? [],
      assigned: [],
    };
  }

  app.get("/api/yougile/tasks/:yougileTaskId", async (req, res) => {
    try {
      const { yougileTaskId } = req.params;
      if (!isYouGileConfigured()) {
        return res.status(400).json({ message: "YouGile не настроен" });
      }
      const task = await storage.getTaskByYougileTaskId(yougileTaskId);
      if (!task) return res.status(404).json({ message: "Задача YouGile не найдена" });
      const boards = await storage.getYougileBoards();
      const boardIdToProjectId = new Map(boards.map((b: any) => [b.id, b.projectId]));
      res.json(mapDbTaskToYouGileTask(task, boardIdToProjectId));
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка YouGile API" });
    }
  });

  /** Список задач YouGile — из БД (без обращения к API). Синхронизация с YouGile выполняется отдельно через POST /api/yougile/sync. */
  app.get("/api/yougile/tasks", async (req, res) => {
    try {
      if (!isYouGileConfigured()) {
        return res.status(400).json({ message: "YouGile не настроен" });
      }
      const projectId = req.query.projectId as string | undefined;
      const boardId = req.query.boardId as string | undefined;
      const columnId = req.query.columnId as string | undefined;
      const title = req.query.title as string | undefined;
      const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
      const offset = req.query.offset != null ? Number(req.query.offset) : undefined;

      let tasks: any[] = [];
      if (boardId) {
        tasks = await storage.getTasksByYougileBoardId(boardId);
      } else if (projectId) {
        const boards = await storage.getYougileBoards(projectId);
        const seen = new Set<string>();
        for (const b of boards) {
          const byBoard = await storage.getTasksByYougileBoardId(b.id);
          for (const t of byBoard) {
            if (!seen.has(t.id)) {
              seen.add(t.id);
              tasks.push(t);
            }
          }
        }
      } else {
        const all = await storage.getTasks();
        tasks = all.filter((t: any) => t.yougileBoardId);
      }

      if (columnId) tasks = tasks.filter((t: any) => t.status === columnId);
      if (title && title.trim()) {
        const q = title.trim().toLowerCase();
        tasks = tasks.filter((t: any) => (t.title || "").toLowerCase().includes(q));
      }
      const total = tasks.length;
      if (offset != null || limit != null) {
        const off = Math.max(0, offset ?? 0);
        const lim = limit ?? total;
        tasks = tasks.slice(off, off + lim);
      }

      const boards = await storage.getYougileBoards();
      const boardIdToProjectId = new Map(boards.map((b: any) => [b.id, b.projectId]));
      const list = tasks.map((t) => mapDbTaskToYouGileTask(t, boardIdToProjectId));
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка YouGile API" });
    }
  });

  /** Синхронизация из YouGile в БД (кэш проектов/досок/колонок/пользователей + задачи). Без boardId — все доски; с boardId — только эта доска. */
  app.post("/api/yougile/sync", async (req, res) => {
    try {
      if (!isYouGileConfigured()) {
        return res.status(400).json({ message: "YouGile не настроен. Добавьте YOUGILE_API_KEY в .env" });
      }
      const { clearYougileCache } = await import("./yougile");
      clearYougileCache();

      const ygProjects = await yougileGetProjects();
      await storage.upsertYougileProjects(ygProjects.map((p: any) => ({ id: p.id, title: p.title ?? null })));
      for (const p of ygProjects) {
        const boards = await yougileGetBoards(p.id);
        await storage.upsertYougileBoards(boards.map((b: any) => ({ id: b.id, projectId: b.projectId || p.id, title: b.title ?? null })));
        for (const b of boards) {
          const cols = await yougileGetColumns(b.id);
          await storage.upsertYougileColumns(cols.map((c: any) => ({ id: c.id, boardId: b.id, title: c.title ?? null, order: c.order ?? 0, color: (c as any).color ?? null })));
        }
      }
      const ygUsers = await yougileGetUsers().catch(() => []);
      await storage.upsertYougileUsers(ygUsers.map((u: any) => ({ id: u.id, email: u.email ?? null, username: u.username ?? null })));

      const { projectId, boardId, columnId } = req.body || {};
      const currentUser = req.user;
      const creatorId = (currentUser?.id as string) || (await storage.getUsers()).find(u => u.role === "admin")?.id;
      if (!creatorId) {
        return res.status(400).json({ message: "Нужна авторизация для синхронизации" });
      }
      let allYgTasks: Array<{ id: string; title?: string; description?: string; columnId?: string; boardId?: string; deadline?: any }> = [];
      if (boardId || projectId || columnId) {
        allYgTasks = await yougileGetTasks({ projectId, boardId, columnId });
      } else {
        for (const p of ygProjects) {
          const boards = await yougileGetBoards(p.id);
          for (const b of boards) {
            const tasks = await yougileGetTasks({ boardId: b.id });
            allYgTasks.push(...tasks);
          }
        }
      }
      let created = 0;
      let updated = 0;
      const yougileIdToEmail = new Map<string, string>();
      for (const u of ygUsers) {
        const email = (u.email || u.username || "").toString().trim().toLowerCase();
        if (email && u.id) yougileIdToEmail.set(u.id, email);
      }
      const crmUsers = await storage.getUsers();
      const emailToCrmUserId = new Map<string, string>();
      for (const u of crmUsers) {
        const email = (u.email || "").toString().trim().toLowerCase();
        if (email && u.id) emailToCrmUserId.set(email, u.id);
      }
      const { yougileGetTaskById } = await import("./yougile");
      for (const yt of allYgTasks) {
        const existing = await storage.getTaskByYougileTaskId(yt.id);
        let ytRes = yt as any;
        if (!Array.isArray(ytRes.tags) || ytRes.tags.length === 0) {
          const full = await yougileGetTaskById(yt.id).catch(() => null);
          if (full && Array.isArray((full as any).tags) && (full as any).tags.length > 0) {
            ytRes = { ...ytRes, tags: (full as any).tags };
          } else if (full && Array.isArray((full as any).tagIds) && (full as any).tagIds.length > 0) {
            ytRes = { ...ytRes, tagIds: (full as any).tagIds };
          }
        }
        const yougileColumnId = ytRes.columnId ?? yt.columnId;
        const status = yougileColumnId || "todo";
        const deadlineMs = typeof ytRes.deadline === "number" ? ytRes.deadline : (ytRes.deadline && typeof ytRes.deadline === "object" && "deadline" in (ytRes.deadline as object)) ? (ytRes.deadline as { deadline?: number }).deadline : undefined;
        const dueDate = deadlineMs ? new Date(deadlineMs) : undefined;
        const assigned = Array.isArray(ytRes.assigned) ? ytRes.assigned as string[] : [];
        let assigneeId: string | undefined;
        for (const ygId of assigned) {
          const email = yougileIdToEmail.get(ygId);
          if (email) {
            const crmId = emailToCrmUserId.get(email);
            if (crmId) {
              assigneeId = crmId;
              break;
            }
          }
        }
        const ytTags = ytRes.tags ?? ytRes.tagIds;
        const tags = Array.isArray(ytTags)
          ? ytTags.map((t: any) => (typeof t === "object" && t !== null && ("id" in t || "name" in t)) ? { id: t.id ?? t.name, name: t.name ?? t.id, color: t.color } : { id: String(t), name: String(t) })
          : undefined;
        const ytSubtasks = (ytRes as any).checklist ?? (ytRes as any).subtasks;
        const subtasks = Array.isArray(ytSubtasks)
          ? ytSubtasks.map((s: any) => ({ id: s.id ?? `st-${Math.random().toString(36).slice(2)}`, title: typeof s === "string" ? s : (s.title ?? s.name ?? ""), completed: !!s.completed }))
          : undefined;
        const payload: any = {
          title: yt.title || "Без названия",
          description: yt.description ?? undefined,
          status,
          priority: "medium",
          creatorId,
          assigneeId,
          dueDate,
          yougileTaskId: yt.id,
          yougileBoardId: yt.boardId ?? undefined,
        };
        if (tags !== undefined) payload.tags = tags;
        if (subtasks !== undefined) payload.subtasks = subtasks;
        if (existing) {
          await storage.updateTask(existing.id, payload);
          updated++;
        } else {
          await storage.createTask(payload as any);
          created++;
        }
      }
      res.json({ success: true, created, updated, total: allYgTasks.length });
    } catch (e: any) {
      const msg = e?.message != null ? String(e.message) : "Ошибка синхронизации YouGile";
      if (!res.headersSent) res.status(500).json({ message: msg });
    }
  });

  // HTTPS: если заданы пути к сертификатам — трафик шифруется (логин/пароль не видны в Wireshark)
  let server: Server;
  const certPath = process.env.SSL_CERT_PATH;
  const keyPath = process.env.SSL_KEY_PATH;
  if (certPath && keyPath) {
    try {
      const key = fsSync.readFileSync(keyPath, "utf8");
      const cert = fsSync.readFileSync(certPath, "utf8");
      server = createHttpsServer({ key, cert }, app);
      console.log("[Security] HTTPS включён — логин и пароль передаются в шифрованном виде");
    } catch (e: any) {
      console.error("[Security] Ошибка загрузки SSL:", e?.message);
      server = createHttpServer(app);
    }
  } else {
    server = createHttpServer(app);
    if (process.env.NODE_ENV === "production") {
      console.warn("[Security] Задайте SSL_CERT_PATH и SSL_KEY_PATH в .env для защиты от перехвата логина/пароля.");
    }
  }

  const authorizeRealtimeChannel = async (
    user: any,
    workspace: WorkspaceContext,
    channel: string,
  ) => {
    const parsed = parseRealtimeChannel(channel);
    if (!parsed || !user?.id || !workspace.type || workspace.requiresSelection) return false;

    if (parsed.scope === "company") {
      return workspace.type === "company" &&
        String(workspace.companyId || "") === parsed.recordId;
    }
    if (parsed.scope === "project") {
      const project = await storage.getProjectById(parsed.recordId).catch(() => undefined);
      return Boolean(project && await canAccessProject(user, project));
    }
    if (parsed.scope === "kanban-card") {
      const card = await storage.getKanbanCardById(parsed.recordId).catch(() => undefined);
      if (!card) return false;
      return Boolean(await getKanbanBoardAccess(user, String(card.boardId)).catch(() => null));
    }
    if (parsed.scope === "location") {
      const location = await storage.getCustomLocationById(parsed.recordId).catch(() => undefined);
      return Boolean(location && await canAccessLocation(user, location));
    }
    if (parsed.scope === "equipment") {
      const item = await storage.getEquipmentById(parsed.recordId).catch(() => undefined);
      if (!item || workspace.type !== "company") return false;
      return equipmentCompanyId(item) === String(workspace.companyId || "");
    }
    return false;
  };

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  const rejectWebSocketUpgrade = (socket: any, statusCode: number, statusText: string) => {
    try {
      socket.write(
        `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
    } finally {
      socket.destroy();
    }
  };

  server.on("upgrade", (request, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(request.url || "/", "http://localhost").pathname;
    } catch {
      return rejectWebSocketUpgrade(socket, 400, "Bad Request");
    }
    if (pathname !== "/ws") return;

    const response = new ServerResponse(request);
    sessionMiddleware(request as any, response as any, async (error?: unknown) => {
      if (error) return rejectWebSocketUpgrade(socket, 500, "Internal Server Error");
      const user = await resolveSessionUser((request as any).session?.userId);
      if (!user?.id || user.active === false) {
        return rejectWebSocketUpgrade(socket, 401, "Unauthorized");
      }
      const workspace = await resolveWorkspaceContext(user, (request as any).session);
      (request as any).realtimeWorkspace = workspace;
      (request as any).realtimeUser = {
        ...user,
        activeWorkspaceType: workspace.type,
        activeCompanyId: workspace.companyId,
      };
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });
  });

  wss.on("connection", (ws: WebSocket, request: any) => {
    const user = request.realtimeUser;
    const workspace = request.realtimeWorkspace as WorkspaceContext;
    if (!user?.id) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const context: RealtimeClientContext = {
      user,
      workspace,
      subscriptions: new Set(),
      isAlive: true,
    };
    realtimeClients.set(ws, context);
    ws.send(JSON.stringify({
      type: "connected",
      connectionId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    }));

    ws.on("pong", () => {
      context.isAlive = true;
    });

    ws.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message?.type === "subscribe") {
          const channels = normalizeRealtimeChannels(message.channels);
          const results = [];
          for (const channel of channels) {
            const alreadySubscribed = context.subscriptions.has(channel);
            const withinLimit = alreadySubscribed || context.subscriptions.size < 100;
            const authorized = withinLimit &&
              await authorizeRealtimeChannel(context.user, context.workspace, channel);
            if (authorized) context.subscriptions.add(channel);
            results.push({ channel, authorized });
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "subscription_result", results }));
          }
          return;
        }
        if (message?.type === "unsubscribe") {
          normalizeRealtimeChannels(message.channels).forEach((channel) => {
            context.subscriptions.delete(channel);
          });
        }
      } catch {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "protocol_error", message: "Некорректное realtime-сообщение" }));
        }
      }
    });

    const cleanup = () => {
      context.subscriptions.clear();
      realtimeClients.delete(ws);
    };
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  const globalRealtimeInterval = setInterval(async () => {
    const openSockets = Array.from(realtimeClients.keys()).filter((ws) => ws.readyState === WebSocket.OPEN);
    if (!openSockets.length) return;

    try {
      const messages = [
        { type: "systems_update" },
        { type: "streams_update" },
        { type: "tasks_update" },
        { type: "events_update" },
      ].map((message) => JSON.stringify(message));
      openSockets.forEach((ws) => messages.forEach((message) => ws.send(message)));
    } catch (error) {
      console.warn("[WebSocket] Global refresh failed:", error);
      const fallbackMessages = [
        JSON.stringify({ type: "systems_update" }),
        JSON.stringify({ type: "streams_update" }),
      ];
      openSockets.forEach((ws) => fallbackMessages.forEach((message) => ws.send(message)));
    }
  }, 10_000);
  globalRealtimeInterval.unref?.();

  const realtimePingInterval = setInterval(() => {
    for (const [ws, context] of realtimeClients) {
      if (!context.isAlive) {
        realtimeClients.delete(ws);
        ws.terminate();
        continue;
      }
      context.isAlive = false;
      try {
        ws.ping();
      } catch {
        realtimeClients.delete(ws);
        ws.terminate();
      }
    }
  }, 30_000);
  realtimePingInterval.unref?.();

  server.on("close", () => {
    clearInterval(globalRealtimeInterval);
    clearInterval(realtimePingInterval);
    for (const ws of realtimeClients.keys()) ws.terminate();
    realtimeClients.clear();
    wss.close();
  });

  // Push notification subscription routes
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { endpoint, keys } = req.body;
      // In production, save subscription to database with user ID
      // For now, just acknowledge
      console.log("Push subscription received:", endpoint);
      res.json({ success: true, message: "Subscription saved" });
    } catch (error) {
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      // In production, remove subscription from database
      console.log("Push unsubscription received:", endpoint);
      res.json({ success: true, message: "Subscription removed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  function normalizeEstimateText(value: unknown) {
    return String(value ?? "").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}0-9]+/gu, " ").trim();
  }

  function readEstimatePrice(item: any) {
    const spec = item?.specifications && typeof item.specifications === "object" ? item.specifications : {};
    for (const key of ["estimatePrice", "estimate_price", "estimateUnitPrice", "unitPrice", "price", "cost", "цена", "стоимость"]) {
      const raw = spec[key];
      const value = Number(String(raw ?? "").replace(/\s+/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
      if (Number.isFinite(value) && value > 0) return { value, source: key };
    }
    return { value: 0, source: "" };
  }

  function buildEstimateLine(item: any, quantity: number, reason: string, index: number) {
    const price = readEstimatePrice(item);
    const baseTotal = Math.round(quantity * price.value * 100) / 100;
    const availableQty = item.status === "available" ? 1 : 0;
    return {
      lineId: `auto-${item.id}-${index}`,
      catalogId: item.id,
      equipmentIds: [item.id],
      name: item.name,
      type: item.type || "other",
      model: item.model || "",
      quantity,
      availableQty,
      totalQty: 1,
      unitPrice: price.value,
      baseTotal,
      shiftFactor: 1,
      total: baseTotal,
      priceSource: price.source,
      availability: availableQty >= quantity ? "in_stock" : availableQty > 0 ? "partial" : "unavailable",
      priceStatus: price.value > 0 ? "priced" : "no_price",
      confidence: 0.75,
      reason,
      locations: item.location ? [item.location] : [],
    };
  }

  const estimatePriceGuide = [
    { keys: ["rcf art 315", "акустическая система", "акустика"], name: "Активная акустическая система RCF ART 315 MK4", type: "audio", unitPrice: 1550 },
    { keys: ["shure slxd14", "инструментальная радиосистема"], name: "Инструментальная цифровая радиосистема Shure SLXD14", type: "microphone", unitPrice: 2250 },
    { keys: ["shure ulxd", "вокальная радиосистема"], name: "Вокальная цифровая радиосистема Shure ULXD24/Beta58", type: "microphone", unitPrice: 3060 },
    { keys: ["behringer x32", "x32"], name: "Цифровой микшерный пульт Behringer X32", type: "audio", unitPrice: 4550 },
    { keys: ["behringer wing", "wing"], name: "Цифровой микшерный пульт Behringer WING", type: "audio", unitPrice: 11150 },
    { keys: ["midas dl251", "блок входов выходов"], name: "48-канальный блок входов-выходов Midas DL251", type: "audio", unitPrice: 11150 },
    { keys: ["dlive c2500", "allen heath"], name: "Allen & Heath dLive C2500", type: "audio", unitPrice: 18000 },
    { keys: ["cdm48", "mixrack"], name: "Allen & Heath dLive CDM48 MixRack", type: "audio", unitPrice: 18000 },
    { keys: ["l-acoustics kara", "kara"], name: "Элемент линейного массива L-Acoustics Kara", type: "audio", unitPrice: 4500 },
    { keys: ["l-acoustics sb28", "sb28"], name: "Сабвуфер L-Acoustics SB28", type: "audio", unitPrice: 6000 },
    { keys: ["l-acoustics sb18", "sb18"], name: "Сабвуфер L-Acoustics SB18", type: "audio", unitPrice: 4550 },
    { keys: ["la-rack", "усилением"], name: "Кейс с усилением L-Acoustics LA-rack", type: "audio", unitPrice: 18000 },
    { keys: ["lightsky wash", "wash tx1940"], name: "Интеллектуальный световой прибор LightSky Wash TX1940ZOOM", type: "lighting", unitPrice: 3300 },
    { keys: ["lightsky beam", "beam f230"], name: "Интеллектуальный световой прибор LightSky Beam F230II", type: "lighting", unitPrice: 3300 },
    { keys: ["super scope"], name: "Интеллектуальный световой прибор LightSky Super Scope II", type: "lighting", unitPrice: 5950 },
    { keys: ["sunstrip"], name: "Световой прибор Showtec Sunstrip Active MK2", type: "lighting", unitPrice: 2000 },
    { keys: ["vintage blaze"], name: "Световой прибор Showtec Vintage Blaze 55", type: "lighting", unitPrice: 3500 },
    { keys: ["ma2 command wing"], name: "Контроллер управления Ma2 Command Wing", type: "lighting", unitPrice: 3700 },
    { keys: ["ma2 fader wing"], name: "Контроллер управления Ma2 Fader Wing", type: "lighting", unitPrice: 4450 },
    { keys: ["dmx splitter", "сплиттер dmx"], name: "Сплиттер DMX 512 Signal Distributor", type: "lighting", unitPrice: 600 },
    { keys: ["landmx", "artnet"], name: "Yarilo LanDMX8 / ArtNET to DMX", type: "lighting", unitPrice: 1550 },
    { keys: ["hazer", "хейзер", "генератор тумана"], name: "Генератор тумана / хейзер", type: "effects", unitPrice: 3350 },
    { keys: ["led экран", "светодиодный экран", "p3"], name: "Светодиодный экран LED P3.9, кв. м", type: "display", unitPrice: 5250 },
    { keys: ["novastar vx1000", "vx1000"], name: "Видео процессор NovaStar VX1000", type: "video", unitPrice: 6670 },
    { keys: ["atem mini", "видеомикшер"], name: "Видеомикшер Blackmagic ATEM Mini", type: "video", unitPrice: 3350 },
    { keys: ["avermedia", "видеозахват"], name: "Видеозахват AverMedia Live Gamer Portable 2", type: "video", unitPrice: 2300 },
    { keys: ["resolume", "видеосервер"], name: "Видеосервер Resolume", type: "computer", unitPrice: 15500 },
    { keys: ["sony", "камера"], name: "Камера на штативе Sony", type: "camera", unitPrice: 10000 },
    { keys: ["коммутация видео"], name: "Комплект коммутации видео", type: "cable", unitPrice: 1100 },
    { keys: ["коммутация звук"], name: "Комплект коммутации звук", type: "cable", unitPrice: 1100 },
    { keys: ["коммутация dmx"], name: "Комплект коммутации DMX", type: "cable", unitPrice: 1000 },
    { keys: ["монтаж", "демонтаж"], name: "Монтаж/демонтаж, человеко-смена", type: "labor", unitPrice: 4000 },
    { keys: ["звукорежиссер", "foh"], name: "FOH инженер / звукорежиссер", type: "labor", unitPrice: 14000 },
    { keys: ["инженер видео"], name: "Инженер видео", type: "labor", unitPrice: 14000 },
    { keys: ["оператор свет"], name: "Оператор светового пульта", type: "labor", unitPrice: 10000 },
    { keys: ["грузовой транспорт", "транспорт"], name: "Грузовой транспорт", type: "transport", unitPrice: 6000 },
  ];

  function findEstimateGuidePrice(name: string, type = "") {
    const normalized = normalizeEstimateText(`${name} ${type}`);
    return estimatePriceGuide.find((item) => item.keys.some((key) => normalized.includes(normalizeEstimateText(key))));
  }

  const estimateFallbackPrices: Record<string, number> = {
    audio: 3500,
    microphone: 2500,
    camera: 9000,
    video: 4500,
    computer: 12000,
    display: 6000,
    lighting: 3000,
    network: 2500,
    power: 2000,
    cable: 1200,
    labor: 12000,
    transport: 6000,
    effects: 3500,
    accessory: 1000,
    other: 1500,
  };

  function inferFallbackEstimatePrice(name: string, type = "other") {
    const normalized = normalizeEstimateText(name);
    if (normalized.includes("led") || normalized.includes("светодиод")) return 5250;
    if (normalized.includes("камера")) return 10000;
    if (normalized.includes("микшер") || normalized.includes("пульт")) return 5000;
    if (normalized.includes("инженер") || normalized.includes("режиссер") || normalized.includes("оператор")) return 14000;
    if (normalized.includes("монтаж") || normalized.includes("демонтаж")) return 4000;
    if (normalized.includes("транспорт") || normalized.includes("доставка")) return 6000;
    if (normalized.includes("коммутац") || normalized.includes("кабель")) return 1200;
    return estimateFallbackPrices[type] ?? estimateFallbackPrices.other;
  }

  function inferEstimateProfile(normalized: string) {
    const has = (...keys: string[]) => keys.some((key) => normalized.includes(normalizeEstimateText(key)));
    return {
      conference: has("конференц", "форум", "панель", "спикер", "доклад", "презентац", "зал"),
      stream: has("трансляц", "стрим", "эфир", "запись", "youtube", "vk", "rutube", "онлайн"),
      concert: has("концерт", "сцена", "артист", "группа", "вокал", "dj", "диджей"),
      lighting: has("свет", "сцена", "атмосфер", "подсвет", "концерт", "вечерин"),
      led: has("led", "экран", "светодиод", "презентац", "контент", "видеоэкран"),
      hybrid: has("vks", "zoom", "teams", "гибрид", "удален", "онлайн подключ"),
      large: has("фестиваль", "площад", "улиц", "стадион", "большой зал", "1000", "2000"),
    };
  }

  const estimateProductionBlocks = [
    {
      when: (p: any) => p.conference || p.hybrid,
      items: [
        { name: "Комплект акустики для зала", type: "audio", quantity: 2, reason: "Основная озвучка речи и фонового звука в зале." },
        { name: "Цифровой микшерный пульт", type: "audio", quantity: 1, reason: "Сведение микрофонов, компьютеров, VKS и фоновой музыки." },
        { name: "радиомикрофон ручной", type: "microphone", quantity: 4, reason: "Спикеры, модератор и вопросы из зала." },
        { name: "Петличная радиосистема", type: "microphone", quantity: 2, reason: "Спикеры с презентацией, чтобы руки оставались свободными." },
        { name: "Презентер / кликер", type: "accessory", quantity: 1, reason: "Управление презентацией на сцене." },
      ],
    },
    {
      when: (p: any) => p.stream || p.hybrid,
      items: [
        { name: "Камера на штативе", type: "camera", quantity: 2, reason: "Минимум общий и крупный планы для трансляции/записи." },
        { name: "Видеомикшер / режиссерский пульт", type: "video", quantity: 1, reason: "Переключение камер, презентации и графики в эфир." },
        { name: "Компьютер трансляции / vMix", type: "computer", quantity: 1, reason: "Кодирование эфира, титры, запись и отправка на платформу." },
        { name: "рекордер или резервная запись", type: "video", quantity: 1, reason: "Локальная резервная запись мероприятия." },
        { name: "Монитор режиссера", type: "display", quantity: 1, reason: "Контроль программного сигнала и предпросмотра." },
      ],
    },
    {
      when: (p: any) => p.led,
      items: [
        { name: "LED экран / экран для презентации", type: "display", quantity: 1, reason: "Показ презентаций, заставок, таймера и контента." },
        { name: "Видеопроцессор для экрана", type: "video", quantity: 1, reason: "Корректная подача сигнала и масштабирование на экран." },
        { name: "Ноутбук/медиасервер презентаций", type: "computer", quantity: 1, reason: "Запуск презентаций и медиаконтента." },
      ],
    },
    {
      when: (p: any) => p.lighting || p.concert,
      items: [
        { name: "Световой прибор заливочный", type: "lighting", quantity: 6, reason: "Базовая сценическая заливка и подсветка спикеров/артистов." },
        { name: "Световой пульт / контроллер", type: "lighting", quantity: 1, reason: "Управление сценическим светом." },
        { name: "DMX сплиттер и коммутация", type: "cable", quantity: 1, reason: "разводка управления светом по площадке." },
      ],
    },
    {
      when: (p: any) => p.concert,
      items: [
        { name: "Сабвуфер", type: "audio", quantity: 2, reason: "Низкочастотная поддержка музыкальной программы." },
        { name: "Сценический монитор", type: "audio", quantity: 4, reason: "Мониторинг для артистов на сцене." },
        { name: "Комплект микрофонов для сцены", type: "microphone", quantity: 6, reason: "Вокал, инструменты и запасные каналы." },
      ],
    },
    {
      when: () => true,
      items: [
        { name: "Комплект видео-коммутации", type: "cable", quantity: 1, reason: "SDI/HDMI кабели, переходники и резерв для подключения видео." },
        { name: "Комплект аудио-коммутации", type: "cable", quantity: 1, reason: "XLR, DI-box/переходники и резервные линии для звука." },
        { name: "Комплект силовой коммутации", type: "power", quantity: 1, reason: "Питание оборудования, удлинители, распределение нагрузки." },
        { name: "Сетевой комплект", type: "network", quantity: 1, reason: "LAN/Wi-Fi, резервная сеть и подключение оборудования." },
        { name: "Монтаж/демонтаж, человеко-смена", type: "labor", quantity: 2, reason: "Погрузка, монтаж, настройка и демонтаж оборудования." },
        { name: "Технический руководитель / инженер проекта", type: "labor", quantity: 1, reason: "Ответственный за схему, тайминг, площадку и запуск." },
        { name: "Звукорежиссер", type: "labor", quantity: 1, reason: "Настройка и ведение звука во время мероприятия." },
        { name: "Видеоинженер / режиссер трансляции", type: "labor", quantity: 1, reason: "Контроль камер, сигнала, записи и вывода на экран/эфир." },
        { name: "Грузовой транспорт", type: "transport", quantity: 1, reason: "Доставка оборудования на площадку и обратно." },
      ],
    },
  ];

  function addProductionPlanLines(lines: any[], normalized: string) {
    const profile = inferEstimateProfile(normalized);
    for (const block of estimateProductionBlocks) {
      if (!block.when(profile)) continue;
      for (const item of block.items) {
        const exists = lines.some((line) => {
          const current = normalizeEstimateText(`${line.name} ${line.type}`);
          return current.includes(normalizeEstimateText(item.name).slice(0, 14));
        });
        if (!exists) {
          const guide = findEstimateGuidePrice(item.name, item.type);
          lines.push(buildExternalEstimateLine({ ...item, unitPrice: guide?.unitPrice ?? 0 }, lines.length, item.reason));
        }
      }
    }
  }

  function buildExternalEstimateLine(input: any, index: number, reason: string) {
    const guide = findEstimateGuidePrice(input?.name || "", input?.type || "");
    const quantity = Math.max(1, Math.round(Number(input?.quantity) || 1));
    const unitPrice = Math.max(0, Number(input?.unitPrice ?? guide?.unitPrice ?? inferFallbackEstimatePrice(input?.name || guide?.name || "", input?.type || guide?.type || "other")) || 0);
    const baseTotal = Math.round(quantity * unitPrice * 100) / 100;
    return {
      lineId: `market-${index}-${crypto.randomBytes(3).toString("hex")}`,
      catalogId: "",
      equipmentIds: [],
      name: String(input?.name || guide?.name || "Позиция под подбор").trim(),
      type: String(input?.type || guide?.type || "other").trim(),
      model: String(input?.model || "").trim(),
      quantity,
      availableQty: 0,
      totalQty: 0,
      unitPrice,
      baseTotal,
      shiftFactor: 1,
      total: baseTotal,
      priceSource: guide ? "internal_price_base" : unitPrice > 0 ? "ai_market_estimate" : "",
      availability: "unavailable",
      priceStatus: unitPrice > 0 ? "priced" : "no_price",
      confidence: Math.max(0.45, Math.min(0.9, Number(input?.confidence) || 0.65)),
      reason,
      locations: [],
    };
  }

  async function callHfEstimateAssistant(apiKey: string, title: string, text: string, equipment: any[]) {
    const model = process.env.HF_ESTIMATE_MODEL || process.env.HF_MODEL || "openai/gpt-oss-20b";
    const priceHints = estimatePriceGuide.slice(0, 28).map((item) => `${item.name}: ${item.unitPrice} RUB`).join("\n");
    const warehouseHints = (equipment || []).slice(0, 80).map((item: any) => `${item.name || ""} ${item.model || ""} (${item.type || "other"})`).join("\n");
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a senior Russian technical production estimator for events. Understand the brief, infer what is required to successfully run the event, and return only valid compact JSON. Estimate realistic daily rental/subcontract prices in RUB using your market knowledge and the internal price base. Include audio, video, cameras, screens, lighting, networking, power, signal cables, spare/adapters, labor, transport and reasonable rental/subcontract items. Do not mention sources or example documents in item reasons.",
          },
          {
            role: "user",
            content: `Название: ${title}\nТЗ:\n${text.slice(0, 12000)}\n\nДоступный склад:\n${warehouseHints}\n\nВнутренняя база примерных рыночных цен, не упоминать клиенту:\n${priceHints}\n\nJSON schema: {"items":[{"name":"string","type":"audio|video|camera|lighting|display|network|power|cable|labor|transport|other","model":"string","quantity":1,"unitPrice":0,"reason":"зачем позиция нужна для мероприятия","confidence":0.7}]}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1800,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HF ${response.status}: ${errorText.slice(0, 180)}`);
    }
    const data: any = await response.json();
    const content = String(data?.choices?.[0]?.message?.content || "");
    if (!content.trim()) return [];
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return [];
    }
    return Array.isArray(parsed?.items) ? parsed.items : [];
  }

  async function callOpenAiEstimateAssistant(apiKey: string, title: string, text: string, equipment: any[]) {
    const model = process.env.OPENAI_ESTIMATE_MODEL || process.env.OPENAI_MODEL || "gpt-5.2";
    const priceHints = estimatePriceGuide.slice(0, 36).map((item) => `${item.name}: ${item.unitPrice} RUB`).join("\n");
    const warehouseHints = (equipment || []).slice(0, 120).map((item: any) => `${item.name || ""} ${item.model || ""} (${item.type || "other"})`).join("\n");
    const prompt = `Название: ${title}
ТЗ:
${text.slice(0, 18000)}

Склад:
${warehouseHints}

Внутренняя база ориентировочных дневных цен, клиенту источник не писать:
${priceHints}

Верни только JSON без markdown. Схема:
{"items":[{"name":"string","type":"audio|video|camera|lighting|display|network|power|cable|labor|transport|other","model":"string","quantity":1,"unitPrice":0,"reason":"зачем позиция нужна для мероприятия","confidence":0.7}]}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: "Ты старший технический продюсер и инженер смет по мероприятиям. Пойми ТЗ, добавь всё, что реально нужно для проведения: звук, видео, камеры, экраны, свет, сеть, питание, коммутация, запас, персонал, логистика. Цены ставь реалистичные для дневной аренды/субподряда в RUB. Не упоминай внутренние источники цен.",
          },
          { role: "user", content: prompt },
        ],
        text: { format: { type: "json_object" } },
        reasoning: { effort: "medium" },
        max_output_tokens: 3500,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`OpenAI ${response.status}: ${errorText.slice(0, 180)}`);
    }
    const data: any = await response.json();
    const content = String(
      data?.output_text ||
      data?.output?.flatMap((item: any) => item?.content || []).map((part: any) => part?.text || "").join("") ||
      ""
    );
    if (!content.trim()) return [];
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    try {
      const parsed = JSON.parse(jsonText);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  app.post("/api/estimates/analyze", estimateUpload.single("file"), async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) return res.status(403).json({ message: "Сначала создайте компанию или вступите по приглашению" });
      const title = String(req.body?.title || `Смета ${new Date().toLocaleDateString("ru-RU")}`).trim();
      const bodyText = String(req.body?.text || "");
      const fileText = req.file?.buffer ? req.file.buffer.toString("utf8") : "";
      const text = `${title}\n${bodyText}\n${fileText}`.trim();
      const normalized = normalizeEstimateText(text);
      const equipment = await storage.getEquipment().catch(() => []);
      const lines: any[] = [];
      const used = new Set<string>();
      const needRules = [
        { keys: ["камера", "camera", "съемка"], name: "Камера", type: "camera", quantity: 2 },
        { keys: ["микрофон", "звук", "петлич", "mic"], name: "Микрофон / радиосистема", type: "microphone", quantity: 2 },
        { keys: ["свет", "lighting", "прожектор"], name: "Световой прибор", type: "lighting", quantity: 4 },
        { keys: ["трансляц", "stream", "эфир"], name: "Компьютер трансляции / vMix", type: "computer", quantity: 1 },
        { keys: ["экран", "монитор", "тв", "display"], name: "Экран / монитор", type: "display", quantity: 1 },
        { keys: ["интернет", "сеть", "роутер", "switch", "lan"], name: "Сетевое оборудование", type: "network", quantity: 1 },
        { keys: ["запись", "рекордер"], name: "рекордер", type: "video", quantity: 1 },
        { keys: ["atem", "режиссер", "коммутац"], name: "Видеомикшер", type: "video", quantity: 1 },
      ];
      for (const rule of needRules) {
        if (!rule.keys.some((key) => normalized.includes(normalizeEstimateText(key)))) continue;
        const matches = (equipment as any[])
          .filter((item) => !used.has(item.id))
          .map((item) => ({
            item,
            score:
              (normalizeEstimateText(item.type).includes(rule.type) ? 5 : 0) +
              rule.keys.reduce((sum, key) => sum + (normalizeEstimateText(`${item.name} ${item.model} ${item.type}`).includes(normalizeEstimateText(key)) ? 3 : 0), 0),
          }))
          .filter((row) => row.score > 0)
          .sort((a, b) => b.score - a.score);
        if (matches[0]) {
          used.add(matches[0].item.id);
          lines.push(buildEstimateLine(matches[0].item, rule.quantity, "Найдено на складе по ТЗ", lines.length));
        } else {
          lines.push({
            lineId: `subcontract-${rule.type}-${lines.length}`,
            catalogId: "",
            equipmentIds: [],
            name: rule.name,
            type: rule.type,
            model: "",
            quantity: rule.quantity,
            availableQty: 0,
            totalQty: 0,
            unitPrice: 0,
            baseTotal: 0,
            shiftFactor: 1,
            total: 0,
            priceSource: "",
            availability: "unavailable",
            priceStatus: "no_price",
            confidence: 0.7,
            reason: "Может понадобиться по ТЗ. На складе не найдено, заложить субподряд/аренду.",
            locations: [],
          });
        }
      }
      addProductionPlanLines(lines, normalized);
      for (const guide of estimatePriceGuide) {
        if (!guide.keys.some((key) => normalized.includes(normalizeEstimateText(key)))) continue;
        const alreadyAdded = lines.some((line) => {
          const lineText = normalizeEstimateText(`${line.name} ${line.type} ${line.model}`);
          return guide.keys.some((key) => lineText.includes(normalizeEstimateText(key)));
        });
        if (!alreadyAdded) {
          lines.push(buildExternalEstimateLine(guide, lines.length, "Может понадобиться по техническому заданию. Если позиции нет на складе, заложить аренду или субподряд."));
        }
      }
      const openAiKey = process.env.OPENAI_API_KEY || "";
      const hfKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "";
      const apiKey = openAiKey || hfKey;
      let aiError = "";
      let aiProvider = "";
      if (apiKey && text.length > 0) {
        try {
          const aiItems = openAiKey
            ? await callOpenAiEstimateAssistant(openAiKey, title, text, equipment as any[])
            : await callHfEstimateAssistant(hfKey, title, text, equipment as any[]);
          aiProvider = openAiKey ? "openai" : "huggingface";
          for (const aiItem of aiItems.slice(0, 40)) {
            const aiName = normalizeEstimateText(`${aiItem?.name || ""} ${aiItem?.model || ""}`);
            if (!aiName) continue;
            const duplicate = lines.some((line) => {
              const lineName = normalizeEstimateText(`${line.name} ${line.model}`);
              return lineName.includes(aiName.slice(0, 14)) || aiName.includes(lineName.slice(0, 14));
            });
            if (!duplicate) {
              lines.push(buildExternalEstimateLine(aiItem, lines.length, `AI-подсказка: ${String(aiItem?.reason || "может понадобиться по ТЗ").slice(0, 220)}`));
            }
          }
        } catch (error: any) {
          aiError = error?.message || "AI request failed";
          console.warn("[Estimates] AI assistant failed:", aiError);
        }
      }
      const missing = lines
        .filter((line) => line.availability === "unavailable" || line.equipmentIds.length === 0)
        .map((line) => ({ name: line.name, type: line.type, quantity: line.quantity, reason: line.reason }));
      const subtotal = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
      const warnings = [
        ...(!apiKey ? ["AI ключ не настроен: смета собрана автоматическим анализом ТЗ и внутренней базой цен."] : []),
        ...(aiError ? ["AI не смог дополнить смету, поэтому использован автоматический продакшн-анализ ТЗ."] : []),
        ...(missing.length ? ["Есть позиции, которых может не быть на складе: они добавлены для аренды/субподряда или ручного уточнения цены."] : []),
      ];
      res.json({
        title,
        source: aiProvider ? "ai" : "heuristic",
        summary: lines.length ? "Смета собрана по ТЗ: оборудование, коммутация, персонал, логистика и возможная аренда сведены в одну таблицу." : "По ТЗ не удалось уверенно выделить оборудование. Добавьте формат мероприятия, площадку, аудиторию, трансляцию, звук, свет и экраны.",
        items: lines,
        missing,
        warnings,
        totals: {
          subtotal: Math.round(subtotal * 100) / 100,
          lines: lines.length,
          quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
          missingPrices: lines.filter((line) => !line.unitPrice).length,
          availabilityIssues: lines.filter((line) => line.availability !== "in_stock").length,
        },
        catalogStats: {
          total: equipment.length,
          priced: (equipment as any[]).filter((item) => readEstimatePrice(item).value > 0).length,
          equipmentTotal: equipment.length,
          availableTotal: (equipment as any[]).filter((item) => item.status === "available").length,
        },
        document: req.file ? { name: req.file.originalname, extractedChars: fileText.length } : null,
        shiftCalculation: null,
        aiSchedule: null,
      });
    } catch (error: any) {
      console.error("[Estimates] analyze error:", error);
      res.status(500).json({ message: error?.message || "Не удалось собрать смету" });
    }
  });

  // Connection Schemas API
  app.get("/api/connection-schemas", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) return res.json([]);
      const schemas = await storage.getConnectionSchemas();
      res.json(schemas);
    } catch (error: any) {
      console.error("Connection schemas error:", error);
      res.status(500).json({
        message: error.message || "Failed to fetch connection schemas",
      });
    }
  });

  app.get("/api/connection-schemas/:id", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) return res.status(403).json({ message: "Нет доступа к схемам" });
      const { id } = req.params;
      const schema = await storage.getConnectionSchemaById(id);

      if (!schema) {
        return res.status(404).json({ message: "Schema not found" });
      }

      const components = await storage.getConnectionSchemaComponents(id);
      res.json({ ...schema, components });
    } catch (error: any) {
      console.error("Connection schema error:", error);
      res.status(500).json({
        message: error.message || "Failed to fetch connection schema",
      });
    }
  });

  app.post("/api/connection-schemas", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) {
        return res.status(403).json({ message: "Сначала создайте компанию или вступите по приглашению" });
      }
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const schema = await storage.createConnectionSchema({
        name,
        description: description || null,
      });

      res.json(schema);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error("Create connection schema error:", msg);
      if (error?.stack) console.error(error.stack);
      const errorMessage = msg || "Failed to create connection schema";
      const isDbDown = /ECONNREFUSED|connect|connection refused/i.test(errorMessage) || error?.code === "ECONNREFUSED";
      if (isDbDown) {
        return res.status(500).json({
          message: "Не удалось подключиться к базе данных. Проверьте, что PostgreSQL запущен и DATABASE_URL в .env указан верно.",
        });
      }
      if (errorMessage.includes("does not exist") || errorMessage.includes("relation") || errorMessage.includes("table")) {
        return res.status(500).json({
          message: "Таблицы для схем подключения не созданы. Выполните SQL скрипт create_connection_schemas_tables.sql в вашей базе данных.",
          error: errorMessage,
        });
      }
      res.status(500).json({ message: errorMessage });
    }
  });

  app.put("/api/connection-schemas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const updatedSchema = await storage.updateConnectionSchema(id, updateData);

      if (!updatedSchema) {
        return res.status(404).json({ message: "Schema not found" });
      }

      res.json(updatedSchema);
    } catch (error: any) {
      console.error("Update connection schema error:", error);
      res.status(500).json({
        message: error.message || "Failed to update connection schema",
      });
    }
  });

  app.delete("/api/connection-schemas/:id", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) return res.status(403).json({ message: "Нет доступа к схемам" });
      const { id } = req.params;
      const deleted = await storage.deleteConnectionSchema(id);

      if (!deleted) {
        return res.status(404).json({ message: "Schema not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete connection schema error:", error);
      res.status(500).json({
        message: error.message || "Failed to delete connection schema",
      });
    }
  });

  app.post("/api/connection-schemas/:id/ai-generate", async (req, res) => {
    try {
      if (!(await hasWorkspaceAccess(req.user))) return res.status(403).json({ message: "Нет доступа к схемам" });
      const schema = await storage.getConnectionSchemaById(req.params.id);
      if (!schema) return res.status(404).json({ message: "Схема не найдена" });
      const prompt = String(req.body?.prompt || schema.description || schema.name || "").trim();
      const searchTerms = prompt
        .split(/[,;\n]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 18);
      const fallbackTerms = searchTerms.length ? searchTerms : ["камера", "микрофон", "видеомикшер", "компьютер трансляции", "роутер"];
      const created: any[] = [];
      for (const [index, term] of fallbackTerms.entries()) {
        const fakeReq: any = { body: { query: term } };
        const lower = term.toLowerCase();
        const type =
          /камера|camera/i.test(lower) ? "camera" :
          /микрофон|mic/i.test(lower) ? "mic" :
          /свет|light/i.test(lower) ? "lighting" :
          /router|switch|роутер|сеть|lan/i.test(lower) ? "network" :
          /atem|микшер|коммутатор|switcher/i.test(lower) ? "video" :
          /монитор|экран|display/i.test(lower) ? "display" :
          "computer";
        const portsIn: any[] = [];
        const portsOut: any[] = [];
        const addIn = (name: string, portType = name) => portsIn.push({ id: `in-${portsIn.length + 1}`, name, type: "in", portType });
        const addOut = (name: string, portType = name) => portsOut.push({ id: `out-${portsOut.length + 1}`, name, type: "out", portType });
        if (/atem.*mini/i.test(lower)) {
          [1, 2, 3, 4].forEach((n) => addIn(`HDMI IN ${n}`, "HDMI"));
          addOut("HDMI OUT", "HDMI"); addIn("LAN", "LAN"); addIn("USB-C", "USB");
        } else if (/atem|switcher|видеомикшер|коммутатор/i.test(lower)) {
          [1, 2, 3, 4, 5, 6, 7, 8].forEach((n) => addIn(`SDI IN ${n}`, "SDI"));
          [1, 2, 3, 4].forEach((n) => addOut(`SDI OUT ${n}`, "SDI"));
          addIn("LAN", "LAN");
        } else if (type === "camera") {
          if (/sdi|studio|broadcast/i.test(lower)) addOut("SDI", "SDI");
          addOut("HDMI", "HDMI"); addIn("DC", "DC");
        } else if (type === "network") {
          Array.from({ length: /24/.test(lower) ? 24 : /16/.test(lower) ? 16 : 8 }, (_, i) => addIn(`LAN${i + 1}`, "LAN"));
        } else if (type === "mic") addOut("XLR", "XLR");
        else if (type === "display") { addIn("HDMI 1", "HDMI"); addIn("HDMI 2", "HDMI"); }
        else { addIn("LAN", "LAN"); addOut("HDMI", "HDMI"); }
        const component = await storage.createConnectionSchemaComponent({
          schemaId: schema.id,
          type,
          name: term,
          position: { x: 80 + (index % 3) * 320, y: 90 + Math.floor(index / 3) * 150 },
          properties: { source: "ai-assistant", portsIn, portsOut },
          connections: [],
        } as any);
        created.push(component);
      }
      res.json({ created, aiAvailable: Boolean(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN) });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Не удалось сгенерировать схему" });
    }
  });

  // Connection Schema Components API
  app.post("/api/connection-schemas/:schemaId/components", async (req, res) => {
    try {
      const { schemaId } = req.params;
      const { type, name, position, properties, connections } = req.body;

      if (!type || !name) {
        return res.status(400).json({ message: "Type and name are required" });
      }

      const component = await storage.createConnectionSchemaComponent({
        schemaId,
        type,
        name,
        position: position || { x: 0, y: 0 },
        properties: properties || {},
        connections: connections || [],
      });

      res.json(component);
    } catch (error: any) {
      console.error("Create component error:", error);
      const errorMessage = error.message || "Failed to create component";

      // Проверяем, не является ли ошибка связанной с отсутствием таблицы
      if (errorMessage.includes("does not exist") || errorMessage.includes("relation") || errorMessage.includes("table")) {
        return res.status(500).json({
          message: "Таблицы для схем подключения не созданы. Выполните SQL скрипт create_connection_schemas_tables.sql в вашей базе данных.",
          error: errorMessage,
        });
      }

      res.status(500).json({
        message: errorMessage,
      });
    }
  });

  app.put("/api/connection-schemas/components/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { type, name, position, properties, connections } = req.body;

      const updateData: any = {};
      if (type) updateData.type = type;
      if (name) updateData.name = name;
      if (position) updateData.position = position;
      if (properties) updateData.properties = properties;
      if (connections) updateData.connections = connections;

      const updatedComponent = await storage.updateConnectionSchemaComponent(id, updateData);

      if (!updatedComponent) {
        return res.status(404).json({ message: "Component not found" });
      }

      res.json(updatedComponent);
    } catch (error: any) {
      console.error("Update component error:", error);
      res.status(500).json({
        message: error.message || "Failed to update component",
      });
    }
  });

  app.delete("/api/connection-schemas/components/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteConnectionSchemaComponent(id);

      if (!deleted) {
        return res.status(404).json({ message: "Component not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete component error:", error);
      res.status(500).json({
        message: error.message || "Failed to delete component",
      });
    }
  });

  // Эфир ОТИС — настройки потока
  app.get("/api/otis", async (req, res) => {
    try {
      const settings = await storage.getOtisStreamSettings();
      res.json(settings || { name: "Эфир ОТИС", showTimecode: true, withSound: true });
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error("Get otis settings error:", msg);
      if (error?.stack) console.error(error.stack);
      res.status(500).json({ message: msg || "Failed to get otis settings" });
    }
  });

  app.put("/api/otis", async (req, res) => {
    try {
      const { streamUrl, streamUrlBackup, showTimecode, withSound, name, timecodeSource, vmixHost, vmixPort } = req.body;
      const settings = await storage.upsertOtisStreamSettings({
        name: name ?? "Эфир ОТИС",
        streamUrl: streamUrl ?? undefined,
        streamUrlBackup: streamUrlBackup ?? undefined,
        showTimecode: showTimecode !== false,
        withSound: withSound !== false,
        timecodeSource: timecodeSource ?? "local",
        vmixHost: vmixHost ?? undefined,
        vmixPort: vmixPort != null ? parseInt(String(vmixPort), 10) : undefined,
      });
      res.json(settings);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error("Update otis settings error:", msg);
      if (error?.stack) console.error(error.stack);
      res.status(500).json({ message: msg || "Failed to update otis settings" });
    }
  });

  const getAccessibleEvent = async (
    req: express.Request,
    res: express.Response,
    eventId: string,
  ) => {
    const workspace = await requireActiveWorkspace(req, res);
    if (!workspace) return null;
    const event = await storage.getEventById(eventId);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return null;
    }
    if (!(await canAccessEventInWorkspace(req.user, event, workspace))) {
      res.status(403).json({ message: "Нет доступа к событию" });
      return null;
    }
    return event;
  };

  const canEditEvent = (user: any, event: any) => {
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    return Boolean(
      user?.id &&
      (
        String(event?.organizerId || "") === String(user.id) ||
        permissions.includes("events:edit")
      )
    );
  };

  const requireProductionPhotoWorkspace = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!(await requireActiveWorkspace(req, res))) return;
    next();
  };

  // Продакшн: личные дела участников шоу
  app.post("/api/production/upload-photo", requireProductionPhotoWorkspace, productionPhotoUpload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Файл не выбран" });
      }
      const photoUrl = `/uploads/production/${req.file.filename}`;
      res.json({ url: photoUrl });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Ошибка загрузки" });
    }
  });

  app.get("/api/events/:eventId/participant-profiles", async (req, res) => {
    try {
      const { eventId } = req.params;
      if (!(await getAccessibleEvent(req, res, eventId))) return;
      const profiles = await storage.getShowParticipantProfiles(eventId);
      res.json(profiles);
    } catch (error: any) {
      console.error("Get participant profiles error:", error);
      res.status(500).json({ message: error.message || "Failed to get participant profiles" });
    }
  });

  app.post("/api/events/:eventId/participant-profiles", async (req, res) => {
    try {
      const { eventId } = req.params;
      const event = await getAccessibleEvent(req, res, eventId);
      if (!event) return;
      if (!canEditEvent(req.user, event)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения участников события" });
      }
      const { name, role, photo, bio, contacts, extra, order } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      const profile = await storage.createShowParticipantProfile({
        eventId,
        name,
        role: role ?? undefined,
        photo: photo ?? undefined,
        bio: bio ?? undefined,
        contacts: contacts ?? {},
        extra: extra ?? {},
        order: order ?? 0,
      });
      res.json(profile);
    } catch (error: any) {
      console.error("Create participant profile error:", error);
      res.status(500).json({ message: error.message || "Failed to create participant profile" });
    }
  });

  app.put("/api/participant-profiles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getShowParticipantProfileById(id);
      if (!existing) return res.status(404).json({ message: "Profile not found" });
      const event = await getAccessibleEvent(req, res, existing.eventId);
      if (!event) return;
      if (!canEditEvent(req.user, event)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения участников события" });
      }
      const { name, role, photo, bio, contacts, extra, order } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (photo !== undefined) updateData.photo = photo;
      if (bio !== undefined) updateData.bio = bio;
      if (contacts !== undefined) updateData.contacts = contacts;
      if (extra !== undefined) updateData.extra = extra;
      if (order !== undefined) updateData.order = order;
      const updated = await storage.updateShowParticipantProfile(id, updateData);
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Update participant profile error:", error);
      res.status(500).json({ message: error.message || "Failed to update participant profile" });
    }
  });

  app.delete("/api/participant-profiles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getShowParticipantProfileById(id);
      if (!existing) return res.status(404).json({ message: "Profile not found" });
      const event = await getAccessibleEvent(req, res, existing.eventId);
      if (!event) return;
      if (!canEditEvent(req.user, event)) {
        return res.status(403).json({ message: "Недостаточно прав для изменения участников события" });
      }
      const deleted = await storage.deleteShowParticipantProfile(id);
      if (!deleted) return res.status(404).json({ message: "Profile not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete participant profile error:", error);
      res.status(500).json({ message: error.message || "Failed to delete participant profile" });
    }
  });

  // Продакшн: маркеры по таймкоду
  app.get("/api/events/:eventId/markers", async (req, res) => {
    try {
      const { eventId } = req.params;
      if (!(await getAccessibleEvent(req, res, eventId))) return;
      const markers = await storage.getShowMarkers(eventId);
      res.json(markers);
    } catch (error: any) {
      console.error("Get show markers error:", error);
      res.status(500).json({ message: error.message || "Failed to get markers" });
    }
  });

  app.post("/api/events/:eventId/markers", async (req, res) => {
    try {
      const { eventId } = req.params;
      if (!(await getAccessibleEvent(req, res, eventId))) return;
      const { timecode, type, value, note } = req.body;
      const userId = (req as any).user?.id;
      if (!timecode || !type) {
        return res.status(400).json({ message: "Timecode and type are required" });
      }
      const marker = await storage.createShowMarker({
        eventId,
        timecode: String(timecode),
        type: String(type),
        value: value ? String(value) : undefined,
        note: note ? String(note) : undefined,
        editorId: userId,
      });
      res.json(marker);
    } catch (error: any) {
      console.error("Create show marker error:", error);
      res.status(500).json({ message: error.message || "Failed to create marker" });
    }
  });

  app.put("/api/markers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getShowMarkerById(id);
      if (!existing) return res.status(404).json({ message: "Marker not found" });
      const event = await getAccessibleEvent(req, res, existing.eventId);
      if (!event) return;
      if (
        String(existing.editorId || "") !== String(req.user?.id || "") &&
        !canEditEvent(req.user, event)
      ) {
        return res.status(403).json({ message: "Недостаточно прав для изменения маркера" });
      }
      const { timecode, type, value, note } = req.body;
      const updateData: any = {};
      if (timecode !== undefined) updateData.timecode = timecode;
      if (type !== undefined) updateData.type = type;
      if (value !== undefined) updateData.value = value;
      if (note !== undefined) updateData.note = note;
      const updated = await storage.updateShowMarker(id, updateData);
      if (!updated) return res.status(404).json({ message: "Marker not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Update show marker error:", error);
      res.status(500).json({ message: error.message || "Failed to update marker" });
    }
  });

  app.delete("/api/markers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getShowMarkerById(id);
      if (!existing) return res.status(404).json({ message: "Marker not found" });
      const event = await getAccessibleEvent(req, res, existing.eventId);
      if (!event) return;
      if (
        String(existing.editorId || "") !== String(req.user?.id || "") &&
        !canEditEvent(req.user, event)
      ) {
        return res.status(403).json({ message: "Недостаточно прав для удаления маркера" });
      }
      const deleted = await storage.deleteShowMarker(id);
      if (!deleted) return res.status(404).json({ message: "Marker not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete show marker error:", error);
      res.status(500).json({ message: error.message || "Failed to delete marker" });
    }
  });

  // Equipment search API (for connection schemas)
  app.post("/api/equipment/search", async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }

      // Базовая логика парсинга оборудования из названия
      // В будущем здесь можно интегрировать реальный API поиска
      const queryLower = query.toLowerCase();

      // Определяем тип оборудования
      let type = "computer";
      if (queryLower.includes("камера") || queryLower.includes("camera")) type = "camera";
      else if (queryLower.includes("микрофон") || queryLower.includes("mic")) type = "mic";
      else if (queryLower.includes("микшер") || queryLower.includes("mixer")) type = "audio";
      else if (queryLower.includes("роутер") || queryLower.includes("router") || queryLower.includes("switch")) type = "network";
      else if (queryLower.includes("монитор") || queryLower.includes("monitor") || queryLower.includes("телевизор") || queryLower.includes("tv")) type = "display";

      // Парсим производителя и модель
      const parts = query.split(/\s+/);
      let manufacturer = "";
      let model = "";

      const manufacturers = ["Sony", "Canon", "Panasonic", "Blackmagic", "ATEM", "Elgato", "Behringer", "TP-Link", "D-Link", "LG", "Samsung", "OTIS"];
      for (const part of parts) {
        const found = manufacturers.find(m => part.toLowerCase().includes(m.toLowerCase()));
        if (found) {
          manufacturer = found;
          const modelIndex = parts.indexOf(part);
          if (modelIndex < parts.length - 1) {
            model = parts.slice(modelIndex + 1).join(" ");
          }
          break;
        }
      }

      // Определяем порты на основе типа
      const portsIn: any[] = [];
      const portsOut: any[] = [];

      const addIn = (name: string, portType = name) => portsIn.push({ id: `in-${portsIn.length + 1}`, name, type: "in", portType });
      const addOut = (name: string, portType = name) => portsOut.push({ id: `out-${portsOut.length + 1}`, name, type: "out", portType });
      const addMany = (direction: "in" | "out", prefix: string, count: number, portType: string) => {
        for (let i = 1; i <= count; i += 1) direction === "in" ? addIn(`${prefix}${i}`, portType) : addOut(`${prefix}${i}`, portType);
      };
      const explicitCounts = [
        { re: /(\d+)\s*(x|×)?\s*sdi|sdi\s*(\d+)/i, name: "SDI", type: "SDI" },
        { re: /(\d+)\s*(x|×)?\s*hdmi|hdmi\s*(\d+)/i, name: "HDMI", type: "HDMI" },
        { re: /(\d+)\s*(x|×)?\s*(lan|ethernet|rj45)|(?:lan|ethernet|rj45)\s*(\d+)/i, name: "LAN", type: "LAN" },
        { re: /(\d+)\s*(x|×)?\s*xlr|xlr\s*(\d+)/i, name: "XLR", type: "XLR" },
      ];
      const explicit = explicitCounts.some((rule) => {
        const match = queryLower.match(rule.re);
        const count = Number(match?.[1] || match?.[3] || 0);
        if (!count) return false;
        addMany(type === "camera" || type === "computer" ? "out" : "in", rule.name, Math.min(count, 64), rule.type);
        return true;
      });

      if (/atem.*mini/i.test(queryLower)) {
        addMany("in", "HDMI IN ", 4, "HDMI");
        addOut("HDMI OUT", "HDMI");
        addIn("USB-C", "USB");
        addIn("LAN", "LAN");
        addIn("MIC 1", "3.5mm");
        addIn("MIC 2", "3.5mm");
      } else if (/atem.*(television|studio|constellation|sdi)/i.test(queryLower)) {
        addMany("in", "SDI IN ", 8, "SDI");
        addMany("out", "SDI OUT ", 4, "SDI");
        addIn("LAN", "LAN");
      } else if (type === "camera") {
        if (!explicit) {
          if (/sdi|broadcast|studio|ursa|fx6|fx9|c300|c500|ag-/.test(queryLower)) addOut("SDI", "SDI");
          if (/hdmi|a7|alpha|canon|lumix|gh\d|bmpcc|pocket|zv-/.test(queryLower) || portsOut.length === 0) addOut("HDMI", "HDMI");
        }
        addIn("DC", "DC");
      } else if (type === "computer") {
        if (!explicit) {
          addOut("HDMI", "HDMI");
          addOut("DisplayPort", "DisplayPort");
        }
        addIn("LAN", "LAN");
        addIn("USB", "USB");
      } else if (type === "network") {
        if (!explicit) addMany("in", "LAN", /24/.test(queryLower) ? 24 : /16/.test(queryLower) ? 16 : 8, "LAN");
        addIn("Uplink", "LAN");
        addIn("Power", "DC");
      } else if (type === "display") {
        if (!explicit) {
          addIn("HDMI 1", "HDMI");
          addIn("HDMI 2", "HDMI");
        }
        addIn("USB", "USB");
      } else if (type === "audio" || type === "mic") {
        if (type === "mic") addOut("XLR", "XLR");
        else {
          addMany("in", "XLR IN ", 4, "XLR");
          addMany("out", "XLR OUT ", 2, "XLR");
        }
      }

      const result = {
        name: query.trim(),
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        type,
        portsIn,
        portsOut,
        specifications: {},
      };

      res.json({ results: [result] });
    } catch (error: any) {
      console.error("Equipment search error:", error);
      res.status(500).json({
        message: error.message || "Failed to search equipment",
      });
    }
  });

  return server;
}
