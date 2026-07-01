# Definition of Done

This document defines the shared minimum completion standard for work in this repository. A PBI or user story may be marked `Done` only when the issue-specific acceptance criteria and the criteria below are satisfied.

## General Criteria

- [ ] All issue acceptance criteria are satisfied.
- [ ] Acceptance criteria are verified before merge.
- [ ] The work is reviewed by another team member who is different from the implementer.
- [ ] The issue-linked PR/MR is merged into `main`.
- [ ] The branch name follows `<issue-number>-short-description`, except for documented historical branches or automated dependency-update branches.
- [ ] No secrets, tokens, passwords, `.env` files, private recordings, private recording links, private credentials, customer-identifying evidence, confidential materials, or unnecessary PII are committed.
- [ ] Verification evidence is preserved in the PR description, CI run, linked documentation, or other normal workflow artifact.

Historical merged branches with nonconforming names are preserved as evidence and are not renamed retroactively because that would require rewriting history.

## CI and QA Gates

- [ ] The `Quality` workflow passes where applicable:
  - `npm ci`
  - `npm run check`
  - `npm test`
  - `npm run coverage`
  - `npm run build`
  - `npm audit --audit-level=critical`
- [ ] The `Link Check` workflow passes or excluded links are narrowly justified and manually verified before submission.
- [ ] Required critical-module coverage expectations are satisfied or any exception is explicitly documented and approved.

## Quality Requirement and QRT Criteria

- [ ] Relevant quality requirements in `docs/quality-requirements.md` are satisfied or explicitly documented as not applicable.
- [ ] Relevant automated quality requirement tests in `docs/quality-requirement-tests.md` pass or are explicitly documented as not applicable.
- [ ] Manual testing, UAT, screenshots, and review notes may support evidence, but they do not replace required automated QRTs unless there is a documented TA-approved exception.

## Architecture and Maintained Documentation Criteria

- [ ] If the change affects architecture, deployment, critical modules, workflow, CI configuration, quality requirements, or testing strategy, the relevant maintained documentation is updated.
- [ ] Architecture changes update `docs/architecture/README.md` and/or ADRs in `docs/architecture/adr/` where needed.
- [ ] Testing or QA changes update `docs/testing.md`, `docs/quality-requirements.md`, and `docs/quality-requirement-tests.md` where needed.
- [ ] Workflow or configuration-management changes update `docs/development-process.md` where needed.
- [ ] User-visible changes update `CHANGELOG.md` under `[Unreleased]` unless explicitly not applicable.

## User Story-Specific Criteria

- [ ] For user stories, the linked supporting PBIs provide the required implementation, review, and verification evidence.
- [ ] A user story is marked `Done` only when all linked supporting PBIs required for its acceptance criteria are reviewed, merged, verified, and marked `Done`.
