# Changelog

All notable user-visible changes to this project must be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
uses a SemVer-compatible release structure. Until the first release is tagged,
changes are collected under `Unreleased`.

## [Unreleased]

### Added

- Added repository workflow scaffolding for issue templates, PR evidence, and release tracking. Issue link: `#<issue-number>`.
- Added definition of done. Issue link: `#<issue-number>`.

### Changed

- Updated Assignment 3 repository workflow compliance files for YAML issue forms, blank issue settings, pull request checklist evidence, changelog categories, and branch naming guidance ([#45](https://github.com/swp-team-34/streamdesk/issues/45)).
- Documented issue-based backlog, branch, PR, changelog, and release workflows. Issue link: `#<issue-number>`.
- Replaced the legacy Task Manager as the default `/tasks` experience with the new Kanban-based workspace, while keeping the old manager available under `/tasks-legacy`.
- Refined the Kanban task workspace UX with improved board layout, smoother full-card drag interactions, and personal board support without requiring a company.
- Fixed Kanban deletion flows in PostgreSQL-backed environments so cards, lists, and boards can be removed together with their related comments, history, attachments, and labels.
