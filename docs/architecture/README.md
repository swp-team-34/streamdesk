# StreamDesk Architecture

StreamDesk is a workflow management system for production teams involved in broadcasting and streaming. The project is a monorepo with a React frontend and a Node backend.js/Express, which uses PostgreSQL for data storage.

## Architecture Overview

StreamDesk follows a client-server architecture with a REST API and WebSocket for real-time updates. The frontend is built on React 18 with TypeScript, uses Vite for assembly and TanStack Query to manage the server status. The backend is implemented on Express with TypeScript, uses the Drizzle ORM to work with PostgreSQL and Passport for authentication.

The project has a modular structure divided into:
- **client/** — React application with pages, components and utilities
- **server/** — Express API with routes, services, and integrations
- **shared/** — common TypeScript schemas and data types

## Static View

The static view shows the main components of the system and their interactions.

![Component Diagram](./static-view/component-diagram.svg)

### Components description

**Frontend (React Application)**
- **Pages** — 29 application pages, each corresponding to a specific functional module (dashboard, tasks, equipment, streams, monitoring, etc.)
- **Components** — reusable UI components based on Radix UI and Tailwind CSS
- **Lib** — client utilities, hooks, and auxiliary functions
- **State Management** — TanStack Query for the server state, React Context for the global client state

**Backend (Express API)**
- **Routes** — REST API endpoints for all entities (kanban, tasks, equipment, events, streams, etc.)
- **Services** — business logic and integration with external services (YouGile, Hugging Face, Telegram, WhisperX)
- **Auth** — authentication via Passport Local and Telegram OAuth
- **Database** — Drizzle ORM for working with PostgreSQL
- **WebSocket Server** — real-time updates for systems, streams, tasks and events

**Database (PostgreSQL)**
- **Schema** — defined in `shared/schema.ts` using Drizzle ORM
- **Tables** — users, companies, tasks, projects, kanban boards, equipment, events, streams, systems, chat sessions, integrations with YouGile and others

**External Services**
- **YouGile** — sync tasks and kanban boards
- **Hugging Face** — AI assistants for estimates and connection diagrams
- **Telegram Bot** — notifications and messenger integration
- **vMix/OBS** — monitoring and control of on-air equipment
- **YouTube/VK** — getting stream statistics

### Coupling и Cohesion

**Coupling:**
- Frontend and Backend are connected via HTTP REST API and WebSocket connections
- Weak connectivity between services — each service is independent and can be replaced
- The database is abstracted through the Drizzle ORM, which allows you to change the DBMS without changing the business logic
- External integrations are encapsulated in separate services, which reduces connectivity to the main code.

**Cohesion:**
- High cohesion within the modules — each service is responsible for one area (YouGile sync, Telegram bot, document generator)
- The frontend pages correspond to the functional modules of the backend
- Common types and schemas are rendered in `shared/`, which ensures consistency between the client and the server

### Maintainability Implications

**Positive aspects:**
- Modular structure makes it easy to add new functional modules
- Separation into client/server/shared simplifies code navigation
- Using TypeScript ensures type safety and simplifies refactoring
- Drizzle ORM makes it easy to change the database schema through migrations

**Problem areas:**
- Multiple pages (29) and API endpoints (50+) create a high cognitive load
- Three versions of tasks (tasks, tasks-v2, tasks-yougile) indicate evolution without full migration
- Lack of an explicit layer of services on the backend — business logic is mixed with routes
- Direct calls to external APIs from routes create strict dependencies

**Recommendations:**
- Separate the business logic from the routes into separate services
- Consolidate three versions of tasks into a single architecture
- Add a repository layer for abstraction of working with the database

### Quality Requirements Support

The static architecture supports the following quality requirements:

TODO

## Dynamic View

The dynamic view shows how the components interact over time in a typical scenario.

![Sequence Diagram](./dynamic-view/sequence-diagram.svg)

### Scenario: Creating and managing a task in a kanban board

This scenario was chosen because it:
1. Is the main user workflow — task management is a key function of the system
2. Involves several components — frontend, API, DATABASE, WebSocket for real-time updates
3. Illustrates important architectural solutions — using TanStack Query for caching, WebSocket for synchronization between clients

**Sequence of actions:**

1. **The user creates a task** on the kanban board page
2. **Frontend** sends a POST request to `/api/kanban/cards` with the task data
3. **Express API** validates data via Zod, verifies access rights via session
4. **Database layer** inserts a task into PostgreSQL via the Drizzle ORM
5. **API returns** the created task with the ID and timestamps
6. **TanStack Query** disables the kanban board cache and updates the UI
7. **WebSocket Server** detects the change and sends `tasks_update` to all connected clients
8. **Other customers** receive updates and upgrade their kanban boards in real-time

**Architectural solutions that illustrate this scenario:**

- **Client-side caching** — TanStack Query caches data on the client, reducing the load on the server
- **Optimistic updates** — The UI is updated until a response is received from the server to improve the UX
- **Real-time synchronization** — WebSocket ensures data consistency between all connected clients
- **Separation of concerns** — API-level validation, business logic in services, DATABASE persistence

**Quality requirements that are supported:**

- **Time behavior (QR-001)** — caching and optimistic updates ensure a fast UI response
- **Fault tolerance (QR-004)** — if WebSocket is unavailable, data is synced via REST API anyway
- **Interoperability (QR-007)** — standard REST endpoints allow integration with other systems

## Deployment View

The deployment view shows where the system components are physically located and how users access them.

![Deployment Diagram](./deployment-view/deployment-diagram.svg)

### Deployment description

**Production Environment:**
- **Web Server (Nginx)** — reverse proxy, serves static frontend files and proxies API requests to Node.js server
- **Node.js Application (PM2)** — Express server is running via PM2 process manager for automatic restart and logging
- **PostgreSQL Database** — the main database, can be deployed locally or in the cloud (Neon Serverless)
- **SSL/TLS** — HTTPS via Let's Encrypt certificates, the paths to which are specified in the environment variables

**Development Environment:**
- **Vite Dev Server** — hot module replacement for the front-end
- **tsx** — TypeScript execution for backend with automatic reboot
- **Local PostgreSQL** — local database for development

**External Services:**
- **YouGile API** — external task management system, scheduled synchronization (every 2 minutes)
- **Hugging Face Inference API** — AI models for generating estimates and diagrams
- **Telegram Bot API** — sending notifications and integration with messenger
- **vMix/OBS** — local broadcast equipment available via a local network

### Why is this deployment model chosen

**Advantages:**
- **Simplicity** — Monolithic deployment simplifies deployment and debugging for a 3-person team
- **Cost—effective** - one VPS server is cheaper than a microservice architecture
- **PM2** — provides automatic crash restart, logging and monitoring
- **Nginx** — efficient handling of static files and SSL termination

**Restrictions:**
- **Single point of failure** — Node crash.the js server makes the entire system inaccessible
- **Scalability** — vertical scaling is limited by the resources of a single server
- **Deploy downtime** — the update requires a restart of the server, which causes a simple

**What to consider during operation:**
- Regular monitoring via PM2 and application logs
- PostgreSQL database backups
- Monitoring of memory and CPU usage
- Migration plan for microservices with increasing workload

### Quality requirements support

TODO

## Architecture Decision Records

Architectural decisions are documented in [ADR](./adr/) and explain why certain technical decisions were made.

Main solutions:
TODO

## The relationship between architecture and quality requirements

The StreamDesk architecture is designed with the following quality requirements in mind:

TODO

Each architectural solution (ADR) is directly linked to one or more quality requirements, which ensures traceability from requirements to implementation.