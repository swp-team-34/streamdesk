# Repository Workflow

This document defines the repository workflow for StreamDesk product backlog items,
course tasks, bug reports, pull requests, evidence, changelog updates, and releases.

## Issue-based Product Backlog

All planned work starts from a GitHub issue. The issue is the source for scope,
status, priority, evidence, and traceability. Pull requests must link back to the
issue they implement or verify.

Project links:

- Product Backlog: <https://github.com/orgs/swp-team-34/projects/1>
- Sprint Backlog: <https://github.com/orgs/swp-team-34/projects/2>

Use these issue types:

- **User Story**: end-user value written with a stable ID such as `US-001`, a story
  statement, acceptance criteria, priority, points, MVP version, and traceability.
- **Other PBI**: technical, documentation, research, infrastructure, or refactoring
  backlog items that are not user stories.
- **Course Task**: assignment process work and evidence collection.
- **Bug Report**: reproducible defects with environment, steps, expected result,
  actual result, evidence, and verification checklist.

## Work Status

Use a shared `Work Status` field or equivalent labels with these states:

- Backlog
- Selected for Sprint
- In Progress
- In Review
- Done

The issue status should match the actual repository state. Work should not be marked
`Done` until the linked PR is merged or the issue has documented evidence explaining
why no PR was needed.

## Branch Naming

Future non-automated branches must use this format:

```text
<issue-number>-short-description
```

Example:

```text
19-configure-assignment-3-workflow
```

Do not commit directly to the default branch. Create work branches from the current
default branch and link each PR to the issue.

Historical merged branches with nonconforming names cannot be renamed retroactively
without rewriting history. Preserve them as historical evidence. Future branches
must comply with the required naming format.

## Pull Requests

Each PR must:

- link to the relevant issue;
- confirm the branch follows `<issue-number>-short-description`;
- identify the PBI type;
- include Work Status, MoSCoW priority, Story Points, and MVP version when applicable;
- verify acceptance criteria before merge;
- include testing or verification evidence;
- include screenshots or demo evidence when the change affects visible behavior;
- select exactly one `CHANGELOG.md` option: updated for user-visible changes, or
  not applicable because the PR has no user-visible changes;
- pass the Definition of Done and reviewer checklist.

## Acceptance Criteria and Merge Readiness

Acceptance criteria must be verified before merge. If a criterion cannot be verified,
the PR must describe the gap and the follow-up issue or manual evidence required.

The repository uses a merge-commit workflow. Squash and rebase merges should remain
disabled for assignment evidence unless the team changes the workflow in a documented
SemVer-compatible release process.

## SemVer Release Workflow

Use Semantic Versioning for releases:

- `MAJOR` for incompatible product or API changes;
- `MINOR` for backward-compatible functionality;
- `PATCH` for backward-compatible fixes and documentation-only corrections where a
  tagged patch release is useful.

Recommended mapping:

```text
MVP v1 -> v1.0.0
```

If the team chooses another SemVer-compatible mapping, document it here and in the
release notes before tagging.

## Changelog Workflow

Maintain `CHANGELOG.md` with an `Unreleased` section. Every user-visible change must
update `CHANGELOG.md` in the same PR. Documentation, process, and repository workflow
changes should also be listed when they affect team or reviewer behavior.

Before creating a release:

1. move relevant `Unreleased` entries under the release version and date;
2. verify the MVP-to-release mapping;
3. tag the release using the agreed SemVer version;
4. link the release notes from the submission evidence.

## Required Individual Evidence

Each team member must provide:

- at least one commit;
- at least one issue-linked PR;
- at least one approval of another member's PR;
- at least one meaningful review comment on another member's PR.

Evidence should be linked from the relevant issue, PR, or report. Use `TODO:` placeholders
only when the real external link is not available yet.

## Manual GitHub UI Actions

These actions require GitHub UI access or repository administration permissions and
are not completed by committing files:

- Product Backlog board/view created and linked:
  <https://github.com/orgs/swp-team-34/projects/1>;
- Sprint Backlog board/view created and linked:
  <https://github.com/orgs/swp-team-34/projects/2>;
- `Work Status` field created in both project boards;
- MoSCoW priority field created in both project boards;
- Story Points field created in both project boards;
- MVP version field created in both project boards;
- branch protection verified for the default branch;
- merge-commit-only workflow verified for pull requests;
- public visibility/access verified for repository and project links;
- TODO: add and verify the MVP v1 deployment/access link after it is available.

Record final board, protection, release, deployment, and evidence links only after
they are available. Do not invent unavailable links.
