# ADR-004: Authenticated Scoped Realtime Transport

## Status

Accepted

## Context

StreamDesk already used `/ws` for periodic widget and card refreshes, but connections were not authenticated during upgrade and each mounted consumer could create its own socket. Sprint 5 discussions require project, Kanban V2 card, Location, and equipment events without exposing records across companies or turning WebSocket payloads into a second source of application state.

The transport must remain usable during temporary realtime outages, preserve existing HTTP workflows, recover missed state after reconnect, and avoid unbounded listeners, timers, subscriptions, or duplicate UI updates.

## Decision

We use one shared browser WebSocket transport and authenticate every `/ws` upgrade through the existing `express-session` cookie. The server resolves the session user before accepting the connection.

Discussion subscriptions use explicit resource channels. The server rechecks access before joining company, project, Kanban V2 card, Location, or equipment scopes. Subscribing never grants mutation permission: all writes continue through the existing authorized HTTP routes and persisted storage remains the source of truth.

Realtime events contain only channel, event ID, action, record ID, version, and occurrence time. Clients invalidate and refetch the affected React Query state. Reconnect uses bounded exponential backoff and refetches subscribed discussions after uncertainty. Event IDs are retained in a bounded client set to suppress duplicate delivery.

The server caps each connection at 100 subscriptions and uses shared refresh and ping timers. Client subscriptions and listeners are reference-counted and removed when their consumers unmount.

### Alternatives considered

- **Keep one WebSocket per component.** Rejected because navigation and nested screens can multiply sockets, timers, and duplicate refreshes.
- **Send full comments and update client state directly from WebSocket payloads.** Rejected because missed or out-of-order events would create an independent, inconsistent state path and expose unnecessary content.
- **Use polling only.** Rejected because discussion counts and new replies should update promptly across simultaneous sessions, while HTTP remains the fallback.
- **Use Server-Sent Events.** Rejected because the existing stack already depends on the proven `ws` library and requires client subscription changes over the same connection.

## Consequences

### Positive

- WebSocket access follows the same authenticated session boundary as REST.
- Company and resource isolation is enforced before event delivery.
- HTTP mutations continue to work while realtime delivery is unavailable.
- Duplicate and missed events converge through bounded deduplication and refetch.
- Existing global refresh behavior shares one client connection and bounded server lifecycle resources.

### Negative

- Reconnect and event delivery can cause additional read requests because clients refetch authoritative state.
- The in-process subscription registry is suitable for the current single-node deployment; horizontal scaling would require a shared pub/sub layer and compatible shared session storage.
- The 100-channel limit requires future high-volume screens to prefer aggregated company or board channels if their visible scope grows substantially.

## Quality Requirements Addressed

- **QR-002 (Protected Access Control):** Session authentication and server-side scope checks prevent unauthorized realtime reads.
- **QR-003 (Automated Regression Coverage):** Automated tests cover authentication rejection, company isolation, unauthorized subscriptions, reconnect/refetch helpers, and duplicate-event suppression.
