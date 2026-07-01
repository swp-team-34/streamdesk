# ADR-001: Centralized Equipment Permission Evaluator

## Status

Accepted

## Context

The Equipment module in StreamDesk requires strict access control. Users can create, edit, or request checkout of equipment based on a combination of their role, workspace ownership, and explicit equipment permissions. 

Evaluating these rules ad-hoc inside individual UI components leads to duplicated logic, inconsistent user experiences, and a high risk of functional correctness bugs. If permission checks are scattered, a change in business rules might be updated in one place but forgotten in another.

## Decision

We implemented a **centralized client-side permission evaluation module** located at `client/src/lib/equipment-permissions.ts`. It provides pure functions for checking whether a user can create, edit, or reserve equipment, and the Equipment UI uses these functions to show, hide, or disable controls.

Server-side authorization is currently enforced in route handlers using workspace access checks, company-management checks, and request-specific guards. The server logic should be kept aligned with the client evaluator, but it is not yet implemented as the same shared centralized module.

### Alternatives considered

- **Scattered permission checks.** Rejected because it leads to duplicated logic and high risk of inconsistencies.
- **Database-level permissions only.** Rejected because it does not provide a good user experience; the UI needs to know permissions to render the correct state without making extra API calls.

## Consequences

### Positive

- **Client-side permission behavior is easier to understand:** All equipment permission rules are defined in one place on the client.
- **UI controls are consistent:** The Equipment UI reliably shows, hides, or disables controls based on the centralized evaluator.
- **High testability:** The pure client-side permission functions can be thoroughly unit-tested in isolation with various combinations of roles, workspaces, and explicit permissions.

### Negative

- **Server-side equipment authorization is still partly route-local:** This creates a risk that client-side gating and API enforcement can drift over time.
- **Maintenance overhead:** Requires manual alignment between the client-side evaluator and the server-side route handlers.

## Follow-up

A future refactor should extract server-side equipment authorization into a shared or mirrored evaluator and cover it with tests to eliminate the risk of drift.

## Quality Requirements Addressed

- **QR-01 (Equipment Permission Correctness):** The centralized client-side evaluator ensures that UI permission decisions strictly match the user's role, workspace ownership, and explicit permissions, and provides a dedicated, testable module for automated verification. Server-side route-local checks enforce the same rules at the API boundary.