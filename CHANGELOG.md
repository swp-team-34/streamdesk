# Changelog

All notable user-visible changes to this project must be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
uses a SemVer-compatible release structure. Until the first release is tagged,
changes are collected under `Unreleased`.

## [Unreleased]

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
- Updated the project roadmap, definition of done, user stories, and customer feedback documentation based on recent Assignment 4 work.

### Fixed

- Fixed TypeScript check failures.
- Fixed CI clean install lockfile issues.
- Fixed broken links and Lychee link-check exceptions.
- Fixed Calendar and task data refreshes after Kanban card updates.
- Fixed task update handling to return `404` when an updated task is not found.
