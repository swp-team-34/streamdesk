# Definition of Done

This document defines the shared minimum completion standard for work in this repository. That is, an issue can be marked as `Done` only if:

## General Criteria
- [ ] All issue acceptance criteria are satisfied.
- [ ] Acceptance criteria verified before merge.
- [ ] The work is reviewed by another team member.
- [ ] Future non-automated branch names follow the template: `<issue-number>-short-description`.
- [ ] All CI checks (defined in `.github/workflows/quality.yml` and other workflows) pass successfully, including automated quality requirement tests (lychee, linter, and tests associated with QR‑01, QR‑02, QR‑03 as specified in `quality-requirement-tests.md`).
- [ ] Test coverage for critical modules (identified in the project's architecture documentation) must not decrease; any decrease must be justified and approved by the reviewer. Where feasible, coverage should increase.
- [ ] Verification evidence (e.g., test results, coverage reports, logs) must be clearly preserved and accessible in the pull request description, CI artifacts, or linked documentation, so that reviewers can easily confirm all criteria are met.
- [ ] The issue-linked PR/MR is merged into `main` branch.
- [ ] No secrets, tokens, passwords, or `.env` files are committed.
- [ ] Documentation was updated where needed.
- [ ] If change is user-visible, it should be marked in `[Unreleased]` section of `CHANGELOG.md` (following [Keep the Changelog](https://keepachangelog.com/)).
- [ ] This Definition of Done must be reviewed and updated whenever the technology stack, quality requirements, critical modules, or CI configuration change; changes to the DoD require team consensus and must be documented in this file.

Historical merged branches with nonconforming names are preserved as evidence and
are not renamed retroactively because that would require rewriting history.

## User Stories Specific Criteria
- [ ] For user stories, the linked supporting PBIs provide the required implementation, review, and verification evidence.
