# Quality Requirements

This document defines measurable quality requirements for Assignment 4, issue #81.

## QR-01 Equipment Permission Correctness

- ISO/IEC 25010 characteristic: Functional suitability.
- ISO/IEC 25010 sub-characteristic: Functional correctness.
- Scenario: when equipment create, edit, and reserve decisions are evaluated for a user, the decision must match the user's role, workspace ownership, and explicit equipment permissions.
- Pass condition: `npm test` passes the automated permission tests in `client/src/lib/equipment-permissions.test.ts`.
- Rationale: equipment actions affect inventory integrity and must not be granted or denied incorrectly.
- Traceability: #81.
- Verification: QRT-01.

## QR-02 Protected Route Access Control

- ISO/IEC 25010 characteristic: Security.
- ISO/IEC 25010 sub-characteristic: Authenticity.
- Scenario: when a protected page is rendered, anonymous users must be sent to sign in, users without the required permission must see an access restriction, and authorized users must see the protected content.
- Pass condition: `npm test` passes the protected route component tests in `client/src/components/protected-route.test.tsx`.
- Rationale: users must not access protected application areas without a valid authenticated identity and required permissions.
- Traceability: #81.
- Verification: QRT-02.

## QR-03 Automated Regression Coverage

- ISO/IEC 25010 characteristic: Maintainability.
- ISO/IEC 25010 sub-characteristic: Testability.
- Scenario: every change submitted through CI must run automated tests with coverage reporting for the configured client, server, and shared TypeScript sources.
- Pass condition: `npm run coverage` completes successfully and publishes a coverage summary for the configured source set.
- Rationale: maintainers need repeatable automated evidence that critical permission and access-control behavior remains testable over time.
- Traceability: #81.
- Verification: QRT-03.
