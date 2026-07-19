# ADR-006: Split Client-Server Architecture

## Status

Supersedes: [ADR-003](ADR-003-unified-monorepo-coverage.md)
Accepted

## Context

The StreamDesk codebase previously existed as a more monolithic structure. As the project scaled to include complex frontend orchestration (Task Manager, Calendar, Warehouse) and distinct backend responsibilities (REST APIs, WebSocket gateway, YouGile sync, and Postgres connections), maintaining all code in a single unified structure became difficult. 
A human developer recently refactored the codebase, splitting the code into a more modular monorepo structure with distinct `client`, `server`, and `shared` directories.

## Decision

We have adopted a modular monorepo architecture, organized as follows:
- `client/`: Contains the React + TypeScript single-page application.
- `server/`: Contains the Node.js + Express REST API and WebSocket gateway.
- `shared/`: Contains common TypeScript types and Zod validation schemas shared between the client and server.

The root `package.json` orchestrates the build process using Vite for the client and esbuild for the server, effectively decoupling the frontend and backend build pipelines while keeping them in the same repository.

## Consequences

### Positive
- **Clear Separation of Concerns:** Frontend and backend logic are strictly separated, improving maintainability and reducing accidental coupling.
- **Independent Build Tools:** The client can leverage Vite for fast HMR and optimized frontend builds, while the server uses esbuild for rapid Node.js bundling.
- **Type Safety Across Boundaries:** The `shared/` directory ensures that API contracts and validation schemas remain consistent across both ends of the stack.

### Negative
- **Build Complexity:** The root package.json now has to coordinate multiple build tools (Vite and esbuild) rather than a single process.
- **Dependency Management:** Care must be taken to ensure dependencies are properly scoped (e.g., frontend dependencies do not bleed into the server bundle).

## Quality Requirements Addressed

- **QR-003 (Automated Regression Coverage):** Adapts the coverage boundaries to explicitly respect the new client, server, and shared module domains.
- **QR-004 (Calendar date manipulation correctness):** Supports isolating complex domain logic into shared or client-specific modules.
