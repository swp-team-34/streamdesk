# Quality Requirement Tests

This document maps Assignment 4 quality requirements from issue #81 to automated quality requirement tests.

## QRT-01 Equipment Permission Unit Test

- Related QR: QR-01.
- Test type: Unit test.
- Test file path: `client/src/lib/equipment-permissions.test.ts`.
- CI job/check: `npm test`.
- Procedure: run `npm test -- client/src/lib/equipment-permissions.test.ts` or the full `npm test` command.
- Pass condition: all equipment permission test cases pass.

## QRT-02 Protected Route Component Test

- Related QR: QR-02.
- Test type: Component integration test.
- Test file path: `client/src/components/protected-route.test.tsx`.
- CI job/check: `npm test`.
- Procedure: run `npm test -- client/src/components/protected-route.test.tsx` or the full `npm test` command.
- Pass condition: anonymous, unauthorized, and authorized protected-route scenarios all pass.

## QRT-03 Coverage Gate

- Related QR: QR-03.
- Test type: Coverage run.
- Test file path: `client/src/lib/equipment-permissions.test.ts`; `client/src/components/protected-route.test.tsx`.
- CI job/check: `npm run coverage`.
- Procedure: run `npm run coverage`.
- Pass condition: Vitest coverage completes successfully and reports coverage for the configured source set.
