# Testing

This document describes the Assignment 4 testing strategy for issue #81.

## Critical Modules

The first critical module is `client/src/lib/equipment-permissions.ts`. It decides whether a user can create, edit, or reserve equipment. A defect here can grant the wrong inventory action or block an allowed user.

The second critical module is `client/src/components/protected-route.tsx`. It decides whether protected page content is shown, blocked, or redirected to sign-in. A defect here can expose protected pages or block valid users.

Critical modules are selected by product risk: permission checks, access control, inventory operations, user data access, and flows that many users depend on.

## Unit Tests

Unit tests cover `client/src/lib/equipment-permissions.ts` in `client/src/lib/equipment-permissions.test.ts`.

The tests verify:

- equipment super users can create, edit, and reserve equipment;
- explicit equipment permissions grant only their matching actions;
- equipment edit permission also allows reservation;
- missing, unrelated, and malformed permissions are denied.

## Integration and Component Tests

Component integration tests cover `ProtectedRoute` in `client/src/components/protected-route.test.tsx`.

The tests verify:

- anonymous users see the sign-in prompt and the login action routes to `/login`;
- users without the required permission see an access restriction;
- users with the required permission and tab access see protected content.

## QRT Mapping

| QRT | QR | Automated check |
| --- | --- | --- |
| QRT-01 | QR-01 | `npm test -- client/src/lib/equipment-permissions.test.ts` |
| QRT-02 | QR-02 | `npm test -- client/src/components/protected-route.test.tsx` |
| QRT-03 | QR-03 | `npm run coverage` |

Full details are maintained in `docs/quality-requirement-tests.md`.

## Coverage

Coverage command:

```bash
npm run coverage
```

Coverage target: the configured Vitest coverage run must complete successfully for the current critical modules and report coverage for client, server, and shared TypeScript sources configured in `vitest.config.ts`.

Coverage evidence should be taken from the `npm run coverage` output in local verification and CI. Do not claim a specific percentage unless the command was run and the reported number is copied from real output.

## Additional QA Check

The additional QA check is:

```bash
npm audit --audit-level=critical
```

The initial `npm audit --audit-level=high` check found existing dependency issues. The current CI gate uses the critical threshold to keep an automated security check without mass-updating dependencies in this Assignment 4 change.

## CI Location

The planned CI workflow location is `.github/workflows/quality.yml`.

The workflow must run:

- `npm run check`;
- `npm test`;
- `npm run coverage`;
- `npm run build`;
- `npm audit --audit-level=critical`.

## Limitations and Follow-up

The current automated tests focus on equipment permissions and protected route access control. They do not yet provide end-to-end browser coverage for complete user journeys.

Future follow-up should add tests for API routes, persistence behavior, and high-value workflows such as equipment checkout and reservation updates.
