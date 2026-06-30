# ADR-001: Centralized Equipment Permission Evaluator

## Status

Accepted

## Context

The Equipment module in StreamDesk requires strict access control. Users can create, edit, or reserve equipment based on a combination of their role, workspace ownership, and explicit equipment permissions. 

Evaluating these rules ad-hoc inside individual UI components and API handlers leads to duplicated logic, inconsistent behavior between the client and the server, and a high risk of functional correctness bugs. If permission checks are scattered, a change in business rules might be updated in the UI but forgotten in the API, or vice versa.

## Decision

We implemented a **centralized permission evaluation module** (located at `client/src/lib/equipment-permissions.ts` with corresponding server-side logic) that encapsulates all business rules for equipment access. 

This module provides pure functions to evaluate whether a user can perform a specific equipment action (create, edit, reserve). The UI uses these functions to toggle controls and disable invalid actions, and the server uses equivalent logic to authorize API requests before modifying any data.

### Alternatives considered

- **Scattered permission checks.** Rejected because it leads to duplicated logic and high risk of inconsistencies between client and server.
- **Database-level permissions only.** Rejected because it does not provide a good user experience; the UI needs to know permissions to render the correct state without making extra API calls.

## Consequences

### Positive

- **Single source of truth:** All equipment permission rules are defined in one place, making it easy to understand and update the business logic.
- **High testability:** The permission logic consists of pure functions that can be thoroughly unit-tested in isolation with various combinations of roles, workspaces, and explicit permissions.
- **Functional correctness:** Prevents bugs where the client and server disagree on whether an action is allowed.

### Negative

- **Maintenance overhead:** Requires maintaining two implementations (client and server) if the shared module cannot be directly imported by the server runtime, or requires careful configuration of the monorepo to share the TypeScript code seamlessly.

## Quality Requirements Addressed

- **QR-01 (Equipment Permission Correctness):** The centralized evaluator ensures that permission decisions strictly match the user's role, workspace ownership, and explicit permissions, and provides a dedicated, testable module for automated verification.