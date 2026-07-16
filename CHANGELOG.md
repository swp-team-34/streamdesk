# Changelog

All notable user-visible changes to this project must be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
uses a SemVer-compatible release structure. Until the next release is tagged,
changes are collected under `Unreleased`.

## [Unreleased]

### Added

- Added expandable Warehouse kit composition with component status, warnings, direct details navigation, add/remove controls, composition history, and support for nested kits with cycle prevention.
- Added attributable threaded comments and replies for projects and Kanban V2 cards, including realtime counts, latest-activity indicators, reconnect states, and preserved historical authorship.
- Added an authenticated, permission-scoped WebSocket transport with bounded subscriptions, reconnect/refetch recovery, duplicate-event protection, and HTTP/storage as the source of truth.
- Added company-scoped Location topics with note/problem types, severity, replies, safe file attachments, resolve/reopen/archive lifecycle, optional Kanban V2/project links, realtime refresh, and compact summaries in related work and Dashboard views.

### Fixed

- Fixed kit component take, request, transfer, project assignment, approval, delete, and return paths with server-enforced extraction, parent-kit return guidance, safe disassembly on kit deletion, orphan-link recovery, active-kit manager escalation, and override auditing.
- Added company-scoped Location workspaces with maintained address/context, notes, files, update audit details, reversible archiving, archive filters, and active-link confirmation.
- Added bidirectional many-to-many Location links for Kanban V2 cards and projects, including reverse navigation, archived-link preservation, and high-severity venue warnings.

## [v3.0.0-rc.1] - 2026-07-11

### Added

- Added draggable, resizable, and hideable Dashboard widgets with persisted browser layout.
- Added Dashboard follow-up widgets for overdue tasks, pending equipment requests, active projects, and location issues.
- Added project-specific Kanban board creation and navigation from project cards.
- Added recording-place status tracking with filtering and manager/admin updates on the Maps page.
- Added customer handover documentation for deployment, access, support, limitations, and transition readiness.
- Added Week 6 sprint review, reflection, retrospective, and LLM usage report documentation.
- Added AGENTS.md with repository-specific workflow, security, verification, and agent conduct guidance.

### Changed

- Improved Task Manager workspace controls with saved column visibility, sorting, and denser board layout.
- Updated warehouse equipment counts and filter summaries so visible totals match active filters.
- Updated roadmap, user acceptance test evidence, and Week 5 report documentation for the current sprint plan and delivered MVP v2 scope.

### Fixed

- Fixed Calendar task card overflow and overlapping timed task-like entries.
- Fixed equipment request task-link validation and Kanban card refresh after checkout request creation.
- Fixed warehouse "send to project" action layout and prevented requests for non-operable equipment.

## [v2.0.0] - 2026-07-03

### Added

- Added equipment operability status for warehouse workflows.
- Added equipment storage responsibility fields.
- Added equipment request quantity and task linking.
- Added task manager workload filters.
- Added dashboard work progress widget.
- Added calendar task drag across views.
- Added architecture documentation with static, dynamic, deployment views, and ADRs.
- Added website documentation.
- Added updated UAT documentation for MVP v2.
- Added MVP v2 quality requirement and QRT documentation.

### Changed

- Stabilized equipment checkout request workflows.
- Improved equipment card layout and moved status tags to the card footer.
- Improved Kanban layout, dragging behavior, task detail modal, and workload UAT alignment.
- Updated dashboard task ordering by deadline.
- Updated Definition of Done to separate CI gates from QRTs.
- Updated quality IDs to `QR-001` / `QRT-001` style.
- Enabled documentation deployment from feature branch and manual trigger.
- Updated roadmap, development process, architecture, testing, and assignment evidence documentation.

### Fixed

- Fixed production border token conflict and opacity.
- Fixed equipment request actions and equipment details loading.
- Fixed duplicate task calendar entries.
- Fixed global sync state behavior.
- Fixed Kanban dragging, nested scroll, and modal layout instability.
- Fixed Node 24 workflow issues.
- Fixed Lychee exclusions.

## [v1.1.0] - 2026-06-28

### Added

- Added Kanban V2 cards to the Calendar so scheduled cards appear alongside events and tasks in Day, 3 Days, Week, and Month views.
- Added start dates for Kanban V2 cards and synchronized card date ranges with the Calendar.
- Added in-calendar task and Kanban card details, including status, assignee, priority, board/list context, timing, and overdue state.
- Added Kanban card creation from the Calendar event form.
- Added Kanban board custom fields for cards, including text, number, date, checkbox, select, multi-select, URL, email, and person fields.
- Added Kanban label groups for organizing and filtering board labels.
- Added a Kanban board statistics modal with completion level by list, assignee, stage, labels, label groups, and location-like custom fields.
- Added automated quality checks with Vitest tests, coverage reporting, TypeScript checking, build verification, and critical dependency audit in CI.
- Added user acceptance test documentation and quality requirement/testing documentation for Assignment 4.

### Changed

- Reworked the Calendar experience with configurable workday hours, grid step, weekend visibility, all-day area, compact mode, and improved event/task layout.
- Improved Kanban filtering, search, and list grouping with support for custom fields, label groups, due-date status, assignees, priorities, and list/stage status.
- Improved Kanban card details with start/due date editing, custom field editing, richer metadata, and clearer due-date status indicators.
- Improved navigation between Calendar and Kanban by opening a selected board/card directly from Calendar card details.
- Updated dashboard status data to include Kanban completion statistics.
- Updated the project roadmap, definition of done, user stories, and customer feedback documentation based on Assignment 4 work.

### Fixed

- Fixed TypeScript check failures.
- Fixed CI clean install lockfile issues.
- Fixed broken links and Lychee link-check exceptions.
- Fixed Calendar and task data refreshes after Kanban card updates.
- Fixed task update handling to return `404` when an updated task is not found.

## [v1.0.0] - 2026-06-21

### Added

- Added structured GitHub Issue Forms for User Story, Bug Report, Course Task, and Other PBI work.
- Added a Pull Request template aligned with Definition of Done and review workflow.
- Added the `<issue-number>-short-description` branch naming convention.
- Added the Keep a Changelog process for release notes.
- Added GitHub Projects setup for backlog and sprint tracking.
- Added Lychee link checker workflow for Markdown link validation.
- Added README setup instructions, architecture overview, and workflow documentation.

### Changed

- Standardized the repository workflow for issue-driven development.
- Aligned repository process documentation with Scrum-based development.
- Established MVP v1 as the baseline release for future iterations.
