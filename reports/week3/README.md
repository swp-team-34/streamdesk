# StreamDesk: Week 3  <!-- Part 1 -->

StreamDesk is a production workflow management system for broadcast teams.  <!-- Part 1 -->

## Repository

- [Root README](../../README.md) <!-- ??? -->
- [MIT License](../../LICENSE) <!-- Part 1 -->
- [Pull request template](../../.github/pull_request_template.md) <!-- ??? -->
- [Lychee configuration](../../lychee.toml) <!-- ??? -->
- [Process Requirements](https://gitlab.pg.innopolis.university/swp_26/swp_26/-/blob/main/Process_Requirements.md) <!-- Part 21 -->

## Week 3 Reports

- [User Stories Index](../../docs/user-stories.md) <!-- ??? -->
- [Roadmap](../../docs/roadmap.md) <!-- Point 22 -->
- [Definition of Done](../../docs/definition-of-done.md) <!-- Point 23 -->
- [Changelog](../../CHANGELOG.md) <!-- Point 20 -->
- [Customer Review Transcript](customer-review-transcript.md) <!-- Point 30 TODO -->
- [Customer Review Summary](customer-review-summary.md) <!-- Point 31 TODO -->
- [Week 3 Reflection](reflection.md) <!-- Point 32 TODO -->
- [Sprint Retrospective](retrospective.md) <!-- Part 33 TODO -->
- [LLM Usage Report](llm-report.md) <!-- Part 34 -->

## Historical Reports (Week 2)

- [User Stories (Assignment 2)](../week2/user-stories.md) <!-- ??? -->
- [MVP v0 Report](../week2/mvp-v0-report.md) <!-- ??? -->
- [Customer Meeting Summary](../week2/customer-meeting-summary.md) <!-- ??? -->

## Key Metrics

<!-- Total Product Backlog size: Part 9 TODO -->
<!-- Current Sprint (Sprint 1) size: Part 10 TODO -->
<!-- Number of qualifying PBIs: ??? -->
<!-- MVP v1 PBIs completed: ??? -->

| Metric | Value |
| --- | --- |
| Total Product Backlog size | **XX Story Points** |
| Current Sprint (Sprint 1) size | **YY Story Points** |
| Number of qualifying PBIs | **15+** |
| MVP v1 PBIs completed | **N / M** |

## MVP v1 Scope

### Selected scope

MVP v1 delivers the core workflow management capabilities for broadcast teams. The selected scope includes:

- **US-003** — [View work completion progress ](https://github.com/swp-team-34/streamdesk/issues/55)
- **BUG** — [Localisation problems](https://github.com/swp-team-34/streamdesk/issues/44)

### Customer feedback from Assignment 2 addressed in MVP v1 <!-- Part 3 -->

During the Week 2 meeting, the customer kindly asked us to hurry up with task manager feature. We documented the functionality of this feature in [US-003](https://github.com/swp-team-34/streamdesk/issues/55). This feature is already exists, but was not properly tested. It has tons of bugs and barely work. During expectation of existing functinoallity one bug ([#44](https://github.com/swp-team-34/streamdesk/issues/44)) was mentioned. We decided to fix this bug in MVP v1.

## Backlog and Sprint Boards

- [Product Backlog board](ссылка_на_product_backlog_view) <!-- Part 6 TODO -->
- [Sprint 1 Backlog board](ссылка_на_sprint_backlog_view) <!-- ??? -->
- [Sprint 1 Milestone](ссылка_на_milestone) — Sprint Goal, dates, and scope <!-- Part 8 TODO -->
- [MVP version grouped view](ссылка_на_view_с_группировкой_по_mvp) <!-- ??? -->

## Process and Workflow Documentation

- [Changelog](../../CHANGELOG.md) <!-- Part 20 -->
- [Process Requirements](https://gitlab.pg.innopolis.university/swp_26/swp_26/-/blob/main/Process_Requirements.md) <!-- Part 21 TODO -->
- [Roadmap](../../docs/roadmap.md) <!-- Part 22 -->
- [Definition of Done](../../docs/definition-of-done.md) <!-- Part 23 -->
- [User Stories Index](../../docs/user-stories.md) <!-- ??? -->
- Issue templates: <!-- Part 24 -->
  - [User Story](../../.github/ISSUE_TEMPLATE/user_story.md)
  - [Other PBI](../../.github/ISSUE_TEMPLATE/other_pbi.md)
  - [Course Task](../../.github/ISSUE_TEMPLATE/course_task.md)
  - [Bug Report](../../.github/ISSUE_TEMPLATE/bug_report.md)
- [Extended Pull Request Template](../../.github/pull_request_template.md)

## PBI Types, Statuses, and Workflow <!-- Part 13 -->

### PBI types
We use the following PBI types, as defined in [`Process_Requirements.md`](https://gitlab.pg.innopolis.university/swp_26/swp_26/-/blob/main/Process_Requirements.md):
- **Bug Report** — defects found during testing or production
- **Course Task** — solution of some assignment task
- **User Story** — end-user functionality with acceptance criteria
- **Other PBI** — other PBIs that are not correspond to any of the described type.

### Statuses and priorities
- **Work Status:** `To Do` → `Ready` → `In Progress` → `Review` → `Done`
- **MoSCoW Priority:** `Must` / `Should` / `Could` / `Won't for this release`
- **Requirement Status:** `Active` / `Removed`

### Sprint milestone usage
The Sprint milestone is the authoritative container for Sprint-selected PBIs. All issues assigned to the Sprint 1 milestone form the Sprint Backlog. The milestone description contains the Sprint Goal and dates.

### MVP version tracking
We use a custom `MVP version` field in GitHub Projects (Table view) to group PBIs by MVP release. Items are grouped by `MVP v1`, `MVP v2`, `MVP v3`, and so on.

### Task decomposition approach
User stories selected for the Sprint are decomposed into smaller linked technical PBIs when needed. Each supporting PBI has its own implementer, reviewer, acceptance criteria, and linked PR/MR. The parent user story is marked `Done` only when all linked supporting PBIs are completed.

## Roadmap Summary <!-- Part 14 -->

The current roadmap spans one Sprint:
- **Sprint 1 (current):** Deliver MVP v1 with core task manager.

See the full [Roadmap](../../docs/roadmap.md) for details.

## Product Status and Next Steps

### Current status <!-- Part 16 TODO -->
MVP v1 is delivered and deployed. All selected PBIs are marked `Done`, reviewed, and verified against acceptance criteria. The customer has reviewed the increment during the Sprint Review.

### Next steps <!-- Part 17 -->
- Address customer feedback from Sprint Review (see [Customer Review Summary](customer-review-summary.md))
- Begin Sprint 2 planning focused on reporting features
- Refine MVP v2 backlog items and add acceptance criteria

## Verification Evidence <!-- Part 15 TODO -->

All completed MVP v1 PBIs have been verified against their acceptance criteria. Verification evidence is preserved in the following PRs:

- [PR #XX — US-XX implementation](ссылка) — acceptance criteria verified in [comment](ссылка_на_комментарий)

## Contribution Traceability <!-- Part 18 TODO -->

| Team Member | Role | Issues | PRs/MRs | Reviews |
| --- | --- | --- | --- | --- |
| [@username1](https://github.com/username1) | [Role] | [#XX](ссылка), [#YY](ссылка) | [#12](ссылка), [#13](ссылка) | [#11](ссылка), [#14](ссылка) |
| [@username2](https://github.com/username2) | [Role] | [#ZZ](ссылка) | [#15](ссылка) | [#12](ссылка), [#16](ссылка) |
| [@username3](https://github.com/username3) | [Role] | [#AA](ссылка), [#BB](ссылка) | [#17](ссылка) | [#15](ссылка), [#18](ссылка) |

## Required Links

- **MVP v1 deployment:** [streamdesk.innopolis.university](https://streamdesk.innopolis.university/) <!-- Part 26 TODO -->
- **SemVer release (MVP v1):** [v1.0.0](ссылка_на_github_release) <!-- Part 19 TODO -->
- **Run instructions:** [Local setup (root README)](../../README.md#локальный-запуск) <!-- Part 27 TODO -->
- **Public video demo (< 2 min):** [MVP v1 demonstration (Yandex Disk)](ссылка) <!-- Part 28 TODO -->
- **Reviewed PRs from Week 3:** <!-- Part 25 TODO -->
  - [PR #XX — Description](ссылка)
  - [PR #YY — Description](ссылка)
  - [PR #ZZ — Description](ссылка)

## Screenshots <!-- Part 29 -->

### Product Backlog

![Product Backlog](images/product-backlog.png)

### Sprint 1 Backlog

![Sprint Backlog](images/sprint-backlog.png)

### Sprint 1 Milestone

![Sprint Milestone](images/sprint-milestone.png)

### MVP Version Grouped View

![MVP Version View](images/mvp-version-view.png)

### SemVer Release

![SemVer Release](images/semver-release.png)

### MVP v1 Deployment

![MVP v1](images/mvp-v1.png)

### Example Reviewed PR

![Reviewed PR](images/reviewed-pr.png)

## Excluded Lychee links

The following URLs are excluded from automated Lychee link checking because GitHub Actions CI cannot reliably reach them (timeouts or network restrictions). Each was manually verified in a browser before submission and confirmed accessible.

| URL | Reason for exclusion |
| --- | --- |
| `https://streamdesk.innopolis.university/` | Times out from GitHub Actions; manually verified accessible |
| `https://team34.ru/` | MVP deployment responds inconsistently from CI; manually verified accessible |
| Ссылка на видео (Yandex Disk) | Requires authentication from CI; manually verified accessible |