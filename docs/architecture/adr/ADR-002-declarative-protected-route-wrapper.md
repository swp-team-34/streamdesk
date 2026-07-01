# ADR-002: Declarative Protected Route Wrapper

## Status

Accepted

## Context

StreamDesk has multiple pages and areas that require authentication and specific permissions. Checking authentication state and permissions imperatively inside every individual page component results in boilerplate code, inconsistent user experiences, and a high risk of developers forgetting to secure a newly added route.

## Decision

We implemented a **centralized `ProtectedRoute` wrapper component** located at `client/src/components/protected-route.tsx`. 

This component is used in the routing configuration to declaratively guard routes. It intercepts the rendering process to check authentication status and verify required permissions (including tab-level permissions through `tabPermission`). 

Instead of automatically redirecting anonymous users, it **blocks anonymous users with a sign-in prompt and routes them to the sign-in page when they click the login action**. Users without the required permission see a consistent access restriction view, and authorized users see the protected content.

### Alternatives considered

- **Imperative checks inside page components.** Rejected because it leads to boilerplate, inconsistent UX, and makes it easy to forget to secure a new route.
- **Automatic redirect for anonymous users.** Rejected because showing a clear sign-in prompt with an action button provides a better user experience and avoids disorienting redirect loops.

## Consequences

### Positive

- **Consistent security and UX:** Ensures a uniform experience across all protected areas. Anonymous users see a clear prompt, and unauthorized users see a consistent access restriction view.
- **Clean page components:** Page components remain focused solely on their specific UI logic without being cluttered by authentication and authorization checks.
- **High testability:** The routing guard logic is isolated in a single component and can be easily unit-tested with mocked auth states and permissions.

### Negative

- **Abstraction layer:** Adds a layer of abstraction to the routing configuration. Complex permission checks that depend on deeply nested route parameters might require additional context to be passed to the wrapper.

## Quality Requirements Addressed

- **QR-002 (Protected Route Access Control):** The declarative wrapper ensures that protected pages correctly handle anonymous users (by blocking them with a sign-in prompt), unauthorized users (by showing an access restriction), and authorized users (by rendering the protected content), including tab-level permission checks.
