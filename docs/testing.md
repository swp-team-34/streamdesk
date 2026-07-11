# Testing

This document describes the current maintained testing and QA evidence for StreamDesk `v3.0.0-rc.1`.

## Critical Modules and Coverage

| Critical module | Why critical | Target line coverage | Current line coverage | Evidence |
| --- | --- | ---: | ---: | --- |
| `client/src/lib/equipment-permissions.ts` | Controls equipment create, edit, and reserve permission decisions for inventory workflows. | 30% | 100% | Latest successful `Quality` workflow run on `main` (2026-07-11). |
| `client/src/components/protected-route.tsx` | Controls access to protected application areas for anonymous, unauthorized, and authorized users. | 30% | 73.33% | Latest successful `Quality` workflow run on `main` (2026-07-11). |
| `client/src/lib/task-dates.ts` | Supports calendar and task scheduling behavior, including movement, resizing, rounding, and date/time combination. | 30% | 55.71% | Latest successful `Quality` workflow run on `main` (2026-07-11). |

Critical modules are selected by product risk: permission checks, access control, inventory operations, calendar/task scheduling, user data access, and flows that many users depend on.

## Automated Test Status

| Check | Command or workflow | Current purpose | Evidence |
| --- | --- | --- | --- |
| TypeScript check | `npm run check` | Verifies TypeScript type safety across the configured project. | Passed locally on 2026-07-11 and in `Quality`. |
| Vitest test suite | `npm test` | Runs 48 unit, component, and in-process route tests across 12 files. | Passed in `Quality` on 2026-07-11. |
| Coverage | `npm run coverage` | Produces coverage output for configured client, server, and shared TypeScript sources. | Passed in `Quality` on 2026-07-11. |
| Build | `npm run build` | Verifies the production client and server build. | Passed locally on 2026-07-11 and in `Quality`. |
| Dependency audit | `npm audit --audit-level=critical` | Checks for critical dependency vulnerabilities as the additional QA gate. | `Quality` workflow. |
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

- Last checked: 2026-07-11, against `main` at `6b1265f`.
- Latest successful `Quality` run on `main`: [run from 2026-07-11](https://github.com/swp-team-34/streamdesk/actions/runs/29159929261).
- Latest successful `Link Check` run on `main`: [run from 2026-07-11](https://github.com/swp-team-34/streamdesk/actions/runs/29159929242).
- Successful `Quality` test evidence: 12 test files and 48 tests passed.
- The `Quality` coverage step completed successfully and generated the following report: 2.03% statements, 1.32% branches, 1.65% functions, and 2.04% lines across all included files. The critical-module line coverage was 100% for `equipment-permissions.ts`, 73.33% for `protected-route.tsx`, and 55.71% for `task-dates.ts`.

## Limitations and Follow-up

- Full browser end-to-end workflows are not covered.
- No coverage threshold is configured in `vitest.config.ts`; the successful `Quality` run reports 2.04% line coverage across all included files.
- The 2026-07-11 CI coverage output reports zero line coverage for several major client areas, including the client root, authentication context, hooks, forms, layout, and feature UI components.
- The two server test files invoke route handlers with in-process Express and storage; there is no separate HTTP-to-persistence integration suite.
