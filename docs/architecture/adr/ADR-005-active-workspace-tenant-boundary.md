# ADR-005: Validated Active Workspace Tenant Boundary

## Status

Accepted

## Context

StreamDesk users can belong to multiple companies and can also keep personal Kanban V2 boards, Calendar events, and projects. Previously, ordinary API routes could aggregate all active memberships, platform or company administrators could receive global data, and some creation paths silently selected the first membership. This allowed records to be exposed or assigned across company boundaries.

A visual company selector is insufficient because direct REST requests, Dashboard aggregates, autosave, realtime subscriptions, and stale client caches must enforce the same boundary.

## Decision

Every authenticated request resolves one active workspace from the session and the user's persisted preference:

- a user with one active company enters it automatically;
- a user with multiple active companies must choose a company or personal workspace;
- the last still-authorized choice is restored;
- platform administrators explicitly choose a company for ordinary product screens;
- cross-company access remains limited to dedicated `/api/platform/*` routes and the platform-admin interface.

The server treats the resolved workspace as an authorization boundary. Company records must match the selected company. Personal records have no company and remain limited by owner, assignee, participant, or board membership rules. Client-supplied company identifiers never select the tenant for a mutation.

Workspace switching flushes registered autosaves, resets feature state by remounting the workspace shell, clears React Query data, and reconnects the WebSocket transport. Company-only navigation is hidden in personal workspace.

Existing Calendar rows receive a company only when their organizer has exactly one active company. Records with missing or ambiguous company ownership remain excluded from company screens until they can be assigned safely.

### Alternatives considered

- **Aggregate every company membership.** Rejected because ordinary screens would combine tenants and make authorization dependent on client filtering.
- **Trust a company ID sent with each request.** Rejected because callers could select another company directly.
- **Use only a client-side selector.** Rejected because REST, realtime, background refreshes, and stale caches would remain cross-company paths.
- **Give platform administrators a global bypass in ordinary screens.** Rejected because global administration and normal company work have different privacy boundaries.

## Consequences

### Positive

- REST reads, writes, Dashboard aggregates, and realtime subscriptions share one tenant boundary.
- New records inherit the selected workspace and no longer use first-membership fallbacks.
- Personal Kanban V2, Calendar, and Projects remain separate from corporate work.
- Platform administration remains possible without weakening ordinary product screens.
- Workspace switching removes stale cached records and subscriptions.

### Negative

- Existing ambiguous records are hidden until safely assigned.
- Route-local legacy modules still require gradual migration to dedicated domain services.
- Switching workspaces causes additional refetches because caches are cleared rather than shared across tenants.

## Quality Requirements Addressed

- **QR-002 (Protected Access Control):** Server-side membership, active-company, direct-record, and realtime checks prevent cross-tenant access.
- **QR-003 (Automated Regression Coverage):** Tests cover multiple companies, personal records, persisted selection, direct access denial, cache/realtime reset, and authenticated WebSocket isolation.
