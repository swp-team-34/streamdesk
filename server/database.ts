// Поддержка как локального PostgreSQL, так и Neon
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users, companies, companyMembers, companyInvites, events, equipment, equipmentCategories, warehouseStorageLocations, equipmentComments, systems, streams, notifications, platformSettings, platformIncidents,
  equipmentReservations, equipmentCheckoutRequests, telegramUsers, obsConnections, analyticsEvents,
  eventParticipants, tasks, taskComments, taskHistory, roles,
  computers, projects, projectColumns, projectComments, kanbanBoards, kanbanBoardMembers, kanbanLists, kanbanCards, customLocations, projectLocations, kanbanCardLocations, equipmentContextLinks, locationIssues, locationIssueComments, chatSessions, chatMessages, repositories,
  kanbanLabels, kanbanCardLabels,
  kanbanCardHistory,
  kanbanCardComments,
  kanbanCardAttachments,
  vmixSchedulerEvents, connectionSchemas, connectionSchemaComponents,
  otisStreamSettings, showParticipantProfiles, showMarkers,
  yougileProjects, yougileBoards, yougileColumns, yougileUsers, yougileStringStickerStates,
  type User, type InsertUser,
  type Company, type InsertCompany,
  type CompanyMember, type InsertCompanyMember,
  type CompanyInvite, type InsertCompanyInvite,
  type Event, type InsertEvent,
  type Equipment, type InsertEquipment,
  type EquipmentCategory, type InsertEquipmentCategory,
  type WarehouseStorageLocation, type InsertWarehouseStorageLocation,
  type EquipmentComment, type InsertEquipmentComment,
  type System, type InsertSystem,
  type Stream, type InsertStream,
  type Notification, type InsertNotification,
  type PlatformSetting, type InsertPlatformSetting,
  type PlatformIncident, type InsertPlatformIncident,
  type EquipmentReservation, type InsertEquipmentReservation,
  type EquipmentCheckoutRequest, type InsertEquipmentCheckoutRequest,
  type TelegramUser, type InsertTelegramUser,
  type ObsConnection, type InsertObsConnection,
  type AnalyticsEvent, type InsertAnalyticsEvent,
  type EventParticipant, type InsertEventParticipant,
  type Task, type InsertTask,
  type TaskComment, type InsertTaskComment,
  type TaskHistory, type InsertTaskHistory,
  type Role, type InsertRole,
  type Computer, type InsertComputer,
  type Project, type InsertProject,
  type ProjectColumn, type InsertProjectColumn,
  type ProjectComment, type InsertProjectComment,
  type KanbanBoard, type InsertKanbanBoard,
  type KanbanBoardMember, type InsertKanbanBoardMember,
  type KanbanList, type InsertKanbanList,
  type KanbanCard, type InsertKanbanCard,
  type KanbanLabel, type InsertKanbanLabel,
  type KanbanCardLabel, type InsertKanbanCardLabel,
  type KanbanCardHistory, type InsertKanbanCardHistory,
  type KanbanCardComment, type InsertKanbanCardComment,
  type KanbanCardAttachment, type InsertKanbanCardAttachment,
  type CustomLocation, type InsertCustomLocation,
  type ProjectLocation, type KanbanCardLocation,
  type EquipmentContextLink, type InsertEquipmentContextLink,
  type LocationIssue, type InsertLocationIssue,
  type LocationIssueComment, type InsertLocationIssueComment,
  type ChatSession, type InsertChatSession,
  type ChatMessage, type InsertChatMessage,
  type Repository, type InsertRepository,
  type VmixSchedulerEvent, type InsertVmixSchedulerEvent,
  type ConnectionSchema, type InsertConnectionSchema,
  type ConnectionSchemaComponent, type InsertConnectionSchemaComponent,
  type OtisStreamSettings, type InsertOtisStreamSettings,
  type ShowParticipantProfile, type InsertShowParticipantProfile,
  type ShowMarker, type InsertShowMarker,
  type YougileProject, type YougileBoard, type YougileColumn, type YougileUser, type YougileStringStickerStateRow
} from "@shared/schema";
import { eq, and, gte, lte, sql, or, isNull, inArray } from "drizzle-orm";
import crypto from "crypto";

/** Нормализация URL БД: обрезка пробелов и кавычек из .env */
function normalizeDatabaseUrl(url: string | undefined): string {
  if (url == null || typeof url !== "string") return "";
  const s = url.trim();
  if (s.length === 0) return "";
  const t = s.replace(/^["']|["']$/g, "").trim();
  return t || s;
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

function equipmentOperabilityFallback(status: string | null | undefined): string {
  if (status === "broken") return "broken";
  if (status === "maintenance") return "on_repair";
  return "working";
}

function withEquipmentOperabilityFallback<T extends Equipment | undefined>(item: T): T {
  if (!item) return item;
  return {
    ...item,
    operabilityStatus: item.operabilityStatus || equipmentOperabilityFallback(item.status),
  } as T;
}

// Клиент и db создаются в initDatabase() при успешном подключении
let client: ReturnType<typeof postgres> | null = null;
export let db: ReturnType<typeof drizzle> | null = null;

// По умолчанию — заглушка; после initDatabase() может быть заменена на PostgreSQLStorage
export let storage: IStorage;
export let isStubStorage = true;

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Companies
  getCompanies(): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<Company>): Promise<Company | undefined>;
  getCompanyMembers(companyId: string): Promise<CompanyMember[]>;
  getUserCompanyMemberships(userId: string): Promise<CompanyMember[]>;
  getCompanyMembershipByUser(companyId: string, userId: string): Promise<CompanyMember | undefined>;
  createCompanyMember(member: InsertCompanyMember): Promise<CompanyMember>;
  updateCompanyMember(id: string, member: Partial<CompanyMember>): Promise<CompanyMember | undefined>;
  getCompanyInviteByToken(token: string): Promise<CompanyInvite | undefined>;
  getCompanyInvites(companyId: string): Promise<CompanyInvite[]>;
  createCompanyInvite(invite: InsertCompanyInvite): Promise<CompanyInvite>;
  updateCompanyInvite(id: string, invite: Partial<CompanyInvite>): Promise<CompanyInvite | undefined>;
  
  // Event Participants
  getEventParticipants(eventId: string): Promise<EventParticipant[]>;
  createEventParticipant(participant: InsertEventParticipant): Promise<EventParticipant>;
  updateEventParticipant(id: string, data: { status: string }): Promise<EventParticipant | undefined>;
  deleteEventParticipant(eventId: string, userId: string): Promise<boolean>;
  
  // Events
  getEvents(): Promise<Event[]>;
  getEventById(id: string): Promise<Event | undefined>;
  getEventsByUser(userId: string): Promise<Event[]>;
  getEventsByDateRange(start: Date, end: Date): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Equipment
  getEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | undefined>;
  getEquipmentByStatus(status: string): Promise<Equipment[]>;
  getEquipmentByBarcode(barcode: string): Promise<Equipment | undefined>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equipment: Partial<Equipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: string): Promise<boolean>;
  getEquipmentCategories(companyId: string): Promise<EquipmentCategory[]>;
  getEquipmentCategoryById(id: string): Promise<EquipmentCategory | undefined>;
  createEquipmentCategory(category: InsertEquipmentCategory): Promise<EquipmentCategory>;
  updateEquipmentCategory(id: string, category: Partial<EquipmentCategory>): Promise<EquipmentCategory | undefined>;
  getWarehouseStorageLocations(companyId: string): Promise<WarehouseStorageLocation[]>;
  getWarehouseStorageLocationById(id: string): Promise<WarehouseStorageLocation | undefined>;
  createWarehouseStorageLocation(location: InsertWarehouseStorageLocation): Promise<WarehouseStorageLocation>;
  updateWarehouseStorageLocation(id: string, location: Partial<WarehouseStorageLocation>): Promise<WarehouseStorageLocation | undefined>;
  uploadEquipmentPhoto(equipmentId: string, photoUrl: string): Promise<Equipment | undefined>;
  getEquipmentComments(equipmentId: string): Promise<EquipmentComment[]>;
  getEquipmentCommentsByEquipmentIds(equipmentIds: string[]): Promise<EquipmentComment[]>;
  createEquipmentComment(comment: InsertEquipmentComment): Promise<EquipmentComment>;
  getEquipmentContextLinks(equipmentId?: string): Promise<EquipmentContextLink[]>;
  replaceEquipmentContextLinks(input: {
    equipmentId: string;
    source: "manual" | "checkout";
    checkoutRequestId?: string | null;
    projectId?: string | null;
    kanbanCardIds: string[];
    createdByUserId?: string | null;
  }): Promise<EquipmentContextLink[]>;
  deactivateEquipmentContextLinks(
    equipmentId: string,
    options?: { source?: "manual" | "checkout"; checkoutRequestId?: string | null },
  ): Promise<EquipmentContextLink[]>;
  
  // Systems
  getSystems(): Promise<System[]>;
  getSystemById(id: string): Promise<System | undefined>;
  getSystemsByStatus(status: string): Promise<System[]>;
  createSystem(system: InsertSystem): Promise<System>;
  updateSystem(id: string, system: Partial<System>): Promise<System | undefined>;
  deleteSystem(id: string): Promise<boolean>;
  pingSystem(id: string, status: string): Promise<System | undefined>;
  
  // Streams
  getStreams(): Promise<Stream[]>;
  getActiveStreams(): Promise<Stream[]>;
  getStreamById(id: string): Promise<Stream | undefined>;
  getStreamsByUser(userId: string): Promise<Stream[]>;
  createStream(stream: InsertStream): Promise<Stream>;
  updateStream(id: string, stream: Partial<Stream>): Promise<Stream | undefined>;
  
  // Notifications
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<boolean>;
  markAllNotificationsRead(userId: string): Promise<number>;
  deleteNotification(id: string): Promise<boolean>;

  // Platform settings
  getPlatformSettings(): Promise<PlatformSetting[]>;
  getPlatformSettingByKey(key: string): Promise<PlatformSetting | undefined>;
  upsertPlatformSetting(setting: InsertPlatformSetting): Promise<PlatformSetting>;

  // Platform incidents
  getPlatformIncidents(limit?: number): Promise<PlatformIncident[]>;
  createPlatformIncident(incident: InsertPlatformIncident): Promise<PlatformIncident>;
  updatePlatformIncident(id: string, incident: Partial<PlatformIncident>): Promise<PlatformIncident | undefined>;
  
  // Equipment Reservations
  getEquipmentReservations(): Promise<EquipmentReservation[]>;
  getEquipmentReservationsByEquipment(equipmentId: string): Promise<EquipmentReservation[]>;
  createEquipmentReservation(reservation: InsertEquipmentReservation): Promise<EquipmentReservation>;
  checkEquipmentConflicts(equipmentId: string, startTime: Date, endTime: Date): Promise<EquipmentReservation[]>;
  getEquipmentCheckoutRequests(): Promise<EquipmentCheckoutRequest[]>;
  getEquipmentCheckoutRequestById(id: string): Promise<EquipmentCheckoutRequest | undefined>;
  createEquipmentCheckoutRequest(request: InsertEquipmentCheckoutRequest): Promise<EquipmentCheckoutRequest>;
  updateEquipmentCheckoutRequest(id: string, request: Partial<EquipmentCheckoutRequest>): Promise<EquipmentCheckoutRequest | undefined>;
  
  // Telegram Users
  getTelegramUserByTelegramId(telegramId: string): Promise<TelegramUser | undefined>;
  createTelegramUser(telegramUser: InsertTelegramUser): Promise<TelegramUser>;
  updateTelegramUser(telegramId: string, data: Partial<TelegramUser>): Promise<TelegramUser | undefined>;
  linkTelegramUser(telegramId: string, userId: string): Promise<TelegramUser | undefined>;
  
  // OBS Connections
  getObsConnections(): Promise<ObsConnection[]>;
  createObsConnection(obsConnection: InsertObsConnection): Promise<ObsConnection>;
  updateObsConnection(id: string, obsConnection: Partial<ObsConnection>): Promise<ObsConnection | undefined>;
  deleteObsConnection(id: string): Promise<boolean>;
  
  // Analytics
  createAnalyticsEvent(analyticsEvent: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(entityType?: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]>;
  
  // Tasks
  getTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | undefined>;
  getTaskByYougileTaskId(yougileTaskId: string): Promise<Task | undefined>;
  getTasksByYougileBoardId(yougileBoardId: string): Promise<Task[]>;
  getTasksByAssignee(assigneeId: string): Promise<Task[]>;
  getTasksByCreator(creatorId: string): Promise<Task[]>;
  getTasksByAssigneeOrCreator(userId: string): Promise<Task[]>;
  getTasksByStatus(status: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  
  // Task Comments
  getTaskComments(taskId: string): Promise<TaskComment[]>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  deleteTaskComment(id: string): Promise<boolean>;
  
  // Task History
  getTaskHistory(taskId: string): Promise<TaskHistory[]>;
  createTaskHistory(history: InsertTaskHistory): Promise<TaskHistory>;
  
  // Roles
  getRoles(): Promise<Role[]>;
  getRoleById(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<Role>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  
  // Computers
  getComputers(): Promise<Computer[]>;
  getComputerById(id: string): Promise<Computer | undefined>;
  createComputer(computer: InsertComputer): Promise<Computer>;
  updateComputer(id: string, computer: Partial<Computer>): Promise<Computer | undefined>;
  deleteComputer(id: string): Promise<boolean>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  getProjectLocationLinks(projectId: string): Promise<ProjectLocation[]>;
  getProjectLocationLinksByLocationId(locationId: string): Promise<ProjectLocation[]>;
  setProjectLocations(projectId: string, locationIds: string[]): Promise<ProjectLocation[]>;
  getProjectComments(projectId: string): Promise<ProjectComment[]>;
  createProjectComment(comment: InsertProjectComment): Promise<ProjectComment>;
  updateProjectComment(id: string, comment: Partial<ProjectComment>): Promise<ProjectComment | undefined>;
  
  // Project Columns
  getProjectColumns(projectId: string): Promise<ProjectColumn[]>;
  createProjectColumn(column: InsertProjectColumn): Promise<ProjectColumn>;
  updateProjectColumn(id: string, column: Partial<ProjectColumn>): Promise<ProjectColumn | undefined>;
  deleteProjectColumn(id: string): Promise<boolean>;
  reorderProjectColumns(projectId: string, columnIds: string[]): Promise<void>;

  // Kanban Boards
  getKanbanBoards(): Promise<KanbanBoard[]>;
  getKanbanBoardsByCompanyIds(companyIds: string[]): Promise<KanbanBoard[]>;
  getPersonalKanbanBoardsByUserId(userId: string): Promise<KanbanBoard[]>;
  getKanbanBoardById(id: string): Promise<KanbanBoard | undefined>;
  createKanbanBoard(board: InsertKanbanBoard): Promise<KanbanBoard>;
  updateKanbanBoard(id: string, board: Partial<KanbanBoard>): Promise<KanbanBoard | undefined>;
  deleteKanbanBoard(id: string): Promise<boolean>;
  getKanbanBoardMembers(boardId: string): Promise<KanbanBoardMember[]>;
  getKanbanBoardMembershipsByUser(userId: string): Promise<KanbanBoardMember[]>;
  getKanbanBoardMember(boardId: string, userId: string): Promise<KanbanBoardMember | undefined>;
  createKanbanBoardMember(member: InsertKanbanBoardMember): Promise<KanbanBoardMember>;
  updateKanbanBoardMember(id: string, member: Partial<KanbanBoardMember>): Promise<KanbanBoardMember | undefined>;
  deleteKanbanBoardMember(id: string): Promise<boolean>;
  getKanbanListsByBoardId(boardId: string): Promise<KanbanList[]>;
  getKanbanListById(id: string): Promise<KanbanList | undefined>;
  createKanbanList(list: InsertKanbanList): Promise<KanbanList>;
  updateKanbanList(id: string, list: Partial<KanbanList>): Promise<KanbanList | undefined>;
  reorderKanbanLists(boardId: string, listIds: string[]): Promise<void>;
  deleteKanbanList(id: string): Promise<boolean>;
  getKanbanCardsByBoardId(boardId: string): Promise<KanbanCard[]>;
  getKanbanCardsByListId(listId: string): Promise<KanbanCard[]>;
  getKanbanCardById(id: string): Promise<KanbanCard | undefined>;
  createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard>;
  updateKanbanCard(id: string, card: Partial<KanbanCard>): Promise<KanbanCard | undefined>;
  moveKanbanCard(id: string, targetListId: string, targetPosition: number): Promise<KanbanCard | undefined>;
  deleteKanbanCard(id: string): Promise<boolean>;
  getKanbanCardLocationLinks(cardId: string): Promise<KanbanCardLocation[]>;
  getKanbanCardLocationLinksByLocationId(locationId: string): Promise<KanbanCardLocation[]>;
  setKanbanCardLocations(cardId: string, locationIds: string[]): Promise<KanbanCardLocation[]>;
  getKanbanLabelsByBoardId(boardId: string): Promise<KanbanLabel[]>;
  getKanbanLabelById(id: string): Promise<KanbanLabel | undefined>;
  createKanbanLabel(label: InsertKanbanLabel): Promise<KanbanLabel>;
  updateKanbanLabel(id: string, label: Partial<KanbanLabel>): Promise<KanbanLabel | undefined>;
  deleteKanbanLabel(id: string): Promise<boolean>;
  getKanbanCardLabels(cardId: string): Promise<KanbanCardLabel[]>;
  setKanbanCardLabels(cardId: string, labelIds: string[]): Promise<KanbanCardLabel[]>;
  getKanbanCardHistory(cardId: string): Promise<KanbanCardHistory[]>;
  createKanbanCardHistory(history: InsertKanbanCardHistory): Promise<KanbanCardHistory>;
  getKanbanCardComments(cardId: string): Promise<KanbanCardComment[]>;
  createKanbanCardComment(comment: InsertKanbanCardComment): Promise<KanbanCardComment>;
  updateKanbanCardComment(id: string, comment: Partial<KanbanCardComment>): Promise<KanbanCardComment | undefined>;
  getKanbanCardAttachments(cardId: string): Promise<KanbanCardAttachment[]>;
  createKanbanCardAttachment(attachment: InsertKanbanCardAttachment): Promise<KanbanCardAttachment>;
  deleteKanbanCardAttachment(id: string): Promise<boolean>;
  
  // Custom Locations
  getCustomLocations(): Promise<CustomLocation[]>;
  getCustomLocationById(id: string): Promise<CustomLocation | undefined>;
  createCustomLocation(location: InsertCustomLocation): Promise<CustomLocation>;
  updateCustomLocation(id: string, location: Partial<CustomLocation>): Promise<CustomLocation | undefined>;
  deleteCustomLocation(id: string): Promise<boolean>;
  getLocationIssues(locationId?: string): Promise<LocationIssue[]>;
  getLocationIssueById(id: string): Promise<LocationIssue | undefined>;
  createLocationIssue(issue: InsertLocationIssue): Promise<LocationIssue>;
  updateLocationIssue(id: string, issue: Partial<LocationIssue>): Promise<LocationIssue | undefined>;
  getLocationIssueComments(issueId: string): Promise<LocationIssueComment[]>;
  createLocationIssueComment(comment: InsertLocationIssueComment): Promise<LocationIssueComment>;
  
  // Repositories
  getRepositories(): Promise<Repository[]>;
  getRepositoryById(id: string): Promise<Repository | undefined>;
  createRepository(repository: InsertRepository): Promise<Repository>;
  updateRepository(id: string, repository: Partial<Repository>): Promise<Repository | undefined>;
  deleteRepository(id: string): Promise<boolean>;

  // Chat Sessions
  getChatSessionsByUser(userId: string): Promise<ChatSession[]>;
  getChatSessionById(id: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  updateChatSession(id: string, session: Partial<ChatSession>): Promise<ChatSession | undefined>;
  deleteChatSession(id: string): Promise<boolean>;

  // Chat Messages
  getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessage(id: string): Promise<boolean>;

  // vMix Scheduler Events
  getVmixSchedulerEvents(): Promise<VmixSchedulerEvent[]>;
  getVmixSchedulerEventById(id: string): Promise<VmixSchedulerEvent | undefined>;
  createVmixSchedulerEvent(event: InsertVmixSchedulerEvent): Promise<VmixSchedulerEvent>;
  updateVmixSchedulerEvent(id: string, event: Partial<VmixSchedulerEvent>): Promise<VmixSchedulerEvent | undefined>;
  deleteVmixSchedulerEvent(id: string): Promise<boolean>;

  // Connection Schemas
  getConnectionSchemas(): Promise<ConnectionSchema[]>;
  getConnectionSchemaById(id: string): Promise<ConnectionSchema | undefined>;
  createConnectionSchema(schema: InsertConnectionSchema): Promise<ConnectionSchema>;
  updateConnectionSchema(id: string, schema: Partial<ConnectionSchema>): Promise<ConnectionSchema | undefined>;
  deleteConnectionSchema(id: string): Promise<boolean>;
  getConnectionSchemaComponents(schemaId: string): Promise<ConnectionSchemaComponent[]>;
  getConnectionSchemaComponentById(id: string): Promise<ConnectionSchemaComponent | undefined>;
  createConnectionSchemaComponent(component: InsertConnectionSchemaComponent): Promise<ConnectionSchemaComponent>;
  updateConnectionSchemaComponent(id: string, component: Partial<ConnectionSchemaComponent>): Promise<ConnectionSchemaComponent | undefined>;
  deleteConnectionSchemaComponent(id: string): Promise<boolean>;

  // Otis stream settings
  getOtisStreamSettings(): Promise<OtisStreamSettings | undefined>;
  upsertOtisStreamSettings(settings: InsertOtisStreamSettings): Promise<OtisStreamSettings>;

  // Show participant profiles
  getShowParticipantProfiles(eventId: string): Promise<ShowParticipantProfile[]>;
  getShowParticipantProfileById(id: string): Promise<ShowParticipantProfile | undefined>;
  createShowParticipantProfile(profile: InsertShowParticipantProfile): Promise<ShowParticipantProfile>;
  updateShowParticipantProfile(id: string, data: Partial<ShowParticipantProfile>): Promise<ShowParticipantProfile | undefined>;
  deleteShowParticipantProfile(id: string): Promise<boolean>;

  // Show markers
  getShowMarkers(eventId: string): Promise<ShowMarker[]>;
  getShowMarkerById(id: string): Promise<ShowMarker | undefined>;
  createShowMarker(marker: InsertShowMarker): Promise<ShowMarker>;
  updateShowMarker(id: string, data: Partial<ShowMarker>): Promise<ShowMarker | undefined>;
  deleteShowMarker(id: string): Promise<boolean>;

  // YouGile cache (чтение из БД; запись при синхронизации с API)
  getYougileProjects(): Promise<YougileProject[]>;
  upsertYougileProjects(items: { id: string; title?: string | null }[]): Promise<void>;
  getYougileBoards(projectId?: string): Promise<YougileBoard[]>;
  upsertYougileBoards(items: { id: string; projectId: string; title?: string | null }[]): Promise<void>;
  getYougileColumns(boardId: string): Promise<YougileColumn[]>;
  upsertYougileColumns(items: { id: string; boardId: string; title?: string | null; order?: number; color?: number | null }[]): Promise<void>;
  getYougileUsers(): Promise<YougileUser[]>;
  upsertYougileUsers(items: { id: string; email?: string | null; username?: string | null }[]): Promise<void>;
  getYougileStringStickerStates(boardId: string): Promise<YougileStringStickerStateRow[]>;
  upsertYougileStringStickerStates(boardId: string, items: { id: string; title?: string | null; type?: string | null; order?: number; options?: unknown }[]): Promise<void>;
}

export class PostgreSQLStorage implements IStorage {
  private normalizeCustomLocationStatus(status: unknown): string {
    const allowed = new Set(["available", "occupied", "reserved", "maintenance", "unavailable"]);
    return allowed.has(String(status)) ? String(status) : "available";
  }

  private withCustomLocationFallback(location: CustomLocation): CustomLocation {
    return {
      ...location,
      status: this.normalizeCustomLocationStatus((location as any).status),
      attachments: Array.isArray((location as any).attachments) ? (location as any).attachments : [],
    } as CustomLocation;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db!.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db!.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const result = await db!.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    const result = await db!.insert(users).values({ ...insertUser, id }).returning();
    return result[0];
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    const result = await db!.update(users).set(userData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db!.select().from(users).where(eq(users.active, true)).orderBy(users.name);
  }

  async getAllUsers(): Promise<User[]> {
    return await db!.select().from(users).orderBy(users.createdAt);
  }

  async deleteUser(id: string): Promise<boolean> {
    await db!.update(users).set({ active: false }).where(eq(users.id, id));
    return true;
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return await db!.select().from(companies).orderBy(companies.name);
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const result = await db!.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = crypto.randomUUID();
    const result = await db!.insert(companies).values({ ...insertCompany, id }).returning();
    return result[0];
  }

  async updateCompany(id: string, companyData: Partial<Company>): Promise<Company | undefined> {
    const result = await db!.update(companies).set({ ...companyData, updatedAt: new Date() }).where(eq(companies.id, id)).returning();
    return result[0];
  }

  async getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    return await db!.select().from(companyMembers).where(eq(companyMembers.companyId, companyId)).orderBy(companyMembers.createdAt);
  }

  async getUserCompanyMemberships(userId: string): Promise<CompanyMember[]> {
    return await db!.select().from(companyMembers).where(eq(companyMembers.userId, userId)).orderBy(companyMembers.createdAt);
  }

  async getCompanyMembershipByUser(companyId: string, userId: string): Promise<CompanyMember | undefined> {
    const result = await db!.select().from(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createCompanyMember(insertMember: InsertCompanyMember): Promise<CompanyMember> {
    const id = crypto.randomUUID();
    const result = await db!.insert(companyMembers).values({ ...insertMember, id }).returning();
    return result[0];
  }

  async updateCompanyMember(id: string, memberData: Partial<CompanyMember>): Promise<CompanyMember | undefined> {
    const result = await db!.update(companyMembers).set({ ...memberData, updatedAt: new Date() }).where(eq(companyMembers.id, id)).returning();
    return result[0];
  }

  async getCompanyInviteByToken(token: string): Promise<CompanyInvite | undefined> {
    const result = await db!.select().from(companyInvites).where(eq(companyInvites.token, token)).limit(1);
    return result[0];
  }

  async getCompanyInvites(companyId: string): Promise<CompanyInvite[]> {
    return await db!.select().from(companyInvites).where(eq(companyInvites.companyId, companyId)).orderBy(sql`${companyInvites.createdAt} DESC`);
  }

  async createCompanyInvite(insertInvite: InsertCompanyInvite): Promise<CompanyInvite> {
    const id = crypto.randomUUID();
    const result = await db!.insert(companyInvites).values({ ...insertInvite, id }).returning();
    return result[0];
  }

  async updateCompanyInvite(id: string, inviteData: Partial<CompanyInvite>): Promise<CompanyInvite | undefined> {
    const result = await db!.update(companyInvites).set(inviteData).where(eq(companyInvites.id, id)).returning();
    return result[0];
  }

  // Event Participants
  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    return await db!.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId));
  }

  async createEventParticipant(participant: InsertEventParticipant): Promise<EventParticipant> {
    const id = crypto.randomUUID();
    const result = await db!.insert(eventParticipants).values({ ...participant, id }).returning();
    return result[0];
  }

  async updateEventParticipant(id: string, data: { status: string }): Promise<EventParticipant | undefined> {
    const result = await db!.update(eventParticipants).set(data).where(eq(eventParticipants.id, id)).returning();
    return result[0];
  }

  async deleteEventParticipant(eventId: string, userId: string): Promise<boolean> {
    await db!.delete(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));
    return true;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return await db!.select().from(events).orderBy(events.startTime);
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const result = await db!.select().from(events).where(eq(events.id, id)).limit(1);
    return result[0];
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    return await db!.select().from(events).where(eq(events.organizerId, userId)).orderBy(events.startTime);
  }

  async getEventsByDateRange(start: Date, end: Date): Promise<Event[]> {
    return await db!.select().from(events)
      .where(and(gte(events.startTime, start), lte(events.startTime, end)))
      .orderBy(events.startTime);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = crypto.randomUUID();
    const result = await db!.insert(events).values({ ...insertEvent, id }).returning();
    return result[0];
  }

  async updateEvent(id: string, eventData: Partial<Event>): Promise<Event | undefined> {
    const result = await db!.update(events).set(eventData).where(eq(events.id, id)).returning();
    return result[0];
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db!.delete(events).where(eq(events.id, id)).returning({ id: events.id });
    return result.length > 0;
  }

  // Equipment
  async getEquipment(): Promise<Equipment[]> {
    const rows = await db!.select().from(equipment).orderBy(equipment.name);
    return rows.map((item) => withEquipmentOperabilityFallback(item));
  }

  async getEquipmentById(id: string): Promise<Equipment | undefined> {
    const result = await db!.select().from(equipment).where(eq(equipment.id, id)).limit(1);
    return withEquipmentOperabilityFallback(result[0]);
  }

  async getEquipmentByStatus(status: string): Promise<Equipment[]> {
    const rows = await db!.select().from(equipment).where(eq(equipment.status, status)).orderBy(equipment.name);
    return rows.map((item) => withEquipmentOperabilityFallback(item));
  }

  async getEquipmentByBarcode(barcode: string): Promise<Equipment | undefined> {
    const normalized = String(barcode || "").trim();
    const result = await db!.select().from(equipment).where(or(
      eq(equipment.barcode, normalized),
      eq(equipment.inventoryNumber, normalized),
      eq(equipment.serialNumber, normalized),
    )).limit(1);
    return withEquipmentOperabilityFallback(result[0]);
  }

  async createEquipment(insertEquipment: InsertEquipment): Promise<Equipment> {
    const id = crypto.randomUUID();
    const result = await db!.insert(equipment).values({ ...insertEquipment, id }).returning();
    return withEquipmentOperabilityFallback(result[0]);
  }

  async updateEquipment(id: string, equipmentData: Partial<Equipment>): Promise<Equipment | undefined> {
    const result = await db!.update(equipment).set(equipmentData).where(eq(equipment.id, id)).returning();
    return withEquipmentOperabilityFallback(result[0]);
  }

  async deleteEquipment(id: string): Promise<boolean> {
    return await db!.transaction(async (tx) => {
      await tx.delete(equipmentContextLinks).where(eq(equipmentContextLinks.equipmentId, id));
      await tx.delete(equipmentComments).where(eq(equipmentComments.equipmentId, id));
      const result = await tx.delete(equipment).where(eq(equipment.id, id)).returning({ id: equipment.id });
      return result.length > 0;
    });
  }

  async getEquipmentCategories(companyId: string): Promise<EquipmentCategory[]> {
    return await db!.select().from(equipmentCategories)
      .where(eq(equipmentCategories.companyId, companyId))
      .orderBy(equipmentCategories.position, equipmentCategories.name);
  }

  async getEquipmentCategoryById(id: string): Promise<EquipmentCategory | undefined> {
    const result = await db!.select().from(equipmentCategories)
      .where(eq(equipmentCategories.id, id))
      .limit(1);
    return result[0];
  }

  async createEquipmentCategory(category: InsertEquipmentCategory): Promise<EquipmentCategory> {
    const result = await db!.insert(equipmentCategories)
      .values({ ...category, id: crypto.randomUUID() })
      .returning();
    return result[0];
  }

  async updateEquipmentCategory(
    id: string,
    category: Partial<EquipmentCategory>,
  ): Promise<EquipmentCategory | undefined> {
    const result = await db!.update(equipmentCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(equipmentCategories.id, id))
      .returning();
    return result[0];
  }

  async getWarehouseStorageLocations(companyId: string): Promise<WarehouseStorageLocation[]> {
    return await db!.select().from(warehouseStorageLocations)
      .where(eq(warehouseStorageLocations.companyId, companyId))
      .orderBy(warehouseStorageLocations.position, warehouseStorageLocations.name);
  }

  async getWarehouseStorageLocationById(id: string): Promise<WarehouseStorageLocation | undefined> {
    const result = await db!.select().from(warehouseStorageLocations)
      .where(eq(warehouseStorageLocations.id, id))
      .limit(1);
    return result[0];
  }

  async createWarehouseStorageLocation(
    location: InsertWarehouseStorageLocation,
  ): Promise<WarehouseStorageLocation> {
    const result = await db!.insert(warehouseStorageLocations)
      .values({ ...location, id: crypto.randomUUID() })
      .returning();
    return result[0];
  }

  async updateWarehouseStorageLocation(
    id: string,
    location: Partial<WarehouseStorageLocation>,
  ): Promise<WarehouseStorageLocation | undefined> {
    const result = await db!.update(warehouseStorageLocations)
      .set({ ...location, updatedAt: new Date() })
      .where(eq(warehouseStorageLocations.id, id))
      .returning();
    return result[0];
  }

  async uploadEquipmentPhoto(equipmentId: string, photoUrl: string): Promise<Equipment | undefined> {
    const currentEquipment = await this.getEquipmentById(equipmentId);
    if (!currentEquipment) return undefined;
    
    const currentPhotos = (currentEquipment.photos as string[]) || [];
    const newPhotos = [...currentPhotos, photoUrl];
    
    return await this.updateEquipment(equipmentId, { photos: newPhotos });
  }

  async getEquipmentComments(equipmentId: string): Promise<EquipmentComment[]> {
    return await db!.select().from(equipmentComments)
      .where(eq(equipmentComments.equipmentId, equipmentId))
      .orderBy(equipmentComments.createdAt);
  }

  async getEquipmentCommentsByEquipmentIds(equipmentIds: string[]): Promise<EquipmentComment[]> {
    const uniqueIds = Array.from(new Set(equipmentIds.map(String).filter(Boolean)));
    if (uniqueIds.length === 0) return [];
    return await db!.select().from(equipmentComments)
      .where(inArray(equipmentComments.equipmentId, uniqueIds))
      .orderBy(equipmentComments.createdAt);
  }

  async createEquipmentComment(comment: InsertEquipmentComment): Promise<EquipmentComment> {
    const result = await db!.insert(equipmentComments)
      .values({ ...comment, id: crypto.randomUUID() })
      .returning();
    return result[0];
  }

  async getEquipmentContextLinks(equipmentId?: string): Promise<EquipmentContextLink[]> {
    const query = db!.select().from(equipmentContextLinks)
      .orderBy(sql`${equipmentContextLinks.createdAt} DESC`);
    return equipmentId
      ? await query.where(eq(equipmentContextLinks.equipmentId, equipmentId))
      : await query;
  }

  async replaceEquipmentContextLinks(input: {
    equipmentId: string;
    source: "manual" | "checkout";
    checkoutRequestId?: string | null;
    projectId?: string | null;
    kanbanCardIds: string[];
    createdByUserId?: string | null;
  }): Promise<EquipmentContextLink[]> {
    const checkoutRequestId = input.checkoutRequestId || null;
    const uniqueCardIds = Array.from(new Set(input.kanbanCardIds.map(String).filter(Boolean)));
    return await db!.transaction(async (tx) => {
      await tx.update(equipmentContextLinks)
        .set({ active: false, endedAt: new Date(), updatedAt: new Date() })
        .where(and(
        eq(equipmentContextLinks.equipmentId, input.equipmentId),
        eq(equipmentContextLinks.source, input.source),
        eq(equipmentContextLinks.active, true),
        checkoutRequestId
          ? eq(equipmentContextLinks.checkoutRequestId, checkoutRequestId)
          : isNull(equipmentContextLinks.checkoutRequestId),
        ));
      const rows: InsertEquipmentContextLink[] = uniqueCardIds.length > 0
        ? uniqueCardIds.map((kanbanCardId) => ({
            equipmentId: input.equipmentId,
            projectId: input.projectId || null,
            kanbanCardId,
            source: input.source,
            checkoutRequestId,
            createdByUserId: input.createdByUserId || null,
            active: true,
            endedAt: null,
          }))
        : input.projectId
          ? [{
              equipmentId: input.equipmentId,
              projectId: input.projectId,
              kanbanCardId: null,
              source: input.source,
              checkoutRequestId,
              createdByUserId: input.createdByUserId || null,
              active: true,
              endedAt: null,
            }]
          : [];
      if (rows.length === 0) return [];
      return await tx.insert(equipmentContextLinks)
        .values(rows.map((row) => ({ ...row, id: crypto.randomUUID() })))
        .returning();
    });
  }

  async deactivateEquipmentContextLinks(
    equipmentId: string,
    options: { source?: "manual" | "checkout"; checkoutRequestId?: string | null } = {},
  ): Promise<EquipmentContextLink[]> {
    let condition: any = and(
      eq(equipmentContextLinks.equipmentId, equipmentId),
      eq(equipmentContextLinks.active, true),
    );
    if (options.source) condition = and(condition, eq(equipmentContextLinks.source, options.source));
    if (options.checkoutRequestId !== undefined) {
      condition = and(
        condition,
        options.checkoutRequestId
          ? eq(equipmentContextLinks.checkoutRequestId, options.checkoutRequestId)
          : isNull(equipmentContextLinks.checkoutRequestId),
      );
    }
    return await db!.update(equipmentContextLinks)
      .set({ active: false, endedAt: new Date(), updatedAt: new Date() })
      .where(condition)
      .returning();
  }

  // Systems
  async getSystems(): Promise<System[]> {
    return await db!.select().from(systems).orderBy(systems.name);
  }

  async getSystemById(id: string): Promise<System | undefined> {
    const result = await db!.select().from(systems).where(eq(systems.id, id)).limit(1);
    return result[0];
  }

  async getSystemsByStatus(status: string): Promise<System[]> {
    return await db!.select().from(systems).where(eq(systems.status, status)).orderBy(systems.name);
  }

  async createSystem(insertSystem: InsertSystem): Promise<System> {
    const result = await db!.insert(systems).values(insertSystem).returning();
    return result[0];
  }

  async updateSystem(id: string, systemData: Partial<System>): Promise<System | undefined> {
    const result = await db!.update(systems).set(systemData).where(eq(systems.id, id)).returning();
    return result[0];
  }

  async deleteSystem(id: string): Promise<boolean> {
    const result = await db!.delete(systems).where(eq(systems.id, id)).returning({ id: systems.id });
    return result.length > 0;
  }

  async pingSystem(id: string, status: string): Promise<System | undefined> {
    return await this.updateSystem(id, { status, lastPing: new Date() });
  }

  // Streams
  async getStreams(): Promise<Stream[]> {
    return await db!.select().from(streams).orderBy(streams.createdAt);
  }

  async getActiveStreams(): Promise<Stream[]> {
    return await db!.select().from(streams).where(eq(streams.status, "live")).orderBy(streams.startTime);
  }

  async getStreamById(id: string): Promise<Stream | undefined> {
    const result = await db!.select().from(streams).where(eq(streams.id, id)).limit(1);
    return result[0];
  }

  async getStreamsByUser(userId: string): Promise<Stream[]> {
    return await db!.select().from(streams).where(eq(streams.userId, userId)).orderBy(streams.createdAt);
  }

  async createStream(insertStream: InsertStream): Promise<Stream> {
    const result = await db!.insert(streams).values(insertStream).returning();
    return result[0];
  }

  async updateStream(id: string, streamData: Partial<Stream>): Promise<Stream | undefined> {
    const result = await db!.update(streams).set(streamData).where(eq(streams.id, id)).returning();
    return result[0];
  }

  // Notifications
  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return await db!.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(sql`${notifications.createdAt} DESC`);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const result = await db!.insert(notifications).values(insertNotification).returning();
    return result[0];
  }

  async markNotificationRead(id: string): Promise<boolean> {
    const result = await db!.update(notifications).set({ read: true }).where(eq(notifications.id, id)).returning({ id: notifications.id });
    return result.length > 0;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await db!.update(notifications).set({ read: true }).where(eq(notifications.userId, userId)).returning({ id: notifications.id });
    return result.length;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db!.delete(notifications).where(eq(notifications.id, id)).returning({ id: notifications.id });
    return result.length > 0;
  }

  async getPlatformSettings(): Promise<PlatformSetting[]> {
    return await db!.select().from(platformSettings).orderBy(platformSettings.category, platformSettings.key);
  }

  async getPlatformSettingByKey(key: string): Promise<PlatformSetting | undefined> {
    const result = await db!.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    return result[0];
  }

  async upsertPlatformSetting(setting: InsertPlatformSetting): Promise<PlatformSetting> {
    const existing = await this.getPlatformSettingByKey(setting.key);
    if (existing) {
      const result = await db!
        .update(platformSettings)
        .set({
          category: setting.category,
          value: setting.value,
          description: setting.description,
          updatedBy: setting.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(platformSettings.id, existing.id))
        .returning();
      return result[0];
    }

    const id = crypto.randomUUID();
    const result = await db!.insert(platformSettings).values({ ...setting, id }).returning();
    return result[0];
  }

  async getPlatformIncidents(limit = 100): Promise<PlatformIncident[]> {
    return await db!
      .select()
      .from(platformIncidents)
      .orderBy(sql`${platformIncidents.createdAt} DESC`)
      .limit(limit);
  }

  async createPlatformIncident(incident: InsertPlatformIncident): Promise<PlatformIncident> {
    const id = crypto.randomUUID();
    const result = await db!.insert(platformIncidents).values({ ...incident, id }).returning();
    return result[0];
  }

  async updatePlatformIncident(id: string, incident: Partial<PlatformIncident>): Promise<PlatformIncident | undefined> {
    const result = await db!
      .update(platformIncidents)
      .set({ ...incident, updatedAt: new Date() })
      .where(eq(platformIncidents.id, id))
      .returning();
    return result[0];
  }

  // Equipment Reservations
  async getEquipmentReservations(): Promise<EquipmentReservation[]> {
    return await db!.select().from(equipmentReservations).orderBy(equipmentReservations.startTime);
  }

  async getEquipmentReservationsByEquipment(equipmentId: string): Promise<EquipmentReservation[]> {
    return await db!.select().from(equipmentReservations)
      .where(eq(equipmentReservations.equipmentId, equipmentId))
      .orderBy(equipmentReservations.startTime);
  }

  async createEquipmentReservation(insertReservation: InsertEquipmentReservation): Promise<EquipmentReservation> {
    const result = await db!.insert(equipmentReservations).values(insertReservation).returning();
    return result[0];
  }

  async checkEquipmentConflicts(equipmentId: string, startTime: Date, endTime: Date): Promise<EquipmentReservation[]> {
    return await db!.select().from(equipmentReservations)
      .where(
        and(
          eq(equipmentReservations.equipmentId, equipmentId),
          eq(equipmentReservations.status, "active"),
          sql`${equipmentReservations.startTime} < ${endTime}`,
          sql`${equipmentReservations.endTime} > ${startTime}`
        )
      );
  }

  async getEquipmentCheckoutRequests(): Promise<EquipmentCheckoutRequest[]> {
    return await db!
      .select()
      .from(equipmentCheckoutRequests)
      .orderBy(sql`${equipmentCheckoutRequests.createdAt} DESC`);
  }

  async getEquipmentCheckoutRequestById(id: string): Promise<EquipmentCheckoutRequest | undefined> {
    const result = await db!
      .select()
      .from(equipmentCheckoutRequests)
      .where(eq(equipmentCheckoutRequests.id, id))
      .limit(1);
    return result[0];
  }

  async createEquipmentCheckoutRequest(request: InsertEquipmentCheckoutRequest): Promise<EquipmentCheckoutRequest> {
    const id = crypto.randomUUID();
    const result = await db!
      .insert(equipmentCheckoutRequests)
      .values({ ...request, id })
      .returning();
    return result[0];
  }

  async updateEquipmentCheckoutRequest(
    id: string,
    request: Partial<EquipmentCheckoutRequest>,
  ): Promise<EquipmentCheckoutRequest | undefined> {
    const result = await db!
      .update(equipmentCheckoutRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(equipmentCheckoutRequests.id, id))
      .returning();
    return result[0];
  }

  // Telegram Users
  async getTelegramUserByTelegramId(telegramId: string): Promise<TelegramUser | undefined> {
    const result = await db!.select().from(telegramUsers).where(eq(telegramUsers.telegramId, telegramId)).limit(1);
    return result[0];
  }

  async createTelegramUser(insertTelegramUser: InsertTelegramUser): Promise<TelegramUser> {
    const result = await db!.insert(telegramUsers).values(insertTelegramUser).returning();
    return result[0];
  }

  async updateTelegramUser(telegramId: string, data: Partial<TelegramUser>): Promise<TelegramUser | undefined> {
    const result = await db!.update(telegramUsers).set(data).where(eq(telegramUsers.telegramId, telegramId)).returning();
    return result[0];
  }

  async linkTelegramUser(telegramId: string, userId: string): Promise<TelegramUser | undefined> {
    const result = await db!.update(telegramUsers).set({ userId }).where(eq(telegramUsers.telegramId, telegramId)).returning();
    return result[0];
  }

  // OBS Connections
  async getObsConnections(): Promise<ObsConnection[]> {
    return await db!.select().from(obsConnections).orderBy(obsConnections.name);
  }

  async createObsConnection(insertObsConnection: InsertObsConnection): Promise<ObsConnection> {
    const result = await db!.insert(obsConnections).values(insertObsConnection).returning();
    return result[0];
  }

  async updateObsConnection(id: string, obsConnectionData: Partial<ObsConnection>): Promise<ObsConnection | undefined> {
    const result = await db!.update(obsConnections).set(obsConnectionData).where(eq(obsConnections.id, id)).returning();
    return result[0];
  }

  async deleteObsConnection(id: string): Promise<boolean> {
    const result = await db!.delete(obsConnections).where(eq(obsConnections.id, id)).returning({ id: obsConnections.id });
    return result.length > 0;
  }

  // Analytics
  async createAnalyticsEvent(insertAnalyticsEvent: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const result = await db!.insert(analyticsEvents).values(insertAnalyticsEvent).returning();
    return result[0];
  }

  async getAnalyticsEvents(entityType?: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    let query = db!.select().from(analyticsEvents);
    
    const conditions = [];
    if (entityType) {
      conditions.push(eq(analyticsEvents.entityType, entityType));
    }
    if (startDate) {
      conditions.push(gte(analyticsEvents.timestamp, startDate));
    }
    if (endDate) {
      conditions.push(lte(analyticsEvents.timestamp, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(sql`${analyticsEvents.timestamp} DESC`);
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    return await db!.select().from(tasks).orderBy(sql`${tasks.createdAt} DESC`);
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    const result = await db!.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  }

  async getTaskByYougileTaskId(yougileTaskId: string): Promise<Task | undefined> {
    const result = await db!.select().from(tasks).where(eq(tasks.yougileTaskId, yougileTaskId)).limit(1);
    return result[0];
  }

  async getTasksByYougileBoardId(yougileBoardId: string): Promise<Task[]> {
    return await db!.select().from(tasks)
      .where(eq(tasks.yougileBoardId, yougileBoardId))
      .orderBy(sql`${tasks.createdAt} DESC`);
  }

  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return await db!.select().from(tasks)
      .where(eq(tasks.assigneeId, assigneeId))
      .orderBy(sql`${tasks.createdAt} DESC`);
  }

  async getTasksByCreator(creatorId: string): Promise<Task[]> {
    return await db!.select().from(tasks)
      .where(eq(tasks.creatorId, creatorId))
      .orderBy(sql`${tasks.createdAt} DESC`);
  }

  async getTasksByAssigneeOrCreator(userId: string): Promise<Task[]> {
    return await db!.select().from(tasks)
      .where(or(eq(tasks.assigneeId, userId), eq(tasks.creatorId, userId)))
      .orderBy(sql`${tasks.createdAt} DESC`);
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    return await db!.select().from(tasks)
      .where(eq(tasks.status, status))
      .orderBy(sql`${tasks.createdAt} DESC`);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = crypto.randomUUID();
    const result = await db!.insert(tasks).values({ ...insertTask, id }).returning();
    return result[0];
  }

  async updateTask(id: string, taskData: Partial<Task>): Promise<Task | undefined> {
    const dataWithTimestamp = { ...taskData, updatedAt: new Date() };
    const result = await db!.update(tasks).set(dataWithTimestamp).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db!.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
    return result.length > 0;
  }

  // Task Comments
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return await db!.select().from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt);
  }

  async createTaskComment(insertComment: InsertTaskComment): Promise<TaskComment> {
    const result = await db!.insert(taskComments).values(insertComment).returning();
    return result[0];
  }

  async deleteTaskComment(id: string): Promise<boolean> {
    const result = await db!.delete(taskComments).where(eq(taskComments.id, id)).returning({ id: taskComments.id });
    return result.length > 0;
  }

  // Task History
  async getTaskHistory(taskId: string): Promise<TaskHistory[]> {
    return await db!.select().from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .orderBy(sql`${taskHistory.createdAt} DESC`);
  }

  async createTaskHistory(insertHistory: InsertTaskHistory): Promise<TaskHistory> {
    const result = await db!.insert(taskHistory).values(insertHistory).returning();
    return result[0];
  }

  // Roles
  async getRoles(): Promise<Role[]> {
    return await db!.select().from(roles).orderBy(roles.name);
  }

  async getRoleById(id: string): Promise<Role | undefined> {
    const result = await db!.select().from(roles).where(eq(roles.id, id)).limit(1);
    return result[0];
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const result = await db!.select().from(roles).where(eq(roles.name, name)).limit(1);
    return result[0];
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const result = await db!.insert(roles).values(insertRole).returning();
    return result[0];
  }

  async updateRole(id: string, roleData: Partial<Role>): Promise<Role | undefined> {
    const result = await db!.update(roles).set(roleData).where(eq(roles.id, id)).returning();
    return result[0];
  }

  async deleteRole(id: string): Promise<boolean> {
    const result = await db!.delete(roles).where(eq(roles.id, id)).returning({ id: roles.id });
    return result.length > 0;
  }

  // Computers
  async getComputers(): Promise<Computer[]> {
    return await db!.select().from(computers).orderBy(computers.name);
  }

  async getComputerById(id: string): Promise<Computer | undefined> {
    const result = await db!.select().from(computers).where(eq(computers.id, id)).limit(1);
    return result[0];
  }

  async createComputer(insertComputer: InsertComputer): Promise<Computer> {
    const result = await db!.insert(computers).values(insertComputer).returning();
    return result[0];
  }

  async updateComputer(id: string, computerData: Partial<Computer>): Promise<Computer | undefined> {
    const result = await db!.update(computers).set(computerData).where(eq(computers.id, id)).returning();
    return result[0];
  }

  async deleteComputer(id: string): Promise<boolean> {
    const result = await db!.delete(computers).where(eq(computers.id, id)).returning({ id: computers.id });
    return result.length > 0;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return await db!.select().from(projects).orderBy(sql`${projects.createdAt} DESC`);
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    const result = await db!.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = crypto.randomUUID();
    const result = await db!.insert(projects).values({ ...insertProject, id }).returning();
    return result[0];
  }

  async updateProject(id: string, projectData: Partial<Project>): Promise<Project | undefined> {
    const result = await db!.update(projects).set(projectData).where(eq(projects.id, id)).returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    await db!.update(tasks)
      .set({ projectId: null, projectColumnId: null } as any)
      .where(eq(tasks.projectId, id));
    await db!.delete(projectComments).where(eq(projectComments.projectId, id));
    await db!.delete(projectLocations).where(eq(projectLocations.projectId, id));
    await db!.delete(projectColumns).where(eq(projectColumns.projectId, id));
    const result = await db!.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
    return result.length > 0;
  }

  async getProjectLocationLinks(projectId: string): Promise<ProjectLocation[]> {
    return await db!.select().from(projectLocations)
      .where(eq(projectLocations.projectId, projectId))
      .orderBy(projectLocations.createdAt);
  }

  async getProjectLocationLinksByLocationId(locationId: string): Promise<ProjectLocation[]> {
    return await db!.select().from(projectLocations)
      .where(eq(projectLocations.locationId, locationId))
      .orderBy(projectLocations.createdAt);
  }

  async setProjectLocations(projectId: string, locationIds: string[]): Promise<ProjectLocation[]> {
    const normalizedLocationIds = Array.from(new Set(locationIds.map(String).map((id) => id.trim()).filter(Boolean)));
    return await db!.transaction(async (tx) => {
      await tx.delete(projectLocations).where(eq(projectLocations.projectId, projectId));
      if (!normalizedLocationIds.length) return [];
      return await tx.insert(projectLocations).values(
        normalizedLocationIds.map((locationId) => ({
          id: crypto.randomUUID(),
          projectId,
          locationId,
        })),
      ).onConflictDoNothing().returning();
    });
  }

  async getProjectComments(projectId: string): Promise<ProjectComment[]> {
    return await db!.select().from(projectComments)
      .where(eq(projectComments.projectId, projectId))
      .orderBy(sql`${projectComments.createdAt} ASC`);
  }

  async createProjectComment(insertComment: InsertProjectComment): Promise<ProjectComment> {
    const id = crypto.randomUUID();
    const result = await db!.insert(projectComments).values({ ...insertComment, id }).returning();
    return result[0];
  }

  async updateProjectComment(id: string, commentData: Partial<ProjectComment>): Promise<ProjectComment | undefined> {
    const result = await db!.update(projectComments)
      .set({ ...commentData, updatedAt: new Date() })
      .where(eq(projectComments.id, id))
      .returning();
    return result[0];
  }

  // Project Columns
  async getProjectColumns(projectId: string): Promise<ProjectColumn[]> {
    return await db!.select().from(projectColumns)
      .where(eq(projectColumns.projectId, projectId))
      .orderBy(sql`${projectColumns.order} ASC`);
  }

  async createProjectColumn(insertColumn: InsertProjectColumn): Promise<ProjectColumn> {
    const id = crypto.randomUUID();
    const result = await db!.insert(projectColumns).values({ ...insertColumn, id }).returning();
    return result[0];
  }

  async updateProjectColumn(id: string, columnData: Partial<ProjectColumn>): Promise<ProjectColumn | undefined> {
    const result = await db!.update(projectColumns)
      .set(columnData)
      .where(eq(projectColumns.id, id))
      .returning();
    return result[0];
  }

  async deleteProjectColumn(id: string): Promise<boolean> {
    await db!.update(tasks)
      .set({ projectColumnId: null } as any)
      .where(eq(tasks.projectColumnId, id));
    const result = await db!.delete(projectColumns).where(eq(projectColumns.id, id)).returning({ id: projectColumns.id });
    return result.length > 0;
  }

  async reorderProjectColumns(projectId: string, columnIds: string[]): Promise<void> {
    // Обновляем порядок всех столбцов за один запрос
    await Promise.all(
      columnIds.map((columnId, index) =>
        db!.update(projectColumns)
          .set({ order: index })
          .where(and(
            eq(projectColumns.id, columnId),
            eq(projectColumns.projectId, projectId)
          ))
      )
    );
  }

  // Kanban Boards
  async getKanbanBoards(): Promise<KanbanBoard[]> {
    return await db!.select().from(kanbanBoards).orderBy(sql`${kanbanBoards.createdAt} DESC`);
  }

  async getKanbanBoardsByCompanyIds(companyIds: string[]): Promise<KanbanBoard[]> {
    if (!companyIds.length) return [];
    return await db!.select().from(kanbanBoards)
      .where(inArray(kanbanBoards.companyId, companyIds))
      .orderBy(sql`${kanbanBoards.createdAt} DESC`);
  }

  async getPersonalKanbanBoardsByUserId(userId: string): Promise<KanbanBoard[]> {
    return await db!.select().from(kanbanBoards)
      .where(and(
        isNull(kanbanBoards.companyId),
        eq(kanbanBoards.createdByUserId, userId),
      ))
      .orderBy(sql`${kanbanBoards.createdAt} DESC`);
  }

  async getKanbanBoardById(id: string): Promise<KanbanBoard | undefined> {
    const result = await db!.select().from(kanbanBoards).where(eq(kanbanBoards.id, id)).limit(1);
    return result[0];
  }

  async createKanbanBoard(insertBoard: InsertKanbanBoard): Promise<KanbanBoard> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanBoards).values({ ...insertBoard, id }).returning();
    return result[0];
  }

  async updateKanbanBoard(id: string, boardData: Partial<KanbanBoard>): Promise<KanbanBoard | undefined> {
    const result = await db!.update(kanbanBoards)
      .set({ ...boardData, updatedAt: new Date() })
      .where(eq(kanbanBoards.id, id))
      .returning();
    return result[0];
  }

  async deleteKanbanBoard(id: string): Promise<boolean> {
    const boardCardIdsQuery = db!
      .select({ id: kanbanCards.id })
      .from(kanbanCards)
      .where(eq(kanbanCards.boardId, id));

    await db!.delete(kanbanCardLocations).where(inArray(
      kanbanCardLocations.cardId,
      boardCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardAttachments).where(inArray(
      kanbanCardAttachments.cardId,
      boardCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardComments).where(inArray(
      kanbanCardComments.cardId,
      boardCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardHistory).where(inArray(
      kanbanCardHistory.cardId,
      boardCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardLabels).where(inArray(
      kanbanCardLabels.labelId,
      db!.select({ id: kanbanLabels.id }).from(kanbanLabels).where(eq(kanbanLabels.boardId, id)),
    ) as any);
    await db!.delete(kanbanLabels).where(eq(kanbanLabels.boardId, id));
    await db!.delete(kanbanCards).where(eq(kanbanCards.boardId, id));
    await db!.delete(kanbanLists).where(eq(kanbanLists.boardId, id));
    await db!.delete(kanbanBoardMembers).where(eq(kanbanBoardMembers.boardId, id));
    const result = await db!.delete(kanbanBoards)
      .where(eq(kanbanBoards.id, id))
      .returning({ id: kanbanBoards.id });
    return result.length > 0;
  }

  async getKanbanBoardMembers(boardId: string): Promise<KanbanBoardMember[]> {
    return await db!.select().from(kanbanBoardMembers)
      .where(eq(kanbanBoardMembers.boardId, boardId))
      .orderBy(sql`${kanbanBoardMembers.createdAt} ASC`);
  }

  async getKanbanBoardMembershipsByUser(userId: string): Promise<KanbanBoardMember[]> {
    return await db!.select().from(kanbanBoardMembers)
      .where(eq(kanbanBoardMembers.userId, userId))
      .orderBy(sql`${kanbanBoardMembers.createdAt} ASC`);
  }

  async getKanbanBoardMember(boardId: string, userId: string): Promise<KanbanBoardMember | undefined> {
    const result = await db!.select().from(kanbanBoardMembers)
      .where(and(eq(kanbanBoardMembers.boardId, boardId), eq(kanbanBoardMembers.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createKanbanBoardMember(insertMember: InsertKanbanBoardMember): Promise<KanbanBoardMember> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanBoardMembers).values({ ...insertMember, id }).returning();
    return result[0];
  }

  async updateKanbanBoardMember(id: string, memberData: Partial<KanbanBoardMember>): Promise<KanbanBoardMember | undefined> {
    const result = await db!.update(kanbanBoardMembers)
      .set({ ...memberData, updatedAt: new Date() })
      .where(eq(kanbanBoardMembers.id, id))
      .returning();
    return result[0];
  }

  async deleteKanbanBoardMember(id: string): Promise<boolean> {
    const result = await db!.delete(kanbanBoardMembers)
      .where(eq(kanbanBoardMembers.id, id))
      .returning({ id: kanbanBoardMembers.id });
    return result.length > 0;
  }

  async getKanbanListsByBoardId(boardId: string): Promise<KanbanList[]> {
    return await db!.select().from(kanbanLists)
      .where(eq(kanbanLists.boardId, boardId))
      .orderBy(sql`${kanbanLists.position} ASC, ${kanbanLists.createdAt} ASC`);
  }

  async getKanbanListById(id: string): Promise<KanbanList | undefined> {
    const result = await db!.select().from(kanbanLists).where(eq(kanbanLists.id, id)).limit(1);
    return result[0];
  }

  async createKanbanList(insertList: InsertKanbanList): Promise<KanbanList> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanLists).values({ ...insertList, id }).returning();
    return result[0];
  }

  async updateKanbanList(id: string, listData: Partial<KanbanList>): Promise<KanbanList | undefined> {
    const result = await db!.update(kanbanLists)
      .set({ ...listData, updatedAt: new Date() })
      .where(eq(kanbanLists.id, id))
      .returning();
    return result[0];
  }

  async reorderKanbanLists(boardId: string, listIds: string[]): Promise<void> {
    await Promise.all(
      listIds.map((listId, index) =>
        db!.update(kanbanLists)
          .set({ position: index, updatedAt: new Date() })
          .where(and(
            eq(kanbanLists.id, listId),
            eq(kanbanLists.boardId, boardId),
          ))
      )
    );
  }

  async deleteKanbanList(id: string): Promise<boolean> {
    const listCardIdsQuery = db!
      .select({ id: kanbanCards.id })
      .from(kanbanCards)
      .where(eq(kanbanCards.listId, id));

    await db!.delete(kanbanCardLocations).where(inArray(
      kanbanCardLocations.cardId,
      listCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardAttachments).where(inArray(
      kanbanCardAttachments.cardId,
      listCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardComments).where(inArray(
      kanbanCardComments.cardId,
      listCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardHistory).where(inArray(
      kanbanCardHistory.cardId,
      listCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCardLabels).where(inArray(
      kanbanCardLabels.cardId,
      listCardIdsQuery,
    ) as any);
    await db!.delete(kanbanCards).where(eq(kanbanCards.listId, id));
    const result = await db!.delete(kanbanLists)
      .where(eq(kanbanLists.id, id))
      .returning({ id: kanbanLists.id });
    return result.length > 0;
  }

  async getKanbanCardsByBoardId(boardId: string): Promise<KanbanCard[]> {
    return await db!.select().from(kanbanCards)
      .where(eq(kanbanCards.boardId, boardId))
      .orderBy(sql`${kanbanCards.position} ASC, ${kanbanCards.createdAt} ASC`);
  }

  async getKanbanCardsByListId(listId: string): Promise<KanbanCard[]> {
    return await db!.select().from(kanbanCards)
      .where(eq(kanbanCards.listId, listId))
      .orderBy(sql`${kanbanCards.position} ASC, ${kanbanCards.createdAt} ASC`);
  }

  async getKanbanCardById(id: string): Promise<KanbanCard | undefined> {
    const result = await db!.select().from(kanbanCards).where(eq(kanbanCards.id, id)).limit(1);
    return result[0];
  }

  async createKanbanCard(insertCard: InsertKanbanCard): Promise<KanbanCard> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanCards).values({ ...insertCard, id }).returning();
    return result[0];
  }

  async updateKanbanCard(id: string, cardData: Partial<KanbanCard>): Promise<KanbanCard | undefined> {
    const result = await db!.update(kanbanCards)
      .set({ ...cardData, updatedAt: new Date() })
      .where(eq(kanbanCards.id, id))
      .returning();
    return result[0];
  }

  async moveKanbanCard(id: string, targetListId: string, targetPosition: number): Promise<KanbanCard | undefined> {
    return await db!.transaction(async (tx) => {
      const currentCardResult = await tx.select().from(kanbanCards).where(eq(kanbanCards.id, id)).limit(1);
      const currentCard = currentCardResult[0];
      if (!currentCard) return undefined;

      const currentListId = String(currentCard.listId);
      const normalizedTargetPosition = Math.max(0, Number(targetPosition || 0));
      const targetListCards = await tx
        .select()
        .from(kanbanCards)
        .where(eq(kanbanCards.listId, targetListId))
        .orderBy(sql`${kanbanCards.position} ASC, ${kanbanCards.createdAt} ASC`);

      if (currentListId === String(targetListId)) {
        const reorderedCards = targetListCards.filter((card) => String(card.id) !== String(currentCard.id));
        const insertionIndex = Math.min(normalizedTargetPosition, reorderedCards.length);
        reorderedCards.splice(insertionIndex, 0, currentCard);

        let movedCard: KanbanCard | undefined;
        for (let index = 0; index < reorderedCards.length; index += 1) {
          const card = reorderedCards[index];
          const updatedCardResult = await tx
            .update(kanbanCards)
            .set({ position: index, updatedAt: new Date() })
            .where(eq(kanbanCards.id, card.id))
            .returning();

          if (String(card.id) === String(currentCard.id)) {
            movedCard = updatedCardResult[0];
          }
        }

        return movedCard;
      }

      const sourceListCards = await tx
        .select()
        .from(kanbanCards)
        .where(eq(kanbanCards.listId, currentListId))
        .orderBy(sql`${kanbanCards.position} ASC, ${kanbanCards.createdAt} ASC`);

      const reorderedSourceCards = sourceListCards.filter((card) => String(card.id) !== String(currentCard.id));
      const reorderedTargetCards = targetListCards.filter((card) => String(card.id) !== String(currentCard.id));
      const insertionIndex = Math.min(normalizedTargetPosition, reorderedTargetCards.length);

      reorderedTargetCards.splice(insertionIndex, 0, { ...currentCard, listId: targetListId });

      for (let index = 0; index < reorderedSourceCards.length; index += 1) {
        const card = reorderedSourceCards[index];
        await tx
          .update(kanbanCards)
          .set({ position: index, updatedAt: new Date() })
          .where(eq(kanbanCards.id, card.id));
      }

      let movedCard: KanbanCard | undefined;
      for (let index = 0; index < reorderedTargetCards.length; index += 1) {
        const card = reorderedTargetCards[index];
        const updatedCardResult = await tx
          .update(kanbanCards)
          .set({
            listId: targetListId,
            position: index,
            updatedAt: new Date(),
          })
          .where(eq(kanbanCards.id, card.id))
          .returning();

        if (String(card.id) === String(currentCard.id)) {
          movedCard = updatedCardResult[0];
        }
      }

      return movedCard;
    });
  }

  async deleteKanbanCard(id: string): Promise<boolean> {
    await db!.delete(kanbanCardLocations).where(eq(kanbanCardLocations.cardId, id));
    await db!.delete(kanbanCardAttachments).where(eq(kanbanCardAttachments.cardId, id));
    await db!.delete(kanbanCardComments).where(eq(kanbanCardComments.cardId, id));
    await db!.delete(kanbanCardHistory).where(eq(kanbanCardHistory.cardId, id));
    await db!.delete(kanbanCardLabels).where(eq(kanbanCardLabels.cardId, id));
    const result = await db!.delete(kanbanCards)
      .where(eq(kanbanCards.id, id))
      .returning({ id: kanbanCards.id });
    return result.length > 0;
  }

  async getKanbanCardLocationLinks(cardId: string): Promise<KanbanCardLocation[]> {
    return await db!.select().from(kanbanCardLocations)
      .where(eq(kanbanCardLocations.cardId, cardId))
      .orderBy(kanbanCardLocations.createdAt);
  }

  async getKanbanCardLocationLinksByLocationId(locationId: string): Promise<KanbanCardLocation[]> {
    return await db!.select().from(kanbanCardLocations)
      .where(eq(kanbanCardLocations.locationId, locationId))
      .orderBy(kanbanCardLocations.createdAt);
  }

  async setKanbanCardLocations(cardId: string, locationIds: string[]): Promise<KanbanCardLocation[]> {
    const normalizedLocationIds = Array.from(new Set(locationIds.map(String).map((id) => id.trim()).filter(Boolean)));
    return await db!.transaction(async (tx) => {
      await tx.delete(kanbanCardLocations).where(eq(kanbanCardLocations.cardId, cardId));
      if (!normalizedLocationIds.length) return [];
      return await tx.insert(kanbanCardLocations).values(
        normalizedLocationIds.map((locationId) => ({
          id: crypto.randomUUID(),
          cardId,
          locationId,
        })),
      ).onConflictDoNothing().returning();
    });
  }

  async getKanbanLabelsByBoardId(boardId: string): Promise<KanbanLabel[]> {
    return await db!.select().from(kanbanLabels)
      .where(eq(kanbanLabels.boardId, boardId))
      .orderBy(sql`${kanbanLabels.createdAt} ASC, ${kanbanLabels.name} ASC`);
  }

  async getKanbanLabelById(id: string): Promise<KanbanLabel | undefined> {
    const result = await db!.select().from(kanbanLabels).where(eq(kanbanLabels.id, id)).limit(1);
    return result[0];
  }

  async createKanbanLabel(insertLabel: InsertKanbanLabel): Promise<KanbanLabel> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanLabels).values({ ...insertLabel, id }).returning();
    return result[0];
  }

  async updateKanbanLabel(id: string, labelData: Partial<KanbanLabel>): Promise<KanbanLabel | undefined> {
    const result = await db!.update(kanbanLabels)
      .set({ ...labelData, updatedAt: new Date() })
      .where(eq(kanbanLabels.id, id))
      .returning();
    return result[0];
  }

  async deleteKanbanLabel(id: string): Promise<boolean> {
    await db!.delete(kanbanCardLabels).where(eq(kanbanCardLabels.labelId, id));
    const result = await db!.delete(kanbanLabels)
      .where(eq(kanbanLabels.id, id))
      .returning({ id: kanbanLabels.id });
    return result.length > 0;
  }

  async getKanbanCardLabels(cardId: string): Promise<KanbanCardLabel[]> {
    return await db!.select().from(kanbanCardLabels)
      .where(eq(kanbanCardLabels.cardId, cardId))
      .orderBy(sql`${kanbanCardLabels.createdAt} ASC`);
  }

  async setKanbanCardLabels(cardId: string, labelIds: string[]): Promise<KanbanCardLabel[]> {
    return await db!.transaction(async (tx) => {
      await tx.delete(kanbanCardLabels).where(eq(kanbanCardLabels.cardId, cardId));

      const uniqueLabelIds = Array.from(new Set(labelIds.map(String).filter(Boolean)));
      if (!uniqueLabelIds.length) return [];

      const rows = uniqueLabelIds.map((labelId) => ({
        id: crypto.randomUUID(),
        cardId,
        labelId,
      }));

      return await tx.insert(kanbanCardLabels).values(rows).returning();
    });
  }

  async getKanbanCardHistory(cardId: string): Promise<KanbanCardHistory[]> {
    return await db!.select().from(kanbanCardHistory)
      .where(eq(kanbanCardHistory.cardId, cardId))
      .orderBy(sql`${kanbanCardHistory.createdAt} DESC`);
  }

  async createKanbanCardHistory(insertHistory: InsertKanbanCardHistory): Promise<KanbanCardHistory> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanCardHistory).values({ ...insertHistory, id }).returning();
    return result[0];
  }

  async getKanbanCardComments(cardId: string): Promise<KanbanCardComment[]> {
    return await db!.select().from(kanbanCardComments)
      .where(eq(kanbanCardComments.cardId, cardId))
      .orderBy(sql`${kanbanCardComments.createdAt} ASC`);
  }

  async createKanbanCardComment(insertComment: InsertKanbanCardComment): Promise<KanbanCardComment> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanCardComments).values({ ...insertComment, id }).returning();
    return result[0];
  }

  async updateKanbanCardComment(id: string, commentData: Partial<KanbanCardComment>): Promise<KanbanCardComment | undefined> {
    const result = await db!.update(kanbanCardComments)
      .set({ ...commentData, updatedAt: new Date() })
      .where(eq(kanbanCardComments.id, id))
      .returning();
    return result[0];
  }

  async getKanbanCardAttachments(cardId: string): Promise<KanbanCardAttachment[]> {
    return await db!.select().from(kanbanCardAttachments)
      .where(eq(kanbanCardAttachments.cardId, cardId))
      .orderBy(sql`${kanbanCardAttachments.createdAt} DESC`);
  }

  async createKanbanCardAttachment(insertAttachment: InsertKanbanCardAttachment): Promise<KanbanCardAttachment> {
    const id = crypto.randomUUID();
    const result = await db!.insert(kanbanCardAttachments).values({ ...insertAttachment, id }).returning();
    return result[0];
  }

  async deleteKanbanCardAttachment(id: string): Promise<boolean> {
    const result = await db!.delete(kanbanCardAttachments)
      .where(eq(kanbanCardAttachments.id, id))
      .returning({ id: kanbanCardAttachments.id });
    return result.length > 0;
  }

  // Custom Locations
  async getCustomLocations(): Promise<CustomLocation[]> {
    const rows = await db!.select().from(customLocations).orderBy(customLocations.name);
    return rows.map((location) => this.withCustomLocationFallback(location));
  }

  async getCustomLocationById(id: string): Promise<CustomLocation | undefined> {
    const rows = await db!.select().from(customLocations).where(eq(customLocations.id, id)).limit(1);
    return rows[0] ? this.withCustomLocationFallback(rows[0]) : undefined;
  }

  async createCustomLocation(insertLocation: InsertCustomLocation): Promise<CustomLocation> {
    const result = await db!.insert(customLocations).values({
      ...insertLocation,
      status: this.normalizeCustomLocationStatus((insertLocation as any).status),
      attachments: [],
      updatedAt: new Date(),
    }).returning();
    return this.withCustomLocationFallback(result[0]);
  }

  async updateCustomLocation(id: string, locationData: Partial<CustomLocation>): Promise<CustomLocation | undefined> {
    const updateData: Partial<CustomLocation> = {};
    if (locationData.name !== undefined) updateData.name = String(locationData.name).trim();
    if (locationData.description !== undefined) updateData.description = locationData.description;
    if (locationData.type !== undefined) updateData.type = locationData.type;
    if ((locationData as any).companyId !== undefined) updateData.companyId = (locationData as any).companyId;
    if ((locationData as any).address !== undefined) updateData.address = (locationData as any).address;
    if ((locationData as any).notes !== undefined) updateData.notes = (locationData as any).notes;
    if ((locationData as any).attachments !== undefined) updateData.attachments = (locationData as any).attachments;
    if ((locationData as any).archivedAt !== undefined) updateData.archivedAt = (locationData as any).archivedAt;
    if ((locationData as any).archivedByUserId !== undefined) updateData.archivedByUserId = (locationData as any).archivedByUserId;
    if ((locationData as any).updatedByUserId !== undefined) updateData.updatedByUserId = (locationData as any).updatedByUserId;
    if ((locationData as any).status !== undefined) {
      updateData.status = this.normalizeCustomLocationStatus((locationData as any).status);
    }
    updateData.updatedAt = new Date();

    const result = await db!.update(customLocations)
      .set(updateData)
      .where(eq(customLocations.id, id))
      .returning();
    return result[0] ? this.withCustomLocationFallback(result[0]) : undefined;
  }

  async deleteCustomLocation(id: string): Promise<boolean> {
    const result = await db!.delete(customLocations).where(eq(customLocations.id, id)).returning({ id: customLocations.id });
    return result.length > 0;
  }

  async getLocationIssues(locationId?: string): Promise<LocationIssue[]> {
    const query = db!.select().from(locationIssues).orderBy(sql`${locationIssues.createdAt} DESC`);
    return locationId ? await query.where(eq(locationIssues.locationId, locationId)) : await query;
  }

  async getLocationIssueById(id: string): Promise<LocationIssue | undefined> {
    const result = await db!.select().from(locationIssues).where(eq(locationIssues.id, id)).limit(1);
    return result[0];
  }

  async createLocationIssue(issue: InsertLocationIssue): Promise<LocationIssue> {
    const result = await db!.insert(locationIssues).values({ ...issue, id: crypto.randomUUID() }).returning();
    return result[0];
  }

  async updateLocationIssue(id: string, issue: Partial<LocationIssue>): Promise<LocationIssue | undefined> {
    const result = await db!.update(locationIssues)
      .set({ ...issue, updatedAt: new Date() })
      .where(eq(locationIssues.id, id))
      .returning();
    return result[0];
  }

  async getLocationIssueComments(issueId: string): Promise<LocationIssueComment[]> {
    return await db!.select().from(locationIssueComments)
      .where(eq(locationIssueComments.issueId, issueId))
      .orderBy(locationIssueComments.createdAt);
  }

  async createLocationIssueComment(comment: InsertLocationIssueComment): Promise<LocationIssueComment> {
    const result = await db!.insert(locationIssueComments).values({ ...comment, id: crypto.randomUUID() }).returning();
    return result[0];
  }

  // Repositories
  async getRepositories(): Promise<Repository[]> {
    return await db!.select().from(repositories).orderBy(repositories.name);
  }

  async getRepositoryById(id: string): Promise<Repository | undefined> {
    const result = await db!.select().from(repositories).where(eq(repositories.id, id)).limit(1);
    return result[0];
  }

  async createRepository(insertRepository: InsertRepository): Promise<Repository> {
    const result = await db!.insert(repositories).values(insertRepository).returning();
    return result[0];
  }

  async updateRepository(id: string, repositoryData: Partial<Repository>): Promise<Repository | undefined> {
    const result = await db!.update(repositories)
      .set({ ...repositoryData, updatedAt: new Date() })
      .where(eq(repositories.id, id))
      .returning();
    return result[0];
  }

  async deleteRepository(id: string): Promise<boolean> {
    const result = await db!.delete(repositories).where(eq(repositories.id, id)).returning({ id: repositories.id });
    return result.length > 0;
  }

  // Chat Sessions
  async getChatSessionsByUser(userId: string): Promise<ChatSession[]> {
    return await db!.select().from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(sql`${chatSessions.updatedAt} DESC`);
  }

  async getChatSessionById(id: string): Promise<ChatSession | undefined> {
    const result = await db!.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
    return result[0];
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const result = await db!.insert(chatSessions).values(insertSession).returning();
    return result[0];
  }

  async updateChatSession(id: string, sessionData: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const result = await db!.update(chatSessions)
      .set({ ...sessionData, updatedAt: new Date() })
      .where(eq(chatSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteChatSession(id: string): Promise<boolean> {
    // Сначала удаляем все сообщения
    await db!.delete(chatMessages).where(eq(chatMessages.sessionId, id));
    // Затем удаляем сессию
    const result = await db!.delete(chatSessions).where(eq(chatSessions.id, id)).returning({ id: chatSessions.id });
    return result.length > 0;
  }

  // Chat Messages
  async getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    return await db!.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(sql`${chatMessages.createdAt} ASC`);
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const result = await db!.insert(chatMessages).values(insertMessage).returning();
    // Обновляем время последнего обновления сессии
    await db!.update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, insertMessage.sessionId));
    return result[0];
  }

  async deleteChatMessage(id: string): Promise<boolean> {
    const result = await db!.delete(chatMessages).where(eq(chatMessages.id, id)).returning({ id: chatMessages.id });
    return result.length > 0;
  }

  // vMix Scheduler Events
  async getVmixSchedulerEvents(): Promise<VmixSchedulerEvent[]> {
    return await db!.select().from(vmixSchedulerEvents)
      .orderBy(sql`${vmixSchedulerEvents.startTime} ASC`);
  }

  async getVmixSchedulerEventById(id: string): Promise<VmixSchedulerEvent | undefined> {
    const result = await db!.select().from(vmixSchedulerEvents)
      .where(eq(vmixSchedulerEvents.id, id))
      .limit(1);
    return result[0];
  }

  async createVmixSchedulerEvent(event: InsertVmixSchedulerEvent): Promise<VmixSchedulerEvent> {
    const result = await db!.insert(vmixSchedulerEvents).values(event).returning();
    return result[0];
  }

  async updateVmixSchedulerEvent(id: string, eventData: Partial<VmixSchedulerEvent>): Promise<VmixSchedulerEvent | undefined> {
    const result = await db!.update(vmixSchedulerEvents)
      .set({ ...eventData, updatedAt: new Date() })
      .where(eq(vmixSchedulerEvents.id, id))
      .returning();
    return result[0];
  }

  async deleteVmixSchedulerEvent(id: string): Promise<boolean> {
    const result = await db!.delete(vmixSchedulerEvents)
      .where(eq(vmixSchedulerEvents.id, id))
      .returning({ id: vmixSchedulerEvents.id });
    return result.length > 0;
  }

  // Connection Schemas
  async getConnectionSchemas(): Promise<ConnectionSchema[]> {
    return await db!.select().from(connectionSchemas)
      .orderBy(sql`${connectionSchemas.createdAt} DESC`);
  }

  async getConnectionSchemaById(id: string): Promise<ConnectionSchema | undefined> {
    const result = await db!.select().from(connectionSchemas)
      .where(eq(connectionSchemas.id, id))
      .limit(1);
    return result[0];
  }

  async createConnectionSchema(schema: InsertConnectionSchema): Promise<ConnectionSchema> {
    const result = await db!.insert(connectionSchemas).values(schema).returning();
    return result[0];
  }

  async updateConnectionSchema(id: string, schemaData: Partial<ConnectionSchema>): Promise<ConnectionSchema | undefined> {
    const result = await db!.update(connectionSchemas)
      .set({ ...schemaData, updatedAt: new Date() })
      .where(eq(connectionSchemas.id, id))
      .returning();
    return result[0];
  }

  async deleteConnectionSchema(id: string): Promise<boolean> {
    // Сначала удаляем все компоненты
    await db!.delete(connectionSchemaComponents).where(eq(connectionSchemaComponents.schemaId, id));
    // Затем удаляем схему
    const result = await db!.delete(connectionSchemas)
      .where(eq(connectionSchemas.id, id))
      .returning({ id: connectionSchemas.id });
    return result.length > 0;
  }

  // Connection Schema Components
  async getConnectionSchemaComponents(schemaId: string): Promise<ConnectionSchemaComponent[]> {
    return await db!.select().from(connectionSchemaComponents)
      .where(eq(connectionSchemaComponents.schemaId, schemaId))
      .orderBy(sql`${connectionSchemaComponents.createdAt} ASC`);
  }

  async getConnectionSchemaComponentById(id: string): Promise<ConnectionSchemaComponent | undefined> {
    const result = await db!.select().from(connectionSchemaComponents)
      .where(eq(connectionSchemaComponents.id, id))
      .limit(1);
    return result[0];
  }

  async createConnectionSchemaComponent(component: InsertConnectionSchemaComponent): Promise<ConnectionSchemaComponent> {
    const result = await db!.insert(connectionSchemaComponents).values(component).returning();
    return result[0];
  }

  async updateConnectionSchemaComponent(id: string, componentData: Partial<ConnectionSchemaComponent>): Promise<ConnectionSchemaComponent | undefined> {
    const result = await db!.update(connectionSchemaComponents)
      .set({ ...componentData, updatedAt: new Date() })
      .where(eq(connectionSchemaComponents.id, id))
      .returning();
    return result[0];
  }

  async deleteConnectionSchemaComponent(id: string): Promise<boolean> {
    const result = await db!.delete(connectionSchemaComponents)
      .where(eq(connectionSchemaComponents.id, id))
      .returning({ id: connectionSchemaComponents.id });
    return result.length > 0;
  }

  // Otis stream settings
  async getOtisStreamSettings(): Promise<OtisStreamSettings | undefined> {
    const result = await db!.select().from(otisStreamSettings).limit(1);
    return result[0];
  }

  async upsertOtisStreamSettings(settings: InsertOtisStreamSettings): Promise<OtisStreamSettings> {
    const existing = await this.getOtisStreamSettings();
    if (existing) {
      const [updated] = await db!.update(otisStreamSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(otisStreamSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db!.insert(otisStreamSettings).values(settings).returning();
    return created;
  }

  // Show participant profiles
  async getShowParticipantProfiles(eventId: string): Promise<ShowParticipantProfile[]> {
    return await db!.select().from(showParticipantProfiles)
      .where(eq(showParticipantProfiles.eventId, eventId))
      .orderBy(sql`${showParticipantProfiles.order} ASC NULLS LAST, ${showParticipantProfiles.createdAt} ASC`);
  }

  async getShowParticipantProfileById(id: string): Promise<ShowParticipantProfile | undefined> {
    const [profile] = await db!.select().from(showParticipantProfiles)
      .where(eq(showParticipantProfiles.id, id))
      .limit(1);
    return profile;
  }

  async createShowParticipantProfile(profile: InsertShowParticipantProfile): Promise<ShowParticipantProfile> {
    const [created] = await db!.insert(showParticipantProfiles).values(profile).returning();
    return created;
  }

  async updateShowParticipantProfile(id: string, data: Partial<ShowParticipantProfile>): Promise<ShowParticipantProfile | undefined> {
    const [updated] = await db!.update(showParticipantProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(showParticipantProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteShowParticipantProfile(id: string): Promise<boolean> {
    const result = await db!.delete(showParticipantProfiles).where(eq(showParticipantProfiles.id, id)).returning({ id: showParticipantProfiles.id });
    return result.length > 0;
  }

  // Show markers
  async getShowMarkers(eventId: string): Promise<ShowMarker[]> {
    return await db!.select().from(showMarkers)
      .where(eq(showMarkers.eventId, eventId))
      .orderBy(sql`${showMarkers.timecode} ASC, ${showMarkers.createdAt} ASC`);
  }

  async getShowMarkerById(id: string): Promise<ShowMarker | undefined> {
    const [marker] = await db!.select().from(showMarkers)
      .where(eq(showMarkers.id, id))
      .limit(1);
    return marker;
  }

  async createShowMarker(marker: InsertShowMarker): Promise<ShowMarker> {
    const [created] = await db!.insert(showMarkers).values(marker).returning();
    return created;
  }

  async updateShowMarker(id: string, data: Partial<ShowMarker>): Promise<ShowMarker | undefined> {
    const [updated] = await db!.update(showMarkers).set(data).where(eq(showMarkers.id, id)).returning();
    return updated;
  }

  async deleteShowMarker(id: string): Promise<boolean> {
    const result = await db!.delete(showMarkers).where(eq(showMarkers.id, id)).returning({ id: showMarkers.id });
    return result.length > 0;
  }

  // YouGile cache
  async getYougileProjects(): Promise<YougileProject[]> {
    if (!db) return [];
    return await db.select().from(yougileProjects).orderBy(yougileProjects.title);
  }

  async upsertYougileProjects(items: { id: string; title?: string | null }[]): Promise<void> {
    if (!db || !items.length) return;
    for (const row of items) {
      await db.insert(yougileProjects).values({ id: row.id, title: row.title ?? null }).onConflictDoUpdate({
        target: yougileProjects.id,
        set: { title: row.title ?? null, syncedAt: new Date() },
      });
    }
  }

  async getYougileBoards(projectId?: string): Promise<YougileBoard[]> {
    if (!db) return [];
    if (projectId) {
      return await db.select().from(yougileBoards).where(eq(yougileBoards.projectId, projectId)).orderBy(yougileBoards.title);
    }
    return await db.select().from(yougileBoards).orderBy(yougileBoards.title);
  }

  async upsertYougileBoards(items: { id: string; projectId: string; title?: string | null }[]): Promise<void> {
    if (!db || !items.length) return;
    for (const row of items) {
      await db.insert(yougileBoards).values({ id: row.id, projectId: row.projectId, title: row.title ?? null }).onConflictDoUpdate({
        target: yougileBoards.id,
        set: { projectId: row.projectId, title: row.title ?? null, syncedAt: new Date() },
      });
    }
  }

  async getYougileColumns(boardId: string): Promise<YougileColumn[]> {
    if (!db) return [];
    return await db.select().from(yougileColumns).where(eq(yougileColumns.boardId, boardId)).orderBy(yougileColumns.order, yougileColumns.id);
  }

  async upsertYougileColumns(items: { id: string; boardId: string; title?: string | null; order?: number; color?: number | null }[]): Promise<void> {
    if (!db || !items.length) return;
    for (const row of items) {
      await db.insert(yougileColumns).values({
        id: row.id,
        boardId: row.boardId,
        title: row.title ?? null,
        order: row.order ?? 0,
        color: row.color ?? null,
      }).onConflictDoUpdate({
        target: yougileColumns.id,
        set: { boardId: row.boardId, title: row.title ?? null, order: row.order ?? 0, color: row.color ?? null, syncedAt: new Date() },
      });
    }
  }

  async getYougileUsers(): Promise<YougileUser[]> {
    if (!db) return [];
    return await db.select().from(yougileUsers);
  }

  async upsertYougileUsers(items: { id: string; email?: string | null; username?: string | null }[]): Promise<void> {
    if (!db || !items.length) return;
    for (const row of items) {
      await db.insert(yougileUsers).values({ id: row.id, email: row.email ?? null, username: row.username ?? null }).onConflictDoUpdate({
        target: yougileUsers.id,
        set: { email: row.email ?? null, username: row.username ?? null, syncedAt: new Date() },
      });
    }
  }

  async getYougileStringStickerStates(boardId: string): Promise<YougileStringStickerStateRow[]> {
    if (!db) return [];
    return await db.select().from(yougileStringStickerStates).where(eq(yougileStringStickerStates.boardId, boardId)).orderBy(yougileStringStickerStates.order, yougileStringStickerStates.id);
  }

  async upsertYougileStringStickerStates(boardId: string, items: { id: string; title?: string | null; type?: string | null; order?: number; options?: unknown }[]): Promise<void> {
    if (!db || !items.length) return;
    for (const row of items) {
      await db.insert(yougileStringStickerStates).values({
        id: row.id,
        boardId,
        title: row.title ?? null,
        type: row.type ?? null,
        order: row.order ?? 0,
        options: row.options ?? null,
      }).onConflictDoUpdate({
        target: yougileStringStickerStates.id,
        set: { boardId, title: row.title ?? null, type: row.type ?? null, order: row.order ?? 0, options: row.options ?? null, syncedAt: new Date() },
      });
    }
  }
}

// Заглушка хранилища: работает без БД, данные в памяти (теряются при перезапуске)
class StubStorage implements IStorage {
  private users = new Map<string, User>();
  private companiesMap = new Map<string, Company>();
  private companyMembersMap = new Map<string, CompanyMember>();
  private companyInvitesMap = new Map<string, CompanyInvite>();
  private platformSettingsMap = new Map<string, PlatformSetting>();
  private platformIncidentsMap = new Map<string, PlatformIncident>();
  private equipmentCheckoutRequestsMap = new Map<string, EquipmentCheckoutRequest>();
  private equipmentCommentsMap = new Map<string, EquipmentComment>();
  private equipmentContextLinksMap = new Map<string, EquipmentContextLink>();
  private events = new Map<string, Event>();
  private tasks = new Map<string, Task>();
  private connectionSchemas = new Map<string, ConnectionSchema>();
  private connectionSchemaComponents = new Map<string, ConnectionSchemaComponent>();
  private equipment = new Map<string, Equipment>();
  private equipmentCategoriesMap = new Map<string, EquipmentCategory>();
  private warehouseStorageLocationsMap = new Map<string, WarehouseStorageLocation>();
  private projects = new Map<string, Project>();
  private projectCommentsMap = new Map<string, ProjectComment>();
  private kanbanBoardsMap = new Map<string, KanbanBoard>();
  private kanbanBoardMembersMap = new Map<string, KanbanBoardMember>();
  private kanbanListsMap = new Map<string, KanbanList>();
  private kanbanCardsMap = new Map<string, KanbanCard>();
  private kanbanLabelsMap = new Map<string, KanbanLabel>();
  private kanbanCardLabelsMap = new Map<string, KanbanCardLabel>();
  private kanbanCardHistoryMap = new Map<string, KanbanCardHistory>();
  private kanbanCardCommentsMap = new Map<string, KanbanCardComment>();
  private kanbanCardAttachmentsMap = new Map<string, KanbanCardAttachment>();
  private customLocationsMap = new Map<string, CustomLocation>();
  private projectLocationsMap = new Map<string, ProjectLocation>();
  private kanbanCardLocationsMap = new Map<string, KanbanCardLocation>();
  private locationIssuesMap = new Map<string, LocationIssue>();
  private locationIssueCommentsMap = new Map<string, LocationIssueComment>();
  private computers = new Map<string, Computer>();
  private systems = new Map<string, System>();
  private analytics = new Map<string, AnalyticsEvent>();
  private vmixSchedulerEventsMap = new Map<string, VmixSchedulerEvent>();
  private showParticipantProfilesMap = new Map<string, ShowParticipantProfile>();
  private showMarkersMap = new Map<string, ShowMarker>();
  private otisSettings: OtisStreamSettings | null = null;

  constructor() {
    // Фиксированный id, чтобы после перезапуска сервера клиент (localStorage) всё ещё находил пользователя
    const adminId = "admin-stub-default-id";
    this.users.set(adminId, {
      id: adminId,
      username: "admin",
      password: "replace-with-password",
      name: "Администратор",
      role: "admin",
      active: true,
      email: null,
      phone: null,
      position: null,
      department: null,
      permissions: [],
      telegramId: null,
      avatar: null,
      onboardingCompleted: false,
      workspaceMode: "pending",
      activeWorkspaceType: null,
      activeCompanyId: null,
      lastLogin: null,
      createdAt: new Date(),
    } as User);
    // Тестовые карточки оборудования для локального теста (склад)
    const seedEq: Equipment[] = [
      { id: this.uid(), name: "Sony FX3 Камера", type: "camera", categoryId: null, model: "FX3", serialNumber: "SN001", inventoryNumber: null, barcode: null, status: "available", operabilityStatus: "working", location: "Студия А", locationId: null, manualLocation: null, storageLocation: "Студия А", storageLocationId: null, responsiblePerson: null, responsibleContact: null, assignedTo: null, lastUsed: null, notes: null, photos: [], specifications: { portsIn: [{ id: "1", name: "HDMI", type: "in", portType: "HDMI" }], portsOut: [{ id: "1", name: "HDMI", type: "out", portType: "HDMI" }] }, createdAt: this.now() },
      { id: this.uid(), name: "Микрофон AT2020", type: "microphone", categoryId: null, model: "AT2020", serialNumber: "MIC001", inventoryNumber: null, barcode: null, status: "available", operabilityStatus: "working", location: "Подкаст зона", locationId: null, manualLocation: null, storageLocation: "Подкаст зона", storageLocationId: null, responsiblePerson: null, responsibleContact: null, assignedTo: null, lastUsed: null, notes: null, photos: [], specifications: null, createdAt: this.now() },
      { id: this.uid(), name: "Elgato Key Light", type: "lighting", categoryId: null, model: "Key Light Air", serialNumber: null, inventoryNumber: null, barcode: null, status: "available", operabilityStatus: "working", location: "Студия А", locationId: null, manualLocation: null, storageLocation: "Студия А", storageLocationId: null, responsiblePerson: null, responsibleContact: null, assignedTo: null, lastUsed: null, notes: null, photos: [], specifications: null, createdAt: this.now() },
      { id: this.uid(), name: "MacBook Pro M2", type: "computer", categoryId: null, model: "MacBook Pro 16\"", serialNumber: null, inventoryNumber: null, barcode: null, status: "in-use", operabilityStatus: "working", location: "Мобильная съёмка", locationId: null, manualLocation: null, storageLocation: "Мобильная съёмка", storageLocationId: null, responsiblePerson: null, responsibleContact: null, assignedTo: null, lastUsed: null, notes: null, photos: [], specifications: null, createdAt: this.now() },
      { id: this.uid(), name: "ATEM Mini Pro", type: "other", categoryId: null, model: "ATEM Mini Pro", serialNumber: null, inventoryNumber: null, barcode: null, status: "available", operabilityStatus: "working", location: "Техническая", locationId: null, manualLocation: null, storageLocation: "Техническая", storageLocationId: null, responsiblePerson: null, responsibleContact: null, assignedTo: null, lastUsed: null, notes: null, photos: [], specifications: null, createdAt: this.now() },
    ];
    seedEq.forEach((e) => this.equipment.set(e.id, e));
    // Тестовый проект для локального теста (корзина → проект)
    const defaultProject = { id: this.uid(), name: "Тестовый проект", description: "Для проверки привязки оборудования", status: "planning", createdAt: this.now() } as Project;
    this.projects.set(defaultProject.id, defaultProject);
  }

  private uid() { return crypto.randomUUID(); }
  private now() { return new Date(); }

  async getUsers(): Promise<User[]> { return Array.from(this.users.values()).filter((user) => user.active !== false); }
  async getAllUsers(): Promise<User[]> { return Array.from(this.users.values()); }
  async getUser(id: string): Promise<User | undefined> { return this.users.get(id); }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  async getUserByTelegramId(): Promise<User | undefined> { return undefined; }
  async createUser(data: InsertUser): Promise<User> {
    const id = this.uid();
    const user = { ...data, id, createdAt: this.now() } as User;
    this.users.set(id, user);
    return user;
  }
  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const u = this.users.get(id);
    if (!u) return undefined;
    const updated = { ...u, ...data };
    this.users.set(id, updated);
    return updated;
  }
  async deleteUser(): Promise<boolean> { return true; }

  async getCompanies(): Promise<Company[]> { return Array.from(this.companiesMap.values()); }
  async getCompanyById(id: string): Promise<Company | undefined> { return this.companiesMap.get(id); }
  async createCompany(data: InsertCompany): Promise<Company> {
    const id = this.uid();
    const company = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as Company;
    this.companiesMap.set(id, company);
    return company;
  }
  async updateCompany(id: string, data: Partial<Company>): Promise<Company | undefined> {
    const company = this.companiesMap.get(id);
    if (!company) return undefined;
    const updated = { ...company, ...data, updatedAt: this.now() } as Company;
    this.companiesMap.set(id, updated);
    return updated;
  }
  async getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    return Array.from(this.companyMembersMap.values()).filter((member) => member.companyId === companyId);
  }
  async getUserCompanyMemberships(userId: string): Promise<CompanyMember[]> {
    return Array.from(this.companyMembersMap.values()).filter((member) => member.userId === userId);
  }
  async getCompanyMembershipByUser(companyId: string, userId: string): Promise<CompanyMember | undefined> {
    return Array.from(this.companyMembersMap.values()).find((member) => member.companyId === companyId && member.userId === userId);
  }
  async createCompanyMember(data: InsertCompanyMember): Promise<CompanyMember> {
    const id = this.uid();
    const member = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as CompanyMember;
    this.companyMembersMap.set(id, member);
    return member;
  }
  async updateCompanyMember(id: string, data: Partial<CompanyMember>): Promise<CompanyMember | undefined> {
    const member = this.companyMembersMap.get(id);
    if (!member) return undefined;
    const updated = { ...member, ...data, updatedAt: this.now() } as CompanyMember;
    this.companyMembersMap.set(id, updated);
    return updated;
  }
  async getCompanyInviteByToken(token: string): Promise<CompanyInvite | undefined> {
    return Array.from(this.companyInvitesMap.values()).find((invite) => invite.token === token);
  }
  async getCompanyInvites(companyId: string): Promise<CompanyInvite[]> {
    return Array.from(this.companyInvitesMap.values()).filter((invite) => invite.companyId === companyId);
  }
  async createCompanyInvite(data: InsertCompanyInvite): Promise<CompanyInvite> {
    const id = this.uid();
    const invite = { ...data, id, createdAt: this.now() } as CompanyInvite;
    this.companyInvitesMap.set(id, invite);
    return invite;
  }
  async updateCompanyInvite(id: string, data: Partial<CompanyInvite>): Promise<CompanyInvite | undefined> {
    const invite = this.companyInvitesMap.get(id);
    if (!invite) return undefined;
    const updated = { ...invite, ...data } as CompanyInvite;
    this.companyInvitesMap.set(id, updated);
    return updated;
  }

  async getEventParticipants(): Promise<EventParticipant[]> { return []; }
  async createEventParticipant(data: InsertEventParticipant): Promise<EventParticipant> {
    return { ...data, id: this.uid(), createdAt: this.now() } as EventParticipant;
  }
  async updateEventParticipant(id: string, data: { status: string }): Promise<EventParticipant | undefined> {
    return undefined;
  }
  async deleteEventParticipant(): Promise<boolean> { return true; }

  async getEvents(): Promise<Event[]> { return Array.from(this.events.values()); }
  async getEventById(id: string): Promise<Event | undefined> { return this.events.get(id); }
  async getEventsByUser(): Promise<Event[]> { return Array.from(this.events.values()); }
  async getEventsByDateRange(): Promise<Event[]> { return Array.from(this.events.values()); }
  async createEvent(data: InsertEvent): Promise<Event> {
    const id = this.uid();
    const event = { ...data, id, createdAt: this.now() } as Event;
    this.events.set(id, event);
    return event;
  }
  async updateEvent(id: string, data: Partial<Event>): Promise<Event | undefined> {
    const e = this.events.get(id);
    if (!e) return undefined;
    const updated = { ...e, ...data };
    this.events.set(id, updated);
    return updated;
  }
  async deleteEvent(id: string): Promise<boolean> { return this.events.delete(id); }

  async getEquipment(): Promise<Equipment[]> { return Array.from(this.equipment.values()); }
  async getEquipmentById(id: string): Promise<Equipment | undefined> { return this.equipment.get(id); }
  async getEquipmentByStatus(status: string): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter((e) => e.status === status);
  }
  async getEquipmentByBarcode(barcode: string): Promise<Equipment | undefined> {
    const normalized = String(barcode || "").trim().toLowerCase();
    return Array.from(this.equipment.values()).find((e) => {
      const candidates = [e.barcode, e.inventoryNumber, e.serialNumber, e.id]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      return candidates.includes(normalized);
    });
  }
  async createEquipment(data: InsertEquipment): Promise<Equipment> {
    const id = this.uid();
    const eq = {
      ...data,
      id,
      operabilityStatus: data.operabilityStatus ?? equipmentOperabilityFallback(data.status),
      categoryId: data.categoryId ?? null,
      locationId: data.locationId ?? null,
      manualLocation: data.manualLocation ?? null,
      storageLocation: data.storageLocation ?? null,
      storageLocationId: data.storageLocationId ?? null,
      responsiblePerson: data.responsiblePerson ?? null,
      responsibleContact: data.responsibleContact ?? null,
      createdAt: this.now(),
    } as Equipment;
    this.equipment.set(id, eq);
    return eq;
  }
  async updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment | undefined> {
    const e = this.equipment.get(id);
    if (!e) return undefined;
    const updated = { ...e, ...data };
    this.equipment.set(id, updated);
    return updated;
  }
  async deleteEquipment(id: string): Promise<boolean> {
    for (const [linkId, link] of this.equipmentContextLinksMap) {
      if (link.equipmentId === id) this.equipmentContextLinksMap.delete(linkId);
    }
    for (const [commentId, comment] of this.equipmentCommentsMap) {
      if (comment.equipmentId === id) this.equipmentCommentsMap.delete(commentId);
    }
    return this.equipment.delete(id);
  }
  async getEquipmentCategories(companyId: string): Promise<EquipmentCategory[]> {
    return Array.from(this.equipmentCategoriesMap.values())
      .filter((category) => category.companyId === companyId)
      .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
  }
  async getEquipmentCategoryById(id: string): Promise<EquipmentCategory | undefined> {
    return this.equipmentCategoriesMap.get(id);
  }
  async createEquipmentCategory(data: InsertEquipmentCategory): Promise<EquipmentCategory> {
    const category = {
      ...data,
      id: this.uid(),
      archivedAt: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    } as EquipmentCategory;
    this.equipmentCategoriesMap.set(category.id, category);
    return category;
  }
  async updateEquipmentCategory(
    id: string,
    data: Partial<EquipmentCategory>,
  ): Promise<EquipmentCategory | undefined> {
    const current = this.equipmentCategoriesMap.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...data, updatedAt: this.now() };
    this.equipmentCategoriesMap.set(id, updated);
    return updated;
  }
  async getWarehouseStorageLocations(companyId: string): Promise<WarehouseStorageLocation[]> {
    return Array.from(this.warehouseStorageLocationsMap.values())
      .filter((location) => location.companyId === companyId)
      .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
  }
  async getWarehouseStorageLocationById(id: string): Promise<WarehouseStorageLocation | undefined> {
    return this.warehouseStorageLocationsMap.get(id);
  }
  async createWarehouseStorageLocation(
    data: InsertWarehouseStorageLocation,
  ): Promise<WarehouseStorageLocation> {
    const location = {
      ...data,
      id: this.uid(),
      archivedAt: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    } as WarehouseStorageLocation;
    this.warehouseStorageLocationsMap.set(location.id, location);
    return location;
  }
  async updateWarehouseStorageLocation(
    id: string,
    data: Partial<WarehouseStorageLocation>,
  ): Promise<WarehouseStorageLocation | undefined> {
    const current = this.warehouseStorageLocationsMap.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...data, updatedAt: this.now() };
    this.warehouseStorageLocationsMap.set(id, updated);
    return updated;
  }
  async uploadEquipmentPhoto(): Promise<Equipment | undefined> { return undefined; }
  async getEquipmentComments(equipmentId: string): Promise<EquipmentComment[]> {
    return Array.from(this.equipmentCommentsMap.values())
      .filter((comment) => comment.equipmentId === equipmentId)
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async getEquipmentCommentsByEquipmentIds(equipmentIds: string[]): Promise<EquipmentComment[]> {
    const idSet = new Set(equipmentIds.map(String).filter(Boolean));
    return Array.from(this.equipmentCommentsMap.values())
      .filter((comment) => idSet.has(String(comment.equipmentId)))
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async createEquipmentComment(data: InsertEquipmentComment): Promise<EquipmentComment> {
    const comment = {
      ...data,
      id: this.uid(),
      createdAt: this.now(),
      updatedAt: this.now(),
    } as EquipmentComment;
    this.equipmentCommentsMap.set(comment.id, comment);
    return comment;
  }
  async getEquipmentContextLinks(equipmentId?: string): Promise<EquipmentContextLink[]> {
    return Array.from(this.equipmentContextLinksMap.values())
      .filter((link) => !equipmentId || link.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }
  async replaceEquipmentContextLinks(input: {
    equipmentId: string;
    source: "manual" | "checkout";
    checkoutRequestId?: string | null;
    projectId?: string | null;
    kanbanCardIds: string[];
    createdByUserId?: string | null;
  }): Promise<EquipmentContextLink[]> {
    const requestId = input.checkoutRequestId || null;
    for (const [id, link] of this.equipmentContextLinksMap) {
      if (
        link.equipmentId === input.equipmentId &&
        link.source === input.source &&
        link.active &&
        String(link.checkoutRequestId || "") === String(requestId || "")
      ) {
        this.equipmentContextLinksMap.set(id, {
          ...link,
          active: false,
          endedAt: this.now(),
          updatedAt: this.now(),
        });
      }
    }
    const uniqueCardIds = Array.from(new Set(input.kanbanCardIds.map(String).filter(Boolean)));
    const rows: InsertEquipmentContextLink[] = uniqueCardIds.length > 0
      ? uniqueCardIds.map((kanbanCardId) => ({
          equipmentId: input.equipmentId,
          projectId: input.projectId || null,
          kanbanCardId,
          source: input.source,
          checkoutRequestId: requestId,
          createdByUserId: input.createdByUserId || null,
          active: true,
          endedAt: null,
        }))
      : input.projectId
        ? [{
            equipmentId: input.equipmentId,
            projectId: input.projectId,
            kanbanCardId: null,
            source: input.source,
            checkoutRequestId: requestId,
            createdByUserId: input.createdByUserId || null,
            active: true,
            endedAt: null,
          }]
        : [];
    return rows.map((row) => {
      const link = {
        ...row,
        id: this.uid(),
        createdAt: this.now(),
        updatedAt: this.now(),
      } as EquipmentContextLink;
      this.equipmentContextLinksMap.set(link.id, link);
      return link;
    });
  }
  async deactivateEquipmentContextLinks(
    equipmentId: string,
    options: { source?: "manual" | "checkout"; checkoutRequestId?: string | null } = {},
  ): Promise<EquipmentContextLink[]> {
    const updated: EquipmentContextLink[] = [];
    for (const [id, link] of this.equipmentContextLinksMap) {
      if (link.equipmentId !== equipmentId || !link.active) continue;
      if (options.source && link.source !== options.source) continue;
      if (
        options.checkoutRequestId !== undefined &&
        String(link.checkoutRequestId || "") !== String(options.checkoutRequestId || "")
      ) continue;
      const next = { ...link, active: false, endedAt: this.now(), updatedAt: this.now() };
      this.equipmentContextLinksMap.set(id, next);
      updated.push(next);
    }
    return updated;
  }

  async getSystems(): Promise<System[]> { return Array.from(this.systems.values()); }
  async getSystemById(id: string): Promise<System | undefined> { return this.systems.get(id); }
  async getSystemsByStatus(status: string): Promise<System[]> {
    return Array.from(this.systems.values()).filter((s) => s.status === status);
  }
  async createSystem(data: InsertSystem): Promise<System> {
    const id = this.uid();
    const system = { ...data, id, createdAt: this.now() } as System;
    this.systems.set(id, system);
    return system;
  }
  async updateSystem(id: string, data: Partial<System>): Promise<System | undefined> {
    const s = this.systems.get(id);
    if (!s) return undefined;
    const updated = { ...s, ...data };
    this.systems.set(id, updated);
    return updated;
  }
  async deleteSystem(id: string): Promise<boolean> { return this.systems.delete(id); }
  async pingSystem(id: string, status: string): Promise<System | undefined> {
    return this.updateSystem(id, { status, lastPing: this.now() });
  }

  async getStreams(): Promise<Stream[]> { return []; }
  async getActiveStreams(): Promise<Stream[]> { return []; }
  async getStreamById(): Promise<Stream | undefined> { return undefined; }
  async getStreamsByUser(): Promise<Stream[]> { return []; }
  async createStream(data: InsertStream): Promise<Stream> {
    return { ...data, id: this.uid(), createdAt: this.now() } as Stream;
  }
  async updateStream(): Promise<Stream | undefined> { return undefined; }

  async getNotificationsByUser(): Promise<Notification[]> { return []; }
  async createNotification(data: InsertNotification): Promise<Notification> {
    return { ...data, id: this.uid(), createdAt: this.now() } as Notification;
  }
  async markNotificationRead(): Promise<boolean> { return true; }
  async markAllNotificationsRead(): Promise<number> { return 0; }
  async deleteNotification(): Promise<boolean> { return true; }

  async getPlatformSettings(): Promise<PlatformSetting[]> {
    return Array.from(this.platformSettingsMap.values()).sort((a, b) => `${a.category}:${a.key}`.localeCompare(`${b.category}:${b.key}`));
  }
  async getPlatformSettingByKey(key: string): Promise<PlatformSetting | undefined> {
    return Array.from(this.platformSettingsMap.values()).find((item) => item.key === key);
  }
  async upsertPlatformSetting(data: InsertPlatformSetting): Promise<PlatformSetting> {
    const existing = await this.getPlatformSettingByKey(data.key);
    const setting: PlatformSetting = {
      id: existing?.id ?? this.uid(),
      key: data.key,
      category: data.category ?? "general",
      value: data.value ?? {},
      description: data.description ?? null,
      updatedBy: data.updatedBy ?? null,
      createdAt: existing?.createdAt ?? this.now(),
      updatedAt: this.now(),
    };
    this.platformSettingsMap.set(setting.id, setting);
    return setting;
  }

  async getPlatformIncidents(limit = 100): Promise<PlatformIncident[]> {
    return Array.from(this.platformIncidentsMap.values())
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, limit);
  }
  async createPlatformIncident(data: InsertPlatformIncident): Promise<PlatformIncident> {
    const incident: PlatformIncident = {
      id: this.uid(),
      companyId: data.companyId ?? null,
      userId: data.userId ?? null,
      source: data.source ?? "manual",
      type: data.type ?? "incident",
      severity: data.severity ?? "medium",
      status: data.status ?? "open",
      title: data.title,
      message: data.message,
      metadata: data.metadata ?? {},
      resolvedAt: data.resolvedAt ?? null,
      resolvedBy: data.resolvedBy ?? null,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.platformIncidentsMap.set(incident.id, incident);
    return incident;
  }
  async updatePlatformIncident(id: string, data: Partial<PlatformIncident>): Promise<PlatformIncident | undefined> {
    const incident = this.platformIncidentsMap.get(id);
    if (!incident) return undefined;
    const updated: PlatformIncident = { ...incident, ...data, updatedAt: this.now() };
    this.platformIncidentsMap.set(id, updated);
    return updated;
  }

  async getEquipmentReservations(): Promise<EquipmentReservation[]> { return []; }
  async getEquipmentReservationsByEquipment(): Promise<EquipmentReservation[]> { return []; }
  async createEquipmentReservation(data: InsertEquipmentReservation): Promise<EquipmentReservation> {
    return { ...data, id: this.uid(), createdAt: this.now() } as EquipmentReservation;
  }
  async checkEquipmentConflicts(): Promise<EquipmentReservation[]> { return []; }
  async getEquipmentCheckoutRequests(): Promise<EquipmentCheckoutRequest[]> {
    return Array.from(this.equipmentCheckoutRequestsMap.values()).sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );
  }
  async getEquipmentCheckoutRequestById(id: string): Promise<EquipmentCheckoutRequest | undefined> {
    return this.equipmentCheckoutRequestsMap.get(id);
  }
  async createEquipmentCheckoutRequest(data: InsertEquipmentCheckoutRequest): Promise<EquipmentCheckoutRequest> {
    const request: EquipmentCheckoutRequest = {
      id: this.uid(),
      companyId: data.companyId ?? null,
      equipmentId: data.equipmentId,
      requestedBy: data.requestedBy,
      kanbanCardId: data.kanbanCardId ?? null,
      kanbanCardIds: Array.isArray(data.kanbanCardIds)
        ? Array.from(new Set(data.kanbanCardIds.map(String).filter(Boolean)))
        : data.kanbanCardId
          ? [data.kanbanCardId]
          : [],
      projectId: data.projectId ?? null,
      locationId: data.locationId ?? null,
      manualLocation: data.manualLocation ?? null,
      taskId: data.taskId ?? null,
      quantity: data.quantity ?? 1,
      requestType: data.requestType ?? "checkout",
      currentHolder: data.currentHolder ?? null,
      reviewedBy: data.reviewedBy ?? null,
      status: data.status ?? "pending",
      location: data.location ?? null,
      note: data.note ?? null,
      decisionNote: data.decisionNote ?? null,
      createdAt: this.now(),
      updatedAt: this.now(),
      reviewedAt: null,
    };
    this.equipmentCheckoutRequestsMap.set(request.id, request);
    return request;
  }
  async updateEquipmentCheckoutRequest(
    id: string,
    data: Partial<EquipmentCheckoutRequest>,
  ): Promise<EquipmentCheckoutRequest | undefined> {
    const existing = this.equipmentCheckoutRequestsMap.get(id);
    if (!existing) return undefined;
    const updated: EquipmentCheckoutRequest = { ...existing, ...data, updatedAt: this.now() };
    this.equipmentCheckoutRequestsMap.set(id, updated);
    return updated;
  }

  async getTelegramUserByTelegramId(): Promise<TelegramUser | undefined> { return undefined; }
  async createTelegramUser(data: InsertTelegramUser): Promise<TelegramUser> {
    return { ...data, id: this.uid(), createdAt: this.now() } as TelegramUser;
  }
  async updateTelegramUser(): Promise<TelegramUser | undefined> { return undefined; }
  async linkTelegramUser(): Promise<TelegramUser | undefined> { return undefined; }

  async getObsConnections(): Promise<ObsConnection[]> { return []; }
  async createObsConnection(data: InsertObsConnection): Promise<ObsConnection> {
    return { ...data, id: this.uid(), createdAt: this.now() } as ObsConnection;
  }
  async updateObsConnection(): Promise<ObsConnection | undefined> { return undefined; }
  async deleteObsConnection(): Promise<boolean> { return true; }

  async createAnalyticsEvent(data: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const id = this.uid();
    const event = { ...data, id, timestamp: (data as any).timestamp ?? this.now() } as AnalyticsEvent;
    this.analytics.set(id, event);
    return event;
  }
  async getAnalyticsEvents(entityType?: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    return Array.from(this.analytics.values())
      .filter((event) => !entityType || event.entityType === entityType)
      .filter((event) => !startDate || new Date(event.timestamp ?? 0).getTime() >= startDate.getTime())
      .filter((event) => !endDate || new Date(event.timestamp ?? 0).getTime() <= endDate.getTime())
      .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
  }

  async getTasks(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async getTaskById(id: string): Promise<Task | undefined> { return this.tasks.get(id); }
  async getTaskByYougileTaskId(yougileTaskId: string): Promise<Task | undefined> {
    return Array.from(this.tasks.values()).find((t) => (t as Task & { yougileTaskId?: string }).yougileTaskId === yougileTaskId);
  }
  async getTasksByYougileBoardId(yougileBoardId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((t) => (t as Task & { yougileBoardId?: string }).yougileBoardId === yougileBoardId);
  }
  async getTasksByAssignee(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async getTasksByCreator(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async getTasksByAssigneeOrCreator(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async getTasksByStatus(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async createTask(data: InsertTask): Promise<Task> {
    const id = this.uid();
    const task = { ...data, id, createdAt: this.now() } as Task;
    this.tasks.set(id, task);
    return task;
  }
  async updateTask(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const t = this.tasks.get(id);
    if (!t) return undefined;
    const updated = { ...t, ...data };
    this.tasks.set(id, updated);
    return updated;
  }
  async deleteTask(id: string): Promise<boolean> { return this.tasks.delete(id); }

  async getTaskComments(): Promise<TaskComment[]> { return []; }
  async createTaskComment(data: InsertTaskComment): Promise<TaskComment> {
    return { ...data, id: this.uid(), createdAt: this.now() } as TaskComment;
  }
  async deleteTaskComment(): Promise<boolean> { return true; }

  async getTaskHistory(): Promise<TaskHistory[]> { return []; }
  async createTaskHistory(data: InsertTaskHistory): Promise<TaskHistory> {
    return { ...data, id: this.uid(), createdAt: this.now() } as TaskHistory;
  }

  async getRoles(): Promise<Role[]> { return []; }
  async getRoleById(): Promise<Role | undefined> { return undefined; }
  async getRoleByName(): Promise<Role | undefined> { return undefined; }
  async createRole(data: InsertRole): Promise<Role> {
    return { ...data, id: this.uid(), createdAt: this.now() } as Role;
  }
  async updateRole(): Promise<Role | undefined> { return undefined; }
  async deleteRole(): Promise<boolean> { return true; }

  async getComputers(): Promise<Computer[]> { return Array.from(this.computers.values()); }
  async getComputerById(id: string): Promise<Computer | undefined> { return this.computers.get(id); }
  async createComputer(data: InsertComputer): Promise<Computer> {
    const id = this.uid();
    const computer = { ...data, id, createdAt: this.now() } as Computer;
    this.computers.set(id, computer);
    return computer;
  }
  async updateComputer(id: string, data: Partial<Computer>): Promise<Computer | undefined> {
    const c = this.computers.get(id);
    if (!c) return undefined;
    const updated = { ...c, ...data };
    this.computers.set(id, updated);
    return updated;
  }
  async deleteComputer(id: string): Promise<boolean> { return this.computers.delete(id); }

  async getProjects(): Promise<Project[]> { return Array.from(this.projects.values()); }
  async getProjectById(id: string): Promise<Project | undefined> { return this.projects.get(id); }
  async createProject(data: InsertProject): Promise<Project> {
    const id = this.uid();
    const p = { ...data, id, createdAt: this.now() } as Project;
    this.projects.set(id, p);
    return p;
  }
  async updateProject(id: string, data: Partial<Project>): Promise<Project | undefined> {
    const p = this.projects.get(id);
    if (!p) return undefined;
    const updated = { ...p, ...data };
    this.projects.set(id, updated);
    return updated;
  }
  async deleteProject(id: string): Promise<boolean> {
    Array.from(this.projectLocationsMap.entries()).forEach(([linkId, link]) => {
      if (link.projectId === id) this.projectLocationsMap.delete(linkId);
    });
    Array.from(this.projectCommentsMap.entries()).forEach(([commentId, comment]) => {
      if (comment.projectId === id) this.projectCommentsMap.delete(commentId);
    });
    return this.projects.delete(id);
  }
  async getProjectLocationLinks(projectId: string): Promise<ProjectLocation[]> {
    return Array.from(this.projectLocationsMap.values()).filter((link) => link.projectId === projectId);
  }
  async getProjectLocationLinksByLocationId(locationId: string): Promise<ProjectLocation[]> {
    return Array.from(this.projectLocationsMap.values()).filter((link) => link.locationId === locationId);
  }
  async setProjectLocations(projectId: string, locationIds: string[]): Promise<ProjectLocation[]> {
    Array.from(this.projectLocationsMap.entries()).forEach(([linkId, link]) => {
      if (link.projectId === projectId) this.projectLocationsMap.delete(linkId);
    });
    const links = Array.from(new Set(locationIds.map(String).map((id) => id.trim()).filter(Boolean))).map((locationId) => ({
      id: this.uid(),
      projectId,
      locationId,
      createdAt: this.now(),
    } as ProjectLocation));
    links.forEach((link) => this.projectLocationsMap.set(link.id, link));
    return links;
  }
  async getProjectComments(projectId: string): Promise<ProjectComment[]> {
    return Array.from(this.projectCommentsMap.values())
      .filter((comment) => comment.projectId === projectId)
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async createProjectComment(data: InsertProjectComment): Promise<ProjectComment> {
    const id = this.uid();
    const comment = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as ProjectComment;
    this.projectCommentsMap.set(id, comment);
    return comment;
  }
  async updateProjectComment(id: string, data: Partial<ProjectComment>): Promise<ProjectComment | undefined> {
    const comment = this.projectCommentsMap.get(id);
    if (!comment) return undefined;
    const updated = { ...comment, ...data, updatedAt: this.now() } as ProjectComment;
    this.projectCommentsMap.set(id, updated);
    return updated;
  }

  async getProjectColumns(): Promise<ProjectColumn[]> { return []; }
  async createProjectColumn(data: InsertProjectColumn): Promise<ProjectColumn> {
    return { ...data, id: this.uid(), createdAt: this.now() } as ProjectColumn;
  }
  async updateProjectColumn(): Promise<ProjectColumn | undefined> { return undefined; }
  async deleteProjectColumn(): Promise<boolean> { return true; }
  async reorderProjectColumns(): Promise<void> {}

  async getKanbanBoards(): Promise<KanbanBoard[]> {
    return Array.from(this.kanbanBoardsMap.values()).sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );
  }
  async getKanbanBoardsByCompanyIds(companyIds: string[]): Promise<KanbanBoard[]> {
    const allowed = new Set(companyIds.map(String));
    return (await this.getKanbanBoards()).filter((board) => allowed.has(String(board.companyId)));
  }
  async getPersonalKanbanBoardsByUserId(userId: string): Promise<KanbanBoard[]> {
    return (await this.getKanbanBoards()).filter(
      (board) => !board.companyId && String(board.createdByUserId) === String(userId),
    );
  }
  async getKanbanBoardById(id: string): Promise<KanbanBoard | undefined> {
    return this.kanbanBoardsMap.get(id);
  }
  async createKanbanBoard(data: InsertKanbanBoard): Promise<KanbanBoard> {
    const id = this.uid();
    const board = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as KanbanBoard;
    this.kanbanBoardsMap.set(id, board);
    return board;
  }
  async updateKanbanBoard(id: string, data: Partial<KanbanBoard>): Promise<KanbanBoard | undefined> {
    const board = this.kanbanBoardsMap.get(id);
    if (!board) return undefined;
    const updated = { ...board, ...data, updatedAt: this.now() } as KanbanBoard;
    this.kanbanBoardsMap.set(id, updated);
    return updated;
  }
  async deleteKanbanBoard(id: string): Promise<boolean> {
    Array.from(this.kanbanCardsMap.entries()).forEach(([cardId, card]) => {
      if (card.boardId === id) {
        this.kanbanCardsMap.delete(cardId);
        Array.from(this.kanbanCardLocationsMap.entries()).forEach(([linkId, link]) => {
          if (link.cardId === cardId) this.kanbanCardLocationsMap.delete(linkId);
        });
        Array.from(this.kanbanCardAttachmentsMap.entries()).forEach(([attachmentId, attachment]) => {
          if (attachment.cardId === cardId) this.kanbanCardAttachmentsMap.delete(attachmentId);
        });
        Array.from(this.kanbanCardLabelsMap.entries()).forEach(([linkId, link]) => {
          if (link.cardId === cardId) this.kanbanCardLabelsMap.delete(linkId);
        });
        Array.from(this.kanbanCardHistoryMap.entries()).forEach(([historyId, history]) => {
          if (history.cardId === cardId) this.kanbanCardHistoryMap.delete(historyId);
        });
        Array.from(this.kanbanCardCommentsMap.entries()).forEach(([commentId, comment]) => {
          if (comment.cardId === cardId) this.kanbanCardCommentsMap.delete(commentId);
        });
      }
    });
    Array.from(this.kanbanLabelsMap.entries()).forEach(([labelId, label]) => {
      if (label.boardId === id) {
        this.kanbanLabelsMap.delete(labelId);
        Array.from(this.kanbanCardLabelsMap.entries()).forEach(([linkId, link]) => {
          if (link.labelId === labelId) this.kanbanCardLabelsMap.delete(linkId);
        });
      }
    });
    Array.from(this.kanbanListsMap.entries()).forEach(([listId, list]) => {
      if (list.boardId === id) this.kanbanListsMap.delete(listId);
    });
    Array.from(this.kanbanBoardMembersMap.entries()).forEach(([memberId, member]) => {
      if (member.boardId === id) this.kanbanBoardMembersMap.delete(memberId);
    });
    return this.kanbanBoardsMap.delete(id);
  }
  async getKanbanBoardMembers(boardId: string): Promise<KanbanBoardMember[]> {
    return Array.from(this.kanbanBoardMembersMap.values()).filter((member) => member.boardId === boardId);
  }
  async getKanbanBoardMembershipsByUser(userId: string): Promise<KanbanBoardMember[]> {
    return Array.from(this.kanbanBoardMembersMap.values()).filter((member) => member.userId === userId);
  }
  async getKanbanBoardMember(boardId: string, userId: string): Promise<KanbanBoardMember | undefined> {
    return Array.from(this.kanbanBoardMembersMap.values()).find(
      (member) => member.boardId === boardId && member.userId === userId,
    );
  }
  async createKanbanBoardMember(data: InsertKanbanBoardMember): Promise<KanbanBoardMember> {
    const id = this.uid();
    const member = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as KanbanBoardMember;
    this.kanbanBoardMembersMap.set(id, member);
    return member;
  }
  async updateKanbanBoardMember(id: string, data: Partial<KanbanBoardMember>): Promise<KanbanBoardMember | undefined> {
    const member = this.kanbanBoardMembersMap.get(id);
    if (!member) return undefined;
    const updated = { ...member, ...data, updatedAt: this.now() } as KanbanBoardMember;
    this.kanbanBoardMembersMap.set(id, updated);
    return updated;
  }
  async deleteKanbanBoardMember(id: string): Promise<boolean> {
    return this.kanbanBoardMembersMap.delete(id);
  }
  async getKanbanListsByBoardId(boardId: string): Promise<KanbanList[]> {
    return Array.from(this.kanbanListsMap.values())
      .filter((list) => list.boardId === boardId)
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  }
  async getKanbanListById(id: string): Promise<KanbanList | undefined> {
    return this.kanbanListsMap.get(id);
  }
  async createKanbanList(data: InsertKanbanList): Promise<KanbanList> {
    const id = this.uid();
    const list = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as KanbanList;
    this.kanbanListsMap.set(id, list);
    return list;
  }
  async updateKanbanList(id: string, data: Partial<KanbanList>): Promise<KanbanList | undefined> {
    const list = this.kanbanListsMap.get(id);
    if (!list) return undefined;
    const updated = { ...list, ...data, updatedAt: this.now() } as KanbanList;
    this.kanbanListsMap.set(id, updated);
    return updated;
  }
  async reorderKanbanLists(boardId: string, listIds: string[]): Promise<void> {
    listIds.forEach((listId, index) => {
      const list = this.kanbanListsMap.get(listId);
      if (!list || String(list.boardId) !== String(boardId)) return;
      this.kanbanListsMap.set(listId, {
        ...list,
        position: index,
        updatedAt: this.now(),
      } as KanbanList);
    });
  }
  async deleteKanbanList(id: string): Promise<boolean> {
    Array.from(this.kanbanCardsMap.entries()).forEach(([cardId, card]) => {
      if (card.listId === id) {
        this.kanbanCardsMap.delete(cardId);
        Array.from(this.kanbanCardLocationsMap.entries()).forEach(([linkId, link]) => {
          if (link.cardId === cardId) this.kanbanCardLocationsMap.delete(linkId);
        });
        Array.from(this.kanbanCardAttachmentsMap.entries()).forEach(([attachmentId, attachment]) => {
          if (attachment.cardId === cardId) this.kanbanCardAttachmentsMap.delete(attachmentId);
        });
        Array.from(this.kanbanCardLabelsMap.entries()).forEach(([linkId, link]) => {
          if (link.cardId === cardId) this.kanbanCardLabelsMap.delete(linkId);
        });
        Array.from(this.kanbanCardHistoryMap.entries()).forEach(([historyId, history]) => {
          if (history.cardId === cardId) this.kanbanCardHistoryMap.delete(historyId);
        });
        Array.from(this.kanbanCardCommentsMap.entries()).forEach(([commentId, comment]) => {
          if (comment.cardId === cardId) this.kanbanCardCommentsMap.delete(commentId);
        });
      }
    });
    return this.kanbanListsMap.delete(id);
  }

  async getKanbanCardsByBoardId(boardId: string): Promise<KanbanCard[]> {
    return Array.from(this.kanbanCardsMap.values())
      .filter((card) => card.boardId === boardId)
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  }
  async getKanbanCardsByListId(listId: string): Promise<KanbanCard[]> {
    return Array.from(this.kanbanCardsMap.values())
      .filter((card) => card.listId === listId)
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  }
  async getKanbanCardById(id: string): Promise<KanbanCard | undefined> {
    return this.kanbanCardsMap.get(id);
  }
  async createKanbanCard(data: InsertKanbanCard): Promise<KanbanCard> {
    const id = this.uid();
    const card = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as KanbanCard;
    this.kanbanCardsMap.set(id, card);
    return card;
  }
  async updateKanbanCard(id: string, data: Partial<KanbanCard>): Promise<KanbanCard | undefined> {
    const card = this.kanbanCardsMap.get(id);
    if (!card) return undefined;
    const updated = { ...card, ...data, updatedAt: this.now() } as KanbanCard;
    this.kanbanCardsMap.set(id, updated);
    return updated;
  }
  async moveKanbanCard(id: string, targetListId: string, targetPosition: number): Promise<KanbanCard | undefined> {
    const currentCard = this.kanbanCardsMap.get(id);
    if (!currentCard) return undefined;

    const currentListId = String(currentCard.listId);
    const normalizedTargetPosition = Math.max(0, Number(targetPosition || 0));

    if (currentListId === String(targetListId)) {
      const reorderedCards = await this.getKanbanCardsByListId(currentListId);
      const filteredCards = reorderedCards.filter((card) => card.id !== id);
      const insertionIndex = Math.min(normalizedTargetPosition, filteredCards.length);
      filteredCards.splice(insertionIndex, 0, currentCard);

      let movedCard: KanbanCard | undefined;
      filteredCards.forEach((card, index) => {
        const updatedCard = {
          ...card,
          position: index,
          updatedAt: this.now(),
        } as KanbanCard;
        this.kanbanCardsMap.set(card.id, updatedCard);
        if (card.id === id) movedCard = updatedCard;
      });

      return movedCard;
    }

    const sourceCards = (await this.getKanbanCardsByListId(currentListId)).filter((card) => card.id !== id);
    const targetCards = (await this.getKanbanCardsByListId(targetListId)).filter((card) => card.id !== id);
    const insertionIndex = Math.min(normalizedTargetPosition, targetCards.length);

    targetCards.splice(insertionIndex, 0, {
      ...currentCard,
      listId: targetListId,
    } as KanbanCard);

    sourceCards.forEach((card, index) => {
      this.kanbanCardsMap.set(card.id, {
        ...card,
        position: index,
        updatedAt: this.now(),
      } as KanbanCard);
    });

    let movedCard: KanbanCard | undefined;
    targetCards.forEach((card, index) => {
      const updatedCard = {
        ...card,
        listId: targetListId,
        position: index,
        updatedAt: this.now(),
      } as KanbanCard;
      this.kanbanCardsMap.set(card.id, updatedCard);
      if (card.id === id) movedCard = updatedCard;
    });

    return movedCard;
  }
  async deleteKanbanCard(id: string): Promise<boolean> {
    Array.from(this.kanbanCardLocationsMap.entries()).forEach(([linkId, link]) => {
      if (link.cardId === id) this.kanbanCardLocationsMap.delete(linkId);
    });
    Array.from(this.kanbanCardAttachmentsMap.entries()).forEach(([attachmentId, attachment]) => {
      if (attachment.cardId === id) this.kanbanCardAttachmentsMap.delete(attachmentId);
    });
    Array.from(this.kanbanCardLabelsMap.entries()).forEach(([linkId, link]) => {
      if (link.cardId === id) this.kanbanCardLabelsMap.delete(linkId);
    });
    Array.from(this.kanbanCardHistoryMap.entries()).forEach(([historyId, history]) => {
      if (history.cardId === id) this.kanbanCardHistoryMap.delete(historyId);
    });
    Array.from(this.kanbanCardCommentsMap.entries()).forEach(([commentId, comment]) => {
      if (comment.cardId === id) this.kanbanCardCommentsMap.delete(commentId);
    });
    return this.kanbanCardsMap.delete(id);
  }
  async getKanbanCardLocationLinks(cardId: string): Promise<KanbanCardLocation[]> {
    return Array.from(this.kanbanCardLocationsMap.values()).filter((link) => link.cardId === cardId);
  }
  async getKanbanCardLocationLinksByLocationId(locationId: string): Promise<KanbanCardLocation[]> {
    return Array.from(this.kanbanCardLocationsMap.values()).filter((link) => link.locationId === locationId);
  }
  async setKanbanCardLocations(cardId: string, locationIds: string[]): Promise<KanbanCardLocation[]> {
    Array.from(this.kanbanCardLocationsMap.entries()).forEach(([linkId, link]) => {
      if (link.cardId === cardId) this.kanbanCardLocationsMap.delete(linkId);
    });
    const links = Array.from(new Set(locationIds.map(String).map((id) => id.trim()).filter(Boolean))).map((locationId) => ({
      id: this.uid(),
      cardId,
      locationId,
      createdAt: this.now(),
    } as KanbanCardLocation));
    links.forEach((link) => this.kanbanCardLocationsMap.set(link.id, link));
    return links;
  }
  async getKanbanLabelsByBoardId(boardId: string): Promise<KanbanLabel[]> {
    return Array.from(this.kanbanLabelsMap.values())
      .filter((label) => label.boardId === boardId)
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async getKanbanLabelById(id: string): Promise<KanbanLabel | undefined> {
    return this.kanbanLabelsMap.get(id);
  }
  async createKanbanLabel(data: InsertKanbanLabel): Promise<KanbanLabel> {
    const id = this.uid();
    const label = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as KanbanLabel;
    this.kanbanLabelsMap.set(id, label);
    return label;
  }
  async updateKanbanLabel(id: string, data: Partial<KanbanLabel>): Promise<KanbanLabel | undefined> {
    const label = this.kanbanLabelsMap.get(id);
    if (!label) return undefined;
    const updated = { ...label, ...data, updatedAt: this.now() } as KanbanLabel;
    this.kanbanLabelsMap.set(id, updated);
    return updated;
  }
  async deleteKanbanLabel(id: string): Promise<boolean> {
    Array.from(this.kanbanCardLabelsMap.entries()).forEach(([linkId, link]) => {
      if (link.labelId === id) this.kanbanCardLabelsMap.delete(linkId);
    });
    return this.kanbanLabelsMap.delete(id);
  }
  async getKanbanCardLabels(cardId: string): Promise<KanbanCardLabel[]> {
    return Array.from(this.kanbanCardLabelsMap.values())
      .filter((link) => link.cardId === cardId)
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async setKanbanCardLabels(cardId: string, labelIds: string[]): Promise<KanbanCardLabel[]> {
    Array.from(this.kanbanCardLabelsMap.entries()).forEach(([linkId, link]) => {
      if (link.cardId === cardId) this.kanbanCardLabelsMap.delete(linkId);
    });

    const now = this.now();
    const created: KanbanCardLabel[] = [];
    for (const labelId of Array.from(new Set(labelIds.map(String).filter(Boolean)))) {
      const id = this.uid();
      const link = { id, cardId, labelId, createdAt: now, updatedAt: now } as KanbanCardLabel;
      this.kanbanCardLabelsMap.set(id, link);
      created.push(link);
    }

    return created;
  }
  async getKanbanCardHistory(cardId: string): Promise<KanbanCardHistory[]> {
    return Array.from(this.kanbanCardHistoryMap.values())
      .filter((history) => history.cardId === cardId)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }
  async createKanbanCardHistory(data: InsertKanbanCardHistory): Promise<KanbanCardHistory> {
    const id = this.uid();
    const history = { ...data, id, createdAt: this.now() } as KanbanCardHistory;
    this.kanbanCardHistoryMap.set(id, history);
    return history;
  }
  async getKanbanCardComments(cardId: string): Promise<KanbanCardComment[]> {
    return Array.from(this.kanbanCardCommentsMap.values())
      .filter((comment) => comment.cardId === cardId)
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async createKanbanCardComment(data: InsertKanbanCardComment): Promise<KanbanCardComment> {
    const id = this.uid();
    const comment = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as KanbanCardComment;
    this.kanbanCardCommentsMap.set(id, comment);
    return comment;
  }
  async updateKanbanCardComment(id: string, data: Partial<KanbanCardComment>): Promise<KanbanCardComment | undefined> {
    const comment = this.kanbanCardCommentsMap.get(id);
    if (!comment) return undefined;
    const updated = { ...comment, ...data, updatedAt: this.now() } as KanbanCardComment;
    this.kanbanCardCommentsMap.set(id, updated);
    return updated;
  }
  async getKanbanCardAttachments(cardId: string): Promise<KanbanCardAttachment[]> {
    return Array.from(this.kanbanCardAttachmentsMap.values())
      .filter((attachment) => attachment.cardId === cardId)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }
  async createKanbanCardAttachment(data: InsertKanbanCardAttachment): Promise<KanbanCardAttachment> {
    const id = this.uid();
    const attachment = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as KanbanCardAttachment;
    this.kanbanCardAttachmentsMap.set(id, attachment);
    return attachment;
  }
  async deleteKanbanCardAttachment(id: string): Promise<boolean> {
    return this.kanbanCardAttachmentsMap.delete(id);
  }

  private normalizeCustomLocationStatus(status: unknown): string {
    const allowed = new Set(["available", "occupied", "reserved", "maintenance", "unavailable"]);
    return allowed.has(String(status)) ? String(status) : "available";
  }
  async getCustomLocations(): Promise<CustomLocation[]> {
    return Array.from(this.customLocationsMap.values())
      .map((location) => ({
        ...location,
        status: this.normalizeCustomLocationStatus((location as any).status),
        attachments: Array.isArray((location as any).attachments) ? (location as any).attachments : [],
      } as CustomLocation))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  async getCustomLocationById(id: string): Promise<CustomLocation | undefined> {
    const location = this.customLocationsMap.get(id);
    return location ? {
      ...location,
      status: this.normalizeCustomLocationStatus((location as any).status),
      attachments: Array.isArray((location as any).attachments) ? (location as any).attachments : [],
    } as CustomLocation : undefined;
  }
  async createCustomLocation(data: InsertCustomLocation): Promise<CustomLocation> {
    const location = {
      ...data,
      status: this.normalizeCustomLocationStatus((data as any).status),
      attachments: [],
      id: this.uid(),
      createdAt: this.now(),
      updatedAt: this.now(),
    } as CustomLocation;
    this.customLocationsMap.set(location.id, location);
    return location;
  }
  async updateCustomLocation(id: string, data: Partial<CustomLocation>): Promise<CustomLocation | undefined> {
    const location = this.customLocationsMap.get(id);
    if (!location) return undefined;
    const updated = {
      ...location,
      ...data,
      status: data.status !== undefined
        ? this.normalizeCustomLocationStatus(data.status)
        : this.normalizeCustomLocationStatus((location as any).status),
      attachments: Array.isArray((data as any).attachments)
        ? (data as any).attachments
        : Array.isArray((location as any).attachments)
          ? (location as any).attachments
          : [],
      updatedAt: this.now(),
    } as CustomLocation;
    this.customLocationsMap.set(id, updated);
    return updated;
  }
  async deleteCustomLocation(id: string): Promise<boolean> { return this.customLocationsMap.delete(id); }
  async getLocationIssues(locationId?: string): Promise<LocationIssue[]> {
    return Array.from(this.locationIssuesMap.values())
      .filter((issue) => !locationId || issue.locationId === locationId)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }
  async getLocationIssueById(id: string): Promise<LocationIssue | undefined> { return this.locationIssuesMap.get(id); }
  async createLocationIssue(data: InsertLocationIssue): Promise<LocationIssue> {
    const issue = { ...data, id: this.uid(), createdAt: this.now(), updatedAt: this.now() } as LocationIssue;
    this.locationIssuesMap.set(issue.id, issue);
    return issue;
  }
  async updateLocationIssue(id: string, data: Partial<LocationIssue>): Promise<LocationIssue | undefined> {
    const issue = this.locationIssuesMap.get(id);
    if (!issue) return undefined;
    const updated = { ...issue, ...data, updatedAt: this.now() } as LocationIssue;
    this.locationIssuesMap.set(id, updated);
    return updated;
  }
  async getLocationIssueComments(issueId: string): Promise<LocationIssueComment[]> {
    return Array.from(this.locationIssueCommentsMap.values())
      .filter((comment) => comment.issueId === issueId)
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async createLocationIssueComment(data: InsertLocationIssueComment): Promise<LocationIssueComment> {
    const comment = { ...data, id: this.uid(), createdAt: this.now(), updatedAt: this.now() } as LocationIssueComment;
    this.locationIssueCommentsMap.set(comment.id, comment);
    return comment;
  }

  async getRepositories(): Promise<Repository[]> { return []; }
  async getRepositoryById(): Promise<Repository | undefined> { return undefined; }
  async createRepository(data: InsertRepository): Promise<Repository> {
    return { ...data, id: this.uid(), createdAt: this.now() } as Repository;
  }
  async updateRepository(): Promise<Repository | undefined> { return undefined; }
  async deleteRepository(): Promise<boolean> { return true; }

  async getOtisStreamSettings(): Promise<OtisStreamSettings | undefined> {
    return this.otisSettings ?? undefined;
  }
  async upsertOtisStreamSettings(data: InsertOtisStreamSettings): Promise<OtisStreamSettings> {
    const id = this.otisSettings?.id ?? this.uid();
    this.otisSettings = { ...data, id, name: data.name ?? "Эфир ОТИС", updatedAt: this.now() } as OtisStreamSettings;
    return this.otisSettings;
  }

  async getShowParticipantProfiles(eventId: string): Promise<ShowParticipantProfile[]> {
    return Array.from(this.showParticipantProfilesMap.values())
      .filter((profile) => profile.eventId === eventId)
      .sort((left, right) =>
        Number(left.order || 0) - Number(right.order || 0) ||
        new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime(),
      );
  }
  async getShowParticipantProfileById(id: string): Promise<ShowParticipantProfile | undefined> {
    return this.showParticipantProfilesMap.get(id);
  }
  async createShowParticipantProfile(data: InsertShowParticipantProfile): Promise<ShowParticipantProfile> {
    const profile = {
      ...data,
      id: this.uid(),
      createdAt: this.now(),
      updatedAt: this.now(),
    } as ShowParticipantProfile;
    this.showParticipantProfilesMap.set(profile.id, profile);
    return profile;
  }
  async updateShowParticipantProfile(
    id: string,
    data: Partial<ShowParticipantProfile>,
  ): Promise<ShowParticipantProfile | undefined> {
    const profile = this.showParticipantProfilesMap.get(id);
    if (!profile) return undefined;
    const updated = { ...profile, ...data, updatedAt: this.now() } as ShowParticipantProfile;
    this.showParticipantProfilesMap.set(id, updated);
    return updated;
  }
  async deleteShowParticipantProfile(id: string): Promise<boolean> {
    return this.showParticipantProfilesMap.delete(id);
  }

  async getShowMarkers(eventId: string): Promise<ShowMarker[]> {
    return Array.from(this.showMarkersMap.values())
      .filter((marker) => marker.eventId === eventId)
      .sort((left, right) =>
        String(left.timecode).localeCompare(String(right.timecode)) ||
        new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime(),
      );
  }
  async getShowMarkerById(id: string): Promise<ShowMarker | undefined> {
    return this.showMarkersMap.get(id);
  }
  async createShowMarker(data: InsertShowMarker): Promise<ShowMarker> {
    const marker = { ...data, id: this.uid(), createdAt: this.now() } as ShowMarker;
    this.showMarkersMap.set(marker.id, marker);
    return marker;
  }
  async updateShowMarker(id: string, data: Partial<ShowMarker>): Promise<ShowMarker | undefined> {
    const marker = this.showMarkersMap.get(id);
    if (!marker) return undefined;
    const updated = { ...marker, ...data } as ShowMarker;
    this.showMarkersMap.set(id, updated);
    return updated;
  }
  async deleteShowMarker(id: string): Promise<boolean> {
    return this.showMarkersMap.delete(id);
  }

  private yougileProjectsMap = new Map<string, YougileProject>();
  private yougileBoardsMap = new Map<string, YougileBoard>();
  private yougileColumnsMap = new Map<string, YougileColumn>();
  private yougileUsersMap = new Map<string, YougileUser>();

  async getYougileProjects(): Promise<YougileProject[]> {
    return Array.from(this.yougileProjectsMap.values()).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }
  async upsertYougileProjects(items: { id: string; title?: string | null }[]): Promise<void> {
    const now = new Date();
    for (const row of items) {
      this.yougileProjectsMap.set(row.id, { id: row.id, title: row.title ?? null, syncedAt: now });
    }
  }
  async getYougileBoards(projectId?: string): Promise<YougileBoard[]> {
    let list = Array.from(this.yougileBoardsMap.values());
    if (projectId) list = list.filter(b => b.projectId === projectId);
    return list.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }
  async upsertYougileBoards(items: { id: string; projectId: string; title?: string | null }[]): Promise<void> {
    const now = new Date();
    for (const row of items) {
      this.yougileBoardsMap.set(row.id, { id: row.id, projectId: row.projectId, title: row.title ?? null, syncedAt: now });
    }
  }
  async getYougileColumns(boardId: string): Promise<YougileColumn[]> {
    return Array.from(this.yougileColumnsMap.values()).filter(c => c.boardId === boardId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  async upsertYougileColumns(items: { id: string; boardId: string; title?: string | null; order?: number; color?: number | null }[]): Promise<void> {
    const now = new Date();
    for (const row of items) {
      this.yougileColumnsMap.set(row.id, { id: row.id, boardId: row.boardId, title: row.title ?? null, order: row.order ?? 0, color: row.color ?? null, syncedAt: now });
    }
  }
  async getYougileUsers(): Promise<YougileUser[]> {
    return Array.from(this.yougileUsersMap.values());
  }
  async upsertYougileUsers(items: { id: string; email?: string | null; username?: string | null }[]): Promise<void> {
    const now = new Date();
    for (const row of items) {
      this.yougileUsersMap.set(row.id, { id: row.id, email: row.email ?? null, username: row.username ?? null, syncedAt: now });
    }
  }

  private yougileStringStickerStatesMap = new Map<string, YougileStringStickerStateRow & { boardId: string }>();
  async getYougileStringStickerStates(boardId: string): Promise<YougileStringStickerStateRow[]> {
    return Array.from(this.yougileStringStickerStatesMap.values())
      .filter((s) => s.boardId === boardId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id.localeCompare(b.id)));
  }
  async upsertYougileStringStickerStates(boardId: string, items: { id: string; title?: string | null; type?: string | null; order?: number; options?: unknown }[]): Promise<void> {
    const now = new Date();
    for (const row of items) {
      this.yougileStringStickerStatesMap.set(row.id, {
        id: row.id,
        boardId,
        title: row.title ?? null,
        type: row.type ?? null,
        order: row.order ?? 0,
        options: row.options ?? null,
        syncedAt: now,
      } as YougileStringStickerStateRow & { boardId: string });
    }
  }

  async getConnectionSchemaComponents(schemaId: string): Promise<ConnectionSchemaComponent[]> {
    return Array.from(this.connectionSchemaComponents.values()).filter(c => c.schemaId === schemaId);
  }
  async getConnectionSchemaComponentById(id: string): Promise<ConnectionSchemaComponent | undefined> {
    return this.connectionSchemaComponents.get(id);
  }
  async createConnectionSchemaComponent(data: InsertConnectionSchemaComponent): Promise<ConnectionSchemaComponent> {
    const id = this.uid();
    const comp = { ...data, id, schemaId: data.schemaId, createdAt: this.now() } as ConnectionSchemaComponent;
    this.connectionSchemaComponents.set(id, comp);
    return comp;
  }
  async updateConnectionSchemaComponent(id: string, componentData: Partial<ConnectionSchemaComponent>): Promise<ConnectionSchemaComponent | undefined> {
    const comp = this.connectionSchemaComponents.get(id);
    if (!comp) return undefined;
    const updated = { ...comp, ...componentData, updatedAt: this.now() } as ConnectionSchemaComponent;
    this.connectionSchemaComponents.set(id, updated);
    return updated;
  }
  async deleteConnectionSchemaComponent(id: string): Promise<boolean> { return this.connectionSchemaComponents.delete(id); }

  async getConnectionSchemas(): Promise<ConnectionSchema[]> { return Array.from(this.connectionSchemas.values()); }
  async getConnectionSchemaById(id: string): Promise<ConnectionSchema | undefined> { return this.connectionSchemas.get(id); }
  async createConnectionSchema(data: InsertConnectionSchema): Promise<ConnectionSchema> {
    const id = this.uid();
    const schema = { ...data, id, name: data.name, description: data.description ?? null, createdAt: this.now(), updatedAt: this.now() } as ConnectionSchema;
    this.connectionSchemas.set(id, schema);
    return schema;
  }
  async updateConnectionSchema(id: string, data: Partial<ConnectionSchema>): Promise<ConnectionSchema | undefined> {
    const s = this.connectionSchemas.get(id);
    if (!s) return undefined;
    const updated = { ...s, ...data, updatedAt: this.now() };
    this.connectionSchemas.set(id, updated);
    return updated;
  }
  async deleteConnectionSchema(id: string): Promise<boolean> {
    for (const [cid, c] of this.connectionSchemaComponents) {
      if (c.schemaId === id) this.connectionSchemaComponents.delete(cid);
    }
    return this.connectionSchemas.delete(id);
  }

  private chatSessionsMap = new Map<string, ChatSession>();
  private chatMessagesMap = new Map<string, ChatMessage>();

  async getChatSessionsByUser(userId: string): Promise<ChatSession[]> {
    return Array.from(this.chatSessionsMap.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  }
  async getChatSessionById(id: string): Promise<ChatSession | undefined> {
    return this.chatSessionsMap.get(id);
  }
  async createChatSession(data: InsertChatSession): Promise<ChatSession> {
    const id = this.uid();
    const session = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as ChatSession;
    this.chatSessionsMap.set(id, session);
    return session;
  }
  async updateChatSession(id: string, sessionData: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const s = this.chatSessionsMap.get(id);
    if (!s) return undefined;
    const updated = { ...s, ...sessionData, updatedAt: this.now() } as ChatSession;
    this.chatSessionsMap.set(id, updated);
    return updated;
  }
  async deleteChatSession(id: string): Promise<boolean> {
    for (const [mid, m] of this.chatMessagesMap) {
      if (m.sessionId === id) this.chatMessagesMap.delete(mid);
    }
    return this.chatSessionsMap.delete(id);
  }
  async getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessagesMap.values())
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const id = this.uid();
    const msg = { ...data, id, createdAt: this.now() } as ChatMessage;
    this.chatMessagesMap.set(id, msg);
    const session = this.chatSessionsMap.get(data.sessionId);
    if (session) {
      this.chatSessionsMap.set(data.sessionId, { ...session, updatedAt: this.now() } as ChatSession);
    }
    return msg;
  }
  async deleteChatMessage(id: string): Promise<boolean> {
    return this.chatMessagesMap.delete(id);
  }

  async getVmixSchedulerEvents(): Promise<VmixSchedulerEvent[]> {
    return Array.from(this.vmixSchedulerEventsMap.values())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }
  async getVmixSchedulerEventById(id: string): Promise<VmixSchedulerEvent | undefined> {
    return this.vmixSchedulerEventsMap.get(id);
  }
  async createVmixSchedulerEvent(data: InsertVmixSchedulerEvent): Promise<VmixSchedulerEvent> {
    const id = this.uid();
    const event = { ...data, id, createdAt: this.now(), updatedAt: this.now() } as VmixSchedulerEvent;
    this.vmixSchedulerEventsMap.set(id, event);
    return event;
  }
  async updateVmixSchedulerEvent(id: string, data: Partial<VmixSchedulerEvent>): Promise<VmixSchedulerEvent | undefined> {
    const event = this.vmixSchedulerEventsMap.get(id);
    if (!event) return undefined;
    const updated = { ...event, ...data, updatedAt: this.now() } as VmixSchedulerEvent;
    this.vmixSchedulerEventsMap.set(id, updated);
    return updated;
  }
  async deleteVmixSchedulerEvent(id: string): Promise<boolean> { return this.vmixSchedulerEventsMap.delete(id); }
}

storage = new StubStorage();

const INIT_DB_RETRIES = 3;
const INIT_DB_RETRY_DELAY_MS = 2000;

export async function initDatabase(): Promise<void> {
  if (!connectionString || connectionString.trim() === "") {
    console.warn("\n⚠️  DATABASE_URL не задан — работа в режиме заглушки (данные в памяти, не сохраняются между перезапусками).\n");
    return;
  }
  let lastError: any;
  for (let attempt = 1; attempt <= INIT_DB_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.warn(`[DB] Повтор подключения (${attempt}/${INIT_DB_RETRIES}) через ${INIT_DB_RETRY_DELAY_MS / 1000} с...`);
        await new Promise((r) => setTimeout(r, INIT_DB_RETRY_DELAY_MS));
      }
      client = postgres(connectionString, {
        max: 5,
        idle_timeout: 30,
        connect_timeout: 15,
        max_lifetime: 60 * 30,
        prepare: false,
      });
      db = drizzle(client);
      await client`SELECT 1`;
      storage = new PostgreSQLStorage();
      isStubStorage = false;
      console.log("✅ Подключение к PostgreSQL успешно.");
      try {
        await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_workspace_type text`;
        await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_company_id varchar`;
        await client`ALTER TABLE events ADD COLUMN IF NOT EXISTS company_id varchar`;
        await client`CREATE INDEX IF NOT EXISTS events_company_start_idx
          ON events (company_id, start_time)`;
        await client`UPDATE events AS event
          SET company_id = membership.company_id
          FROM (
            SELECT user_id, MIN(company_id) AS company_id
            FROM company_members
            WHERE status = 'active'
            GROUP BY user_id
            HAVING COUNT(*) = 1
          ) AS membership
          WHERE event.company_id IS NULL
            AND event.organizer_id = membership.user_id`;
      } catch (schemaErr) {
        console.warn("[DB] Не удалось обновить active workspace schema:", schemaErr);
      }
      try {
        await client`ALTER TABLE kanban_boards ALTER COLUMN company_id DROP NOT NULL`;
      } catch (schemaErr) {
        console.warn("[DB] Не удалось ослабить kanban_boards.company_id:", schemaErr);
      }
      try {
        await client`ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]'::jsonb`;
        await client`ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS label_groups jsonb DEFAULT '[]'::jsonb`;
        await client`ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS project_id text`;
        await client`ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS custom_field_values jsonb DEFAULT '{}'::jsonb`;
        await client`ALTER TABLE kanban_labels ADD COLUMN IF NOT EXISTS group_id text`;
        await client`ALTER TABLE kanban_labels ADD COLUMN IF NOT EXISTS archived_at timestamp`;
        await client`ALTER TABLE kanban_card_comments ADD COLUMN IF NOT EXISTS parent_comment_id varchar`;
        await client`ALTER TABLE kanban_card_comments ADD COLUMN IF NOT EXISTS author_name text`;
        await client`ALTER TABLE kanban_card_comments ADD COLUMN IF NOT EXISTS deleted_at timestamp`;
        await client`UPDATE kanban_card_comments AS comments
          SET author_name = COALESCE(comments.author_name, users.name, users.username, 'Удалённый пользователь')
          FROM users
          WHERE comments.user_id = users.id
            AND comments.author_name IS NULL`;
        await client`UPDATE kanban_card_comments
          SET author_name = 'Удалённый пользователь'
          WHERE author_name IS NULL`;
        await client`CREATE TABLE IF NOT EXISTS project_comments (
          id varchar PRIMARY KEY,
          project_id varchar NOT NULL,
          user_id varchar NOT NULL,
          parent_comment_id varchar,
          author_name text NOT NULL,
          content text NOT NULL,
          deleted_at timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )`;
        await client`CREATE INDEX IF NOT EXISTS project_comments_project_created_idx
          ON project_comments (project_id, created_at)`;
        await client`CREATE INDEX IF NOT EXISTS kanban_card_comments_card_created_idx
          ON kanban_card_comments (card_id, created_at)`;
      } catch (schemaErr) {
        console.warn("[DB] Не удалось обновить Kanban V2 schema:", schemaErr);
      }
      try {
        await client`CREATE TABLE IF NOT EXISTS equipment_categories (
          id varchar PRIMARY KEY,
          company_id varchar NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          parent_id varchar,
          name text NOT NULL,
          position integer NOT NULL DEFAULT 0,
          archived_at timestamptz,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )`;
        await client`CREATE INDEX IF NOT EXISTS equipment_categories_company_parent_idx
          ON equipment_categories (company_id, parent_id, position, name)`;
        await client`CREATE TABLE IF NOT EXISTS warehouse_storage_locations (
          id varchar PRIMARY KEY,
          company_id varchar NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          parent_id varchar,
          name text NOT NULL,
          code text,
          type text NOT NULL DEFAULT 'other',
          position integer NOT NULL DEFAULT 0,
          archived_at timestamptz,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )`;
        await client`CREATE INDEX IF NOT EXISTS warehouse_storage_locations_company_parent_idx
          ON warehouse_storage_locations (company_id, parent_id, position, name)`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category_id varchar`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS storage_location_id varchar`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS operability_status text`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS location_id varchar`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manual_location text`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS storage_location text`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS responsible_person text`;
        await client`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS responsible_contact text`;
        await client`ALTER TABLE equipment_checkout_requests ADD COLUMN IF NOT EXISTS kanban_card_id text`;
        await client`ALTER TABLE equipment_checkout_requests ADD COLUMN IF NOT EXISTS kanban_card_ids jsonb DEFAULT '[]'::jsonb`;
        await client`ALTER TABLE equipment_checkout_requests ADD COLUMN IF NOT EXISTS project_id varchar`;
        await client`ALTER TABLE equipment_checkout_requests ADD COLUMN IF NOT EXISTS location_id varchar`;
        await client`ALTER TABLE equipment_checkout_requests ADD COLUMN IF NOT EXISTS manual_location text`;
        await client`ALTER TABLE equipment_checkout_requests ADD COLUMN IF NOT EXISTS task_id text`;
        await client`ALTER TABLE equipment_checkout_requests ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1`;
        await client`UPDATE equipment_checkout_requests
          SET kanban_card_ids = jsonb_build_array(kanban_card_id)
          WHERE kanban_card_id IS NOT NULL
            AND (kanban_card_ids IS NULL OR kanban_card_ids = '[]'::jsonb)`;
        await client`CREATE TABLE IF NOT EXISTS equipment_context_links (
          id varchar PRIMARY KEY,
          equipment_id varchar NOT NULL,
          project_id varchar,
          kanban_card_id varchar,
          source text NOT NULL DEFAULT 'manual',
          checkout_request_id varchar,
          created_by_user_id varchar,
          active boolean NOT NULL DEFAULT true,
          ended_at timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )`;
        await client`CREATE INDEX IF NOT EXISTS equipment_context_links_equipment_active_idx
          ON equipment_context_links (equipment_id, active, created_at DESC)`;
        await client`CREATE INDEX IF NOT EXISTS equipment_context_links_project_active_idx
          ON equipment_context_links (project_id, active)
          WHERE project_id IS NOT NULL`;
        await client`CREATE INDEX IF NOT EXISTS equipment_context_links_card_active_idx
          ON equipment_context_links (kanban_card_id, active)
          WHERE kanban_card_id IS NOT NULL`;
        await client`CREATE TABLE IF NOT EXISTS equipment_comments (
          id varchar PRIMARY KEY,
          equipment_id varchar NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
          company_id varchar NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          user_id varchar NOT NULL,
          author_name text NOT NULL,
          content text NOT NULL DEFAULT '',
          attachments jsonb DEFAULT '[]'::jsonb,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )`;
        await client`ALTER TABLE equipment_comments ADD COLUMN IF NOT EXISTS company_id varchar`;
        await client`ALTER TABLE equipment_comments ADD COLUMN IF NOT EXISTS author_name text`;
        await client`ALTER TABLE equipment_comments ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb`;
        await client`UPDATE equipment_comments SET attachments = '[]'::jsonb WHERE attachments IS NULL`;
        await client`DO $equipment_comment_time_migration$
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'equipment_comments'
                AND column_name = 'created_at'
                AND data_type = 'timestamp without time zone'
            ) THEN
              ALTER TABLE equipment_comments
                ALTER COLUMN created_at TYPE timestamptz
                USING created_at AT TIME ZONE current_setting('TimeZone');
            END IF;
            IF EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'equipment_comments'
                AND column_name = 'updated_at'
                AND data_type = 'timestamp without time zone'
            ) THEN
              ALTER TABLE equipment_comments
                ALTER COLUMN updated_at TYPE timestamptz
                USING updated_at AT TIME ZONE current_setting('TimeZone');
            END IF;
          END
        $equipment_comment_time_migration$`;
        await client`CREATE INDEX IF NOT EXISTS equipment_comments_equipment_created_idx
          ON equipment_comments (equipment_id, created_at)`;
        await client`CREATE INDEX IF NOT EXISTS equipment_comments_company_created_idx
          ON equipment_comments (company_id, created_at DESC)`;
      } catch (schemaErr) {
        console.warn("[DB] Не удалось обновить equipment schema:", schemaErr);
      }
      try {
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS status text DEFAULT 'available'`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS company_id varchar`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS address text`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS notes text`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS archived_at timestamp`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS archived_by_user_id varchar`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS updated_by_user_id varchar`;
        await client`ALTER TABLE custom_locations ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`;
        await client`UPDATE custom_locations SET status = 'available' WHERE status IS NULL`;
        await client`UPDATE custom_locations SET attachments = '[]'::jsonb WHERE attachments IS NULL`;
        await client`UPDATE custom_locations SET updated_at = COALESCE(updated_at, created_at, now())`;
        await client`UPDATE custom_locations
          SET company_id = (
            SELECT id
            FROM companies
            WHERE status = 'active'
            ORDER BY created_at ASC
            LIMIT 1
          )
          WHERE company_id IS NULL
            AND (SELECT COUNT(*) FROM companies WHERE status = 'active') = 1`;
        await client`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location_id text`;
        await client`ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS location_id text`;
        await client`CREATE TABLE IF NOT EXISTS project_locations (
          id varchar PRIMARY KEY,
          project_id varchar NOT NULL,
          location_id varchar NOT NULL,
          created_at timestamp DEFAULT now()
        )`;
        await client`CREATE UNIQUE INDEX IF NOT EXISTS project_locations_project_location_unique
          ON project_locations (project_id, location_id)`;
        await client`CREATE TABLE IF NOT EXISTS kanban_card_locations (
          id varchar PRIMARY KEY,
          card_id varchar NOT NULL,
          location_id varchar NOT NULL,
          created_at timestamp DEFAULT now()
        )`;
        await client`CREATE UNIQUE INDEX IF NOT EXISTS kanban_card_locations_card_location_unique
          ON kanban_card_locations (card_id, location_id)`;
        await client`INSERT INTO kanban_card_locations (id, card_id, location_id)
          SELECT gen_random_uuid()::text, id, location_id
          FROM kanban_cards
          WHERE location_id IS NOT NULL
          ON CONFLICT (card_id, location_id) DO NOTHING`;
        await client`CREATE TABLE IF NOT EXISTS location_issues (
          id varchar PRIMARY KEY,
          location_id varchar NOT NULL,
          task_id varchar,
          kanban_card_id varchar,
          project_id varchar,
          type text NOT NULL DEFAULT 'issue',
          title text NOT NULL,
          description text NOT NULL,
          severity text DEFAULT 'medium',
          status text NOT NULL DEFAULT 'active',
          reported_by_user_id varchar NOT NULL,
          author_name text,
          photos jsonb DEFAULT '[]'::jsonb,
          resolved_at timestamp,
          resolved_by_user_id varchar,
          archived_at timestamp,
          archived_by_user_id varchar,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )`;
        await client`CREATE TABLE IF NOT EXISTS location_issue_comments (
          id varchar PRIMARY KEY,
          issue_id varchar NOT NULL,
          user_id varchar NOT NULL,
          author_name text,
          content text NOT NULL,
          attachments jsonb DEFAULT '[]'::jsonb,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )`;
        await client`ALTER TABLE location_issues ADD COLUMN IF NOT EXISTS project_id varchar`;
        await client`ALTER TABLE location_issues ADD COLUMN IF NOT EXISTS type text DEFAULT 'issue'`;
        await client`ALTER TABLE location_issues ADD COLUMN IF NOT EXISTS author_name text`;
        await client`ALTER TABLE location_issues ADD COLUMN IF NOT EXISTS resolved_at timestamp`;
        await client`ALTER TABLE location_issues ADD COLUMN IF NOT EXISTS resolved_by_user_id varchar`;
        await client`ALTER TABLE location_issues ADD COLUMN IF NOT EXISTS archived_at timestamp`;
        await client`ALTER TABLE location_issues ADD COLUMN IF NOT EXISTS archived_by_user_id varchar`;
        await client`ALTER TABLE location_issues ALTER COLUMN severity DROP NOT NULL`;
        await client`ALTER TABLE location_issues ALTER COLUMN status SET DEFAULT 'active'`;
        await client`UPDATE location_issues SET type = 'issue' WHERE type IS NULL`;
        await client`UPDATE location_issues SET status = 'active' WHERE status IN ('reported', 'in_progress')`;
        await client`UPDATE location_issues
          SET status = 'archived', archived_at = COALESCE(archived_at, updated_at, created_at, now())
          WHERE status = 'cancelled'`;
        await client`ALTER TABLE location_issues ALTER COLUMN type SET NOT NULL`;
        await client`ALTER TABLE location_issue_comments ADD COLUMN IF NOT EXISTS author_name text`;
        await client`ALTER TABLE location_issue_comments ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb`;
        await client`UPDATE location_issue_comments SET attachments = '[]'::jsonb WHERE attachments IS NULL`;
        await client`CREATE INDEX IF NOT EXISTS location_issues_location_status_idx
          ON location_issues (location_id, status, updated_at DESC)`;
        await client`CREATE INDEX IF NOT EXISTS location_issue_comments_issue_created_idx
          ON location_issue_comments (issue_id, created_at)`;
      } catch (schemaErr) {
        console.warn("[DB] Не удалось обновить custom_locations schema:", schemaErr);
      }
      try {
        await db!.select().from(users).limit(0);
      } catch (tableErr: any) {
        const tableMsg = (tableErr?.message ?? "").toLowerCase();
        if (/relation.*does not exist|table.*does not exist/.test(tableMsg)) {
          console.warn("\n⚠️  Таблица users не найдена. Выполните миграции: npm run db:push или npx drizzle-kit push\n");
        }
      }
      return;
    } catch (e: any) {
      lastError = e;
      if (client) {
        try {
          if (typeof (client as any).end === "function") await (client as any).end({ timeout: 2 });
          else if (typeof (client as any).close === "function") await (client as any).close();
        } catch (_) {}
        client = null;
        db = null;
      }
    }
  }
  const msg = lastError?.message ?? String(lastError);
  console.warn("\n⚠️  Не удалось подключиться к БД после", INIT_DB_RETRIES, "попыток — режим заглушки:", msg);
  console.warn("   Данные будут в памяти (события, задачи, схемы создаются, но не сохраняются после перезапуска).\n");
  storage = new StubStorage();
}
