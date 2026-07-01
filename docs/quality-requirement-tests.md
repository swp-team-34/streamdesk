# Quality Requirement Tests

This document maps maintained StreamDesk MVP v2 quality requirements to automated quality requirement tests.

| Evidence type | What it means | Can it count as QRT? |
| --- | --- | --- |
| Quality requirement | Measurable non-functional product requirement with `QR-NNN` ID. | No |
| QRT | Automated test or CI check with `QRT-NNN` ID that directly verifies a measurable QR scenario. | Yes |
| Unit test | Automated test for isolated product logic or a small module. | Only if linked to a measurable QR scenario. |
| Integration/component test | Automated test for interaction between components or a UI/state boundary. | Only if linked to a measurable QR scenario. |
| UAT | Customer-executed end-user scenario. | No |
| Manual evidence | Observation, review, screenshot, or exploratory check. | No |
| Lychee link check | Automated repository link validation. | No, unless tied to a specific measurable QR. |

## QRT-001: Equipment permission unit test

**Linked quality requirement:** [QR-001](quality-requirements.md#qr-001-equipment-permission-correctness)

**Verification method:** Automated unit tests executed by Vitest.

**Test data, setup, or environment:** Mocked user roles, workspace ownership modes, and explicit equipment permission combinations executed in the standard Vitest CI environment.

**Automated command or CI check:** `npm test -- client/src/lib/equipment-permissions.test.ts`; also covered by the `Quality` GitHub Actions workflow through `npm test`.

**Expected measurable result:** All equipment permission test cases pass and permission decisions match the expected outcome for every tested role, workspace, and permission combination.

**Evidence location:** Latest protected-default-branch `Quality` workflow run and `client/src/lib/equipment-permissions.test.ts`.

## QRT-002: Protected route component test

**Linked quality requirement:** [QR-002](quality-requirements.md#qr-002-protected-route-access-control)

**Verification method:** Automated component tests executed by Vitest with React Testing Library.

**Test data, setup, or environment:** Mocked authentication states and permission combinations covering anonymous users, users without the required permission, and authorized users in the standard Vitest CI environment.

**Automated command or CI check:** `npm test -- client/src/components/protected-route.test.tsx`; also covered by the `Quality` GitHub Actions workflow through `npm test`.

**Expected measurable result:** All protected-route test cases pass. Anonymous users are blocked with a sign-in prompt, unauthorized users see an access restriction, and authorized users see protected content.

**Evidence location:** Latest protected-default-branch `Quality` workflow run and `client/src/components/protected-route.test.tsx`.

## QRT-003: Coverage gate

**Linked quality requirement:** [QR-003](quality-requirements.md#qr-003-automated-regression-coverage)

**Verification method:** Automated Vitest coverage run.

**Test data, setup, or environment:** Repository test suite executed with the configured Vitest coverage provider for client, server, and shared TypeScript source paths.

**Automated command or CI check:** `npm run coverage`; also covered by the `Quality` GitHub Actions workflow.

**Expected measurable result:** Vitest coverage completes successfully and produces coverage output for the configured client, server, and shared TypeScript source set before the change is considered Done.

**Evidence location:** Latest protected-default-branch `Quality` workflow run, `vitest.config.ts`, and local coverage output recorded in PR verification notes.

## QRT-004: Calendar date helper tests

**Linked quality requirement:** [QR-004](quality-requirements.md#qr-004-calendar-date-manipulation-correctness)

**Verification method:** Automated unit tests executed by Vitest.

**Test data, setup, or environment:** Fixed JavaScript `Date` values covering quarter-hour option generation, date/time combination, rounding, invalid range normalization, range movement, and minimum-duration resizing.

**Automated command or CI check:** `npm test -- client/src/lib/task-dates.test.ts`; also covered by the `Quality` GitHub Actions workflow through `npm test`.

**Expected measurable result:** All date-helper tests pass. The helper returns the expected quarter-hour options, combines date/time correctly, rounds to the expected quarter-hour boundary, preserves moved range duration, normalizes invalid ranges, and enforces the minimum duration.

**Evidence location:** Latest protected-default-branch `Quality` workflow run and `client/src/lib/task-dates.test.ts`.
