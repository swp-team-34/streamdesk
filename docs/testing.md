# Testing

This document describes the maintained testing and QA evidence for the final StreamDesk `v3.0.0` release.

## General Information

| Item | Value |
| --- | --- |
| Product version | `v3.0.0` |
| Verification date | 2026-07-21 |
| Tested commit | `ba7895e0eb94722a09a3696db0d81622f0888ed9` |
| Final release | [MVP v3 / `v3.0.0`](https://github.com/swp-team-34/streamdesk/releases/tag/v3.0.0) |
| Release tag commit | `5992de1e7c5d8f2dcb9a780011f896de7fa5c382` |

The tested commit is the latest `main` commit after final-release documentation merges. No test files, `package.json`, `vitest.config.ts`, workflow files, or maintained testing documents changed between the `v3.0.0` tag commit and the tested commit.

## Automated Test Types

The automated suite is run by Vitest with the shared configuration in `vitest.config.ts`.

- Unit tests cover model helpers, date/deadline rules, permission helpers, filters, sorting, cache updates, and shared utility behavior.
- React component tests run in `jsdom` with React Testing Library for protected routing, workspace controls, dashboard, warehouse, Kanban V2, locations, projects, and shared UI controls.
- Express route integration tests exercise server route handlers with in-process Express apps and mocked/in-memory storage where configured by the tests.
- HTTP/WebSocket integration tests start temporary HTTP/WebSocket infrastructure for authenticated realtime discussion transport checks.
- Shared model and utility tests cover shared calendar event types, task deadlines, UI accent values, and UI preferences.

## Covered Areas

The final test suite contains direct automated coverage for:

- authentication routing and protected route rendering;
- onboarding recovery for pending users;
- equipment permission decisions;
- active workspace selection and workspace switch flushing;
- company and personal workspace isolation in server routes and client cache handling;
- Calendar date helpers, deadlines, all-day events, timeline buffering, and timeline initialization;
- Kanban V2 board/card models, card details, filters, labels, custom fields, equipment links, list rows, and board navigation/settings controls;
- Dashboard layout helpers, operational widgets, status cards, navigation, compact spacing, and scoped layout loading;
- Warehouse equipment cards, forms, filters, checkout/return flows, pending requests, history/cart sheets, and equipment route behavior;
- equipment kits, kit composition, extraction, nested kits, active-kit approval, and kit safety routes;
- Locations and Projects models, dialogs, cards, project task stats, project edit forms, location-topic routes, and project/Kanban links;
- realtime/WebSocket session rejection, company-isolated subscriptions, and identifier-only delivery to authorized clients;
- shared UI controls and preferences, including app dialogs, theme provider, StreamSelect, multi-select, date/time/color controls, accent values, and preference routes.

This list only includes areas backed by test files and assertions in the current repository.

## Current Results

| Check | Command or workflow | Result | Evidence |
| --- | --- | --- | --- |
| Dependency installation | `npm ci` | Passed on 2026-07-21; npm reported peer/deprecation warnings and 27 non-critical audit findings during install. | Local run on tested commit. |
| TypeScript check | `npm run check` | Passed. | Local run on tested commit; latest successful [Quality run](https://github.com/swp-team-34/streamdesk/actions/runs/29692162584). |
| Vitest | `npm test` | Passed: 132 test files, 427 tests. | Local run on tested commit; latest successful [Quality run](https://github.com/swp-team-34/streamdesk/actions/runs/29692162584). |
| Coverage | `npm run coverage` | Passed: 132 test files, 427 tests; coverage report generated. | Local run on tested commit; latest successful [Quality run](https://github.com/swp-team-34/streamdesk/actions/runs/29692162584). |
| Build | `npm run build` | Passed; Vite reported existing CSS minification and large chunk warnings. | Local run on tested commit; latest successful [Quality run](https://github.com/swp-team-34/streamdesk/actions/runs/29692162584). |
| Critical dependency audit | `npm audit --audit-level=critical` | Passed with no critical vulnerabilities; 27 lower-severity findings remain. | Local run on tested commit; latest successful [Quality run](https://github.com/swp-team-34/streamdesk/actions/runs/29692162584). |
| Whitespace check | `git diff --check` | Passed before editing. | Local run on tested commit. |
| Encoding check | `python3 scripts/check-encoding.py` | Passed before editing. | Local run on tested commit. |
| Link check | `Link Check` workflow / Lychee `--config lychee.toml` | Latest workflow passed: 777 total links, 760 successful, 17 excluded, 0 errors. | Latest successful [Link Check run](https://github.com/swp-team-34/streamdesk/actions/runs/29692162581). |

Successful CI evidence is also available for the release tag commit:

- [Quality on `5992de1e7c5d8f2dcb9a780011f896de7fa5c382`](https://github.com/swp-team-34/streamdesk/actions/runs/29688023922)
- [Link Check on `5992de1e7c5d8f2dcb9a780011f896de7fa5c382`](https://github.com/swp-team-34/streamdesk/actions/runs/29688023919)

## Coverage

Overall coverage from `npm run coverage` on the tested commit:

| Metric | Coverage | Covered / Total |
| --- | ---: | ---: |
| Statements | 22.77% | 3699 / 16240 |
| Branches | 21.82% | 3274 / 14999 |
| Functions | 23.06% | 1103 / 4782 |
| Lines | 23.58% | 3405 / 14435 |

Critical-module coverage:

| Module | Statements | Branches | Functions | Lines | Why critical |
| --- | ---: | ---: | ---: | ---: | --- |
| `client/src/lib/equipment-permissions.ts` | 100% | 100% | 100% | 100% | Equipment permission decisions. |
| `client/src/components/protected-route.tsx` | 75% | 60% | 62.5% | 73.33% | Protected application access. |
| `client/src/lib/task-dates.ts` | 86.76% | 64.51% | 100% | 90.16% | Calendar and deadline date handling. |
| `client/src/lib/workspace-client.ts` | 100% | 100% | 100% | 100% | Active workspace cache switching. |
| `client/src/lib/workspace-switch.ts` | 90% | 100% | 100% | 88.88% | Autosave flush before workspace switches. |
| `client/src/lib/dashboard-layout.ts` | 89.67% | 68.42% | 91.42% | 91.17% | Dashboard layout persistence and collision handling. |
| `client/src/lib/kanban-board-model.ts` | 100% | 80% | 100% | 100% | Kanban V2 board/card model behavior. |
| `client/src/lib/equipment-kit-model.ts` | 97.05% | 68.49% | 100% | 100% | Equipment kit composition model behavior. |
| `client/src/lib/location-model.ts` | 80% | 50% | 100% | 85.71% | Location filtering, archive ordering, and topic counts. |
| `client/src/lib/project-kanban.ts` | 80% | 50% | 80% | 83.33% | Project/Kanban cache updates. |
| `client/src/lib/realtime.ts` | 17.44% | 10.22% | 14.28% | 19.44% | Realtime client state helpers; server WebSocket behavior is covered separately by integration tests. |
| `client/src/components/ui/stream-select.tsx` | 94.44% | 77.41% | 100% | 93.75% | Shared select control behavior. |

No coverage thresholds are configured in `vitest.config.ts`. The `Quality` workflow requires `npm run coverage` to complete, but it does not fail solely because total line coverage is below a numeric threshold.

The high test count does not imply high total line coverage because the coverage include list spans broad client, server, and shared source paths. Several large page components and application shell files are included in coverage but are only lightly covered or not directly rendered by the automated suite.

## Quality Requirement Test Mapping

| QRT | QR | Automated check |
| --- | --- | --- |
| [QRT-001](quality-requirement-tests.md#qrt-001-equipment-permission-unit-test) | [QR-001](quality-requirements.md#qr-001-equipment-permission-correctness) | `npm test -- client/src/lib/equipment-permissions.test.ts` |
| [QRT-002](quality-requirement-tests.md#qrt-002-protected-route-component-test) | [QR-002](quality-requirements.md#qr-002-protected-route-access-control) | `npm test -- client/src/components/protected-route.test.tsx` |
| [QRT-003](quality-requirement-tests.md#qrt-003-coverage-gate) | [QR-003](quality-requirements.md#qr-003-automated-regression-coverage) | `npm run coverage` |
| [QRT-004](quality-requirement-tests.md#qrt-004-calendar-date-helper-tests) | [QR-004](quality-requirements.md#qr-004-calendar-date-manipulation-correctness) | `npm test -- client/src/lib/task-dates.test.ts` |

Full quality requirement test details are maintained in `docs/quality-requirement-tests.md`.

## UAT

Automated tests and UAT serve different purposes. The automated suite provides repeatable regression evidence for selected code paths and integration boundaries. UAT records customer-oriented workflow validation and usability observations that are not fully represented by Vitest or route tests.

UAT scenarios are maintained in [docs/user-acceptance-tests.md](user-acceptance-tests.md). This update does not edit that file. Current documentation inconsistencies found during this review:

- `docs/user-acceptance-tests.md` contains scenarios marked `Status: Passed` while the `Execution result` is still `To be filled`.
- `docs/quality-requirements.md` and `docs/quality-requirement-tests.md` still mention `v3.0.0-rc.1`, while this document now tracks final `v3.0.0` evidence.

## Link Checking

Lychee runs through `.github/workflows/lychee.yml` on pull requests, pushes to `main`, and manual workflow dispatch. The workflow uses:

```bash
lychee --config lychee.toml .
```

The `lychee.toml` file contains narrow URL and path exclusions. Excluded links must be manually verified and justified before submission when they are relevant to a change.

## Limitations

- There is no full browser E2E suite for complete user journeys.
- Production database integration is not covered by the automated suite.
- Deployment E2E is not automated.
- Load and performance testing are not automated.
- Accessibility testing is limited to component-level behavior where covered by assertions; there is no full accessibility audit suite.
- Manual testing remains necessary for drag-and-drop behavior, scrolling feel, browser rendering differences, responsive layout review, production environment verification, and other workflows that depend on real browser behavior.

This document does not claim that StreamDesk is fully tested. It records the maintained automated and CI evidence available for the final `v3.0.0` release.
