# Definition of Done

This document defines the shared minimum completion standard for work in this repository. That is, an issue can be marked as `Done` only if:

## General Criteria
- [ ] All issue acceptance criteria are satisfied.
- [ ] Acceptance criteria verified before merge.
- [ ] The work is reviewed by another team member.
- [ ] Future non-automated branch names follow the template: `<issue-number>-short-description`.
- [ ] Required tests or checks pass.
- [ ] Verification evidence is preserved in the normal workflow artifacts.
- [ ] The issue-linked PR/MR is merged into `main` branch.
- [ ] No secrets, tokens, passwords, or `.env` files are committed.
- [ ] Documentation was updated where needed.
- [ ] If change is user-visible, it should be marked in `[Unreleased]` section of `CHANGELOG.md` (following [Keep the Changelog](https://keepachangelog.com/)).

Historical merged branches with nonconforming names are preserved as evidence and
are not renamed retroactively because that would require rewriting history.

## User Stories Specific Criteria
- [ ] For user stories, the linked supporting PBIs provide the required implementation, review, and verification evidence.
