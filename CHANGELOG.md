# Changelog

All notable user-visible changes to this project must be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
uses a SemVer-compatible release structure. Until the next release is tagged,
changes are collected under `Unreleased`.

## [Unreleased]

### Added

### Changed

### Fixed

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
