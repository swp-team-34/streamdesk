# ADR-002: Declarative Protected Route Wrapper

## Status

Accepted

## Context

StreamDesk has multiple pages and areas that require authentication and specific permissions. Checking authentication state and permissions imperatively inside every individual page component results in boilerplate code, inconsistent user experiences (e.g., flashing protected content before redirecting), and a high risk of developers forgetting to secure a newly added route.

## Decision

We implemented a **centralized `ProtectedRoute` wrapper component** (located at `client/src/components/protected-route.tsx`). 

This component is used in the routing configuration to declaratively guard routes. It intercepts the rendering process to check authentication status, verify required permissions, and redirect anonymous users to the sign-in page or unauthorized users to an access restriction view *before* the protected content is ever rendered.

### Alternatives considered

- **Imperative checks inside page components.** Rejected because it leads to boilerplate, inconsistent UX (content flashing), and makes it easy to forget to secure a new route.
- **Middleware-only protection (server-side).** Rejected because it does not protect the client-side routing; users could still navigate to the URL and see a blank screen or an error before the server rejects the API call.

## Consequences

### Positive

- **Consistent security and UX:** Ensures a uniform experience across all protected areas. Anonymous users are seamlessly redirected to sign-in, and unauthorized users see a consistent access restriction view.
- **Clean page components:** Page components remain focused solely on their specific UI logic without being cluttered by authentication and authorization checks.
- **High testability:** The routing guard logic is isolated in a single component and can be easily unit-tested with mocked auth states and permissions.

### Negative

- **Abstraction layer:** Adds a layer of abstraction to the routing configuration. Complex permission checks that depend on deeply nested route parameters or asynchronous data fetching might require additional context to be passed to the wrapper.

## Quality Requirements Addressed

- **QR-02 (Protected Route Access Control):** The declarative wrapper ensures that protected pages correctly handle anonymous users, unauthorized users, and authorized users, providing a consistent and testable access control mechanism.