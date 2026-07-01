# Testing

This document describes the current maintained testing and QA evidence for StreamDesk MVP v2.

## Critical Modules and Coverage

| Critical module | Why critical | Required line coverage | Current line coverage | Evidence |
| --- | --- | ---: | ---: | --- |
| `client/src/lib/equipment-permissions.ts` | Controls equipment create, edit, and reserve permission decisions for inventory workflows. | 30% | 100% | Local `npm run coverage` output and latest protected `Quality` workflow run on `main`. |
| `client/src/components/protected-route.tsx` | Controls access to protected application areas for anonymous, unauthorized, and authorized users. | 30% | 73.33% | Local `npm run coverage` output and latest protected `Quality` workflow run on `main`. |
| `client/src/lib/task-dates.ts` | Supports MVP v2 calendar and task scheduling behavior, including movement, resizing, rounding, and date/time combination. | 30% | 55.71% | Local `npm run coverage` output and latest protected `Quality` workflow run on `main`. |

Critical modules are selected by product risk: permission checks, access control, inventory operations, calendar/task scheduling, user data access, and flows that many users depend on.

## Automated Test Status

| Check | Command or workflow | Current purpose | Evidence |
| --- | --- | --- | --- |
| TypeScript check | `npm run check` | Verifies TypeScript type safety across the configured project. | `Quality` workflow and local verification before completion. |
| Unit tests | `npm test` | Runs Vitest unit tests for isolated product logic such as equipment permissions and task date helpers. | `Quality` workflow and local verification before completion. |
| Component/integration tests | `npm test` | Runs Vitest component tests such as `ProtectedRoute`. | `Quality` workflow and local verification before completion. |
| Coverage | `npm run coverage` | Produces coverage output for configured client, server, and shared TypeScript sources. | `Quality` workflow and local verification before completion. |
| Build | `npm run build` | Verifies the production client and server build. | `Quality` workflow and local verification before completion. |
| Dependency audit | `npm audit --audit-level=critical` | Checks for critical dependency vulnerabilities as the additional QA gate. | `Quality` workflow and local verification before completion. |
| Link checking | `Link Check` workflow | Runs Lychee against repository links using `lychee.toml`. | GitHub Actions link-check workflow. |

## Quality Requirement Test Mapping

| QRT | QR | Automated check |
| --- | --- | --- |
| [QRT-001](quality-requirement-tests.md#qrt-001-equipment-permission-unit-test) | [QR-001](quality-requirements.md#qr-001-equipment-permission-correctness) | `npm test -- client/src/lib/equipment-permissions.test.ts` |
| [QRT-002](quality-requirement-tests.md#qrt-002-protected-route-component-test) | [QR-002](quality-requirements.md#qr-002-protected-route-access-control) | `npm test -- client/src/components/protected-route.test.tsx` |
| [QRT-003](quality-requirement-tests.md#qrt-003-coverage-gate) | [QR-003](quality-requirements.md#qr-003-automated-regression-coverage) | `npm run coverage` |
| [QRT-004](quality-requirement-tests.md#qrt-004-calendar-date-helper-tests) | [QR-004](quality-requirements.md#qr-004-calendar-date-manipulation-correctness) | `npm test -- client/src/lib/task-dates.test.ts` |

Full quality requirement test details are maintained in `docs/quality-requirement-tests.md`.

## Additional QA Checks

The additional QA check beyond Lychee is:

```bash
npm audit --audit-level=critical
```

Lychee is a link-checking CI gate. It does not count as the additional QA check and does not count as a QRT unless it is directly linked to a measurable quality requirement.

## Link Checking

Lychee runs through `.github/workflows/lychee.yml` on pull requests, pushes to `main`, and manual workflow dispatch.

The `lychee.toml` file contains narrow URL and path exclusions. Excluded links must be manually verified and justified before submission. This document does not claim manual verification of excluded links unless that evidence is recorded in the PR or linked workflow evidence.

## CI and QA Check Status

- Latest protected-default-branch `Quality` run: [successful `main` run from 2026-07-01](https://github.com/swp-team-34/streamdesk/actions/runs/28548554181).
- Latest protected-default-branch `Link Check` run: [successful `main` run from 2026-07-01](https://github.com/swp-team-34/streamdesk/actions/runs/28548554209).
- Local coverage evidence: `npm run coverage` passed with 3 test files and 13 tests; line coverage was 100% for `equipment-permissions.ts`, 73.33% for `protected-route.tsx`, and 55.71% for `task-dates.ts`.

## Limitations and Follow-up

- Full browser end-to-end workflows are not covered.
- Server-side equipment checkout approval and rejection flows need additional tests if they become part of the protected Sprint 3 completion evidence.
- Kanban creation server validation, persistence, and realtime updates need additional tests.
- Calendar event participant and notification side effects need additional tests.
- API route and persistence integration tests are recommended as the next major automated testing step.
