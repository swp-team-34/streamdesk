# Week 4 Report

## Project and Sprint Overview
1. **Project name and short description**:
   - **Name**: StreamDesk
   - **Short description**: StreamDesk is a production workflow management system for broadcast teams.
2. **Product Backlog board/view:** [Link](https://github.com/orgs/swp-team-34/projects/1)
3. **Sprint Backlog board/table:** [Link](https://github.com/orgs/swp-team-34/projects/2)
4. **Assignment 4 Sprint milestone:** [Link](https://github.com/swp-team-34/streamdesk/milestone/2)
5. **Sprint Goal, dates, and scope:**
   - **Goal**: Developers shall implement core features of calendar and fix several
   - **Dates** 23.06.2026 - 28.06.2026
   - **Scope summary**: Implement calendar and fix bugs in task manager
6. **Total Sprint size:** [31] Story Points
7. **Summary of delivered product changes:**
   - Implemented task creation flow: users can create boards, columns, and tasks with deadlines.
   - Added deadline status visibility on task cards.
   - Integrated a calendar view that displays tasks with their scheduled times.
   - Implemented task detail view accessible from the calendar.
   - Implemented task overlap handling logic so multiple tasks scheduled at the same time shift and display correctly.
8. **Deployed product / artifact:** [Link](https://team34.ru/)
9.  **Access or run instructions:** [Link](https://team34.ru/) (Enter any email and password for registration, then click "for personal use")

## Customer Feedback
10. **Customer feedback response table:**

| Feedback point | Resulting PBI or issue | Status | Response |
|---|---|---|---|
|The customer requested the ability to add custom tags and sub-groups. Tracking where files are stored and when they were recorded is a priority.| [#94](https://github.com/swp-team-34/streamdesk/issues/94) | To Do |Adding custom tags and sub groups to file details and filters to track storage location and recording date |
| Task manager and calendar are the core deliverables | Not applicable | Done | Sprint scope prioritizes task manager and calendar features |
| Design modernization is not a priority| Not applicable | Done | Design modernization deferred to later sprints |
| Building on existing StreamDesk codebase is appropriate | Not applicable | Done | StreamDesk codebase reused as foundation |

11. **Explanation of feedback not addressed:**
- All customer feedback points received during the review have been addressed: either converted into a concrete PBI (#94) or already satisfied by the current sprint scope and development approach.

## Documentation and Quality
12. **Roadmap:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/docs/roadmap.md)
13. **Definition of Done:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/docs/definition-of-done.md)
14. **Quality Requirements:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/docs/quality-requirements.md)
15. **Quality Requirement Tests:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/docs/quality-requirement-tests.md)
16. **Testing:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/docs/testing.md)
17. **User Acceptance Tests:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/docs/user-acceptance-tests.md)
18. **Quality model summary:**
    - **Equipment Permission Correctness** (`QR-01`): Functional correctness
    - **Protected Route Access Control** (`QR-02`): Authenticity
    - **Automated Regression Coverage** (`QR-03`): Testability
19. **Testing status summary:**
- Three critical modules are covered: equipment permissions (4 tests, 100% coverage), protected route (3 tests, ~73% coverage), and task dates utility (6 tests, ~55% coverage). All 13 tests pass. Overall line coverage is 0.8%.
20. **Unit tests:**
    - [`client/src/lib/equipment-permissions.test.ts`](https://github.com/swp-team-34/streamdesk/tree/main/client/src/lib/equipment-permissions.test.ts)
21. **Integration tests:** [Link]
    - [`client/src/components/protected-route.test.tsx`](https://github.com/swp-team-34/streamdesk/blob/main/client/src/components/protected-route.test.tsx)
22. **Automated quality requirement tests:** [https://github.com/swp-team-34/streamdesk/blob/main/docs/quality-requirement-tests.md]

## CI and Automation
23. **CI pipeline:** [https://github.com/swp-team-34/streamdesk/blob/main/.github/workflows/quality.yml]
24. **Latest protected-default-branch CI run:** [https://github.com/swp-team-34/streamdesk/actions/runs/28330146613/job/83926807045#step:1:26]
25. **Branch protection or rules evidence:** `![Product Backlog](images/branch-protection.png)`
26. **Linting, coverage, tests, and additional QA check evidence:**
- TypeScript check passed.
- Unit/Integration tests: 3 suites, 13 tests passed.
- Coverage: line coverage 0.8% (equipment-permissions 100%, protected-route ~73%, task-dates ~55%).
- Security audit (`npm audit --audit-level=critical`): no critical vulnerabilities.
- Link checker (lychee) passed.
- All evidence is in the [latest CI run](https://github.com/swp-team-34/streamdesk/actions/runs/28330146613/job/83926807045#step:1:26).
27. **Continuation of quality gates:**
- In the following sprints, everything that we have set up (type checking, tests, coverage, CI, UAT, quality‑requirement‑tests) remains mandatory for each PR in the main. We will immediately cover the new acceptance criteria with tests. The coating should not fall off. Once a sprint, we will look at our quality‑characteristics (correctness, authenticity, testability) and, if necessary, supplement the quality‑requirements.

## Release and Demo
28. **SemVer release:** [Link] https://github.com/swp-team-34/streamdesk/releases/tag/v1.1.0
29. **CHANGELOG.md:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/CHANGELOG.md)
30. **Public sanitized demo video:** [Link] = https://disk.yandex.ru/i/aRJd0duUBSRkgA
31. **Presentation slides (optional public copy):** [https://drive.google.com/file/d/17CI6xzP8WztKBwN3XODjP8zabdRmJwSF/view?usp=sharing]

## Customer Review and UAT
32. **Public sanitized UAT results summary**:
    - Three active UAT scenarios were executed by the customer during a recorded session:
    - **UAT-001 (Task creation):** Passed. The customer successfully created boards, columns, and tasks, and confirmed the deadline status visibility is clear.
    - **UAT-002 (Calendar display):** Passed with noted UI issue. The customer located tasks on the calendar easily but identified a visual bug where task cards stretch awkwardly when containing excessive text.
    - **UAT-003 (Calendar task details):** Passed with feature requests. The customer approved the task detail view but requested drag-and-drop editing, color-coded deadline indicators, and confirmed that task overlap handling works correctly.
    
    All feedback points have been converted into traceable PBIs and added to the Product Backlog (see Customer Feedback section above).
33. **Customer review transcript:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/customer-review-transcript.md)
34. **Customer review summary:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/customer-review-summary.md)

## Reflection and Reports
35. **Reflection:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/reflection.md)
36. **Retrospective:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/retrospective.md)
37. **LLM report:** [Link](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/llm-report.md)

## Status and Next Steps
38.  **Current product status:**
    - **Implemented**: two core features of four. Task manager and Calendar at least work. They have several bugs, but in general satisfy customer needs
    - **Not implemented**: we still have to implement two core features. They are warehouse and monitoring pages.
39.  **Next steps:** In general is to implement next features and fix bugs. In more details will be determined in the beginning of the next sprint.

## Team Contribution
40. **Contribution traceability table:**
    | Team Member | Issues | PRs/MRs | Review Activity | Testing / Quality / Automation | Documentation |
    |---|---|---|---|---|---|
    | @AleksKornilov07 | [#84](https://github.com/swp-team-34/streamdesk/issues/91), [#86](https://github.com/swp-team-34/streamdesk/issues/86), [#88](https://github.com/swp-team-34/streamdesk/issues/88), [#90](https://github.com/swp-team-34/streamdesk/issues/90), [#94](https://github.com/swp-team-34/streamdesk/issues/94), [#95](https://github.com/swp-team-34/streamdesk/issues/95), [#118](https://github.com/swp-team-34/streamdesk/issues/118)| [#92](https://github.com/swp-team-34/streamdesk/pull/92), [#97](https://github.com/swp-team-34/streamdesk/pull/97), [#116](https://github.com/swp-team-34/streamdesk/pull/116), [#117](https://github.com/swp-team-34/streamdesk/pull/117), [#119](https://github.com/swp-team-34/streamdesk/pull/119), [#122](https://github.com/swp-team-34/streamdesk/pull/122), [#123](https://github.com/swp-team-34/streamdesk/pull/123) | [#99](https://github.com/swp-team-34/streamdesk/pull/99), [#100](https://github.com/swp-team-34/streamdesk/pull/100), [#103](https://github.com/swp-team-34/streamdesk/pull/103), [#115](https://github.com/swp-team-34/streamdesk/pull/115), [#108](https://github.com/swp-team-34/streamdesk/pull/108), [#121](https://github.com/swp-team-34/streamdesk/pull/121) | - | [Response table](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/customer%20feedback%20RT.md), [README](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/README.md), [retrospective](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/retrospective.md), [llm-report](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/llm-report.md) |
    | @MeeDaniel | [#85](https://github.com/swp-team-34/streamdesk/issues/85), [#87](https://github.com/swp-team-34/streamdesk/issues/87), [#89](https://github.com/swp-team-34/streamdesk/issues/89), [#91](https://github.com/swp-team-34/streamdesk/issues/91), [#93](https://github.com/swp-team-34/streamdesk/issues/93), [#102](https://github.com/swp-team-34/streamdesk/issues/102), [#104](https://github.com/swp-team-34/streamdesk/issues/104), [#105](https://github.com/swp-team-34/streamdesk/issues/105), [#106](https://github.com/swp-team-34/streamdesk/issues/106), [#107](https://github.com/swp-team-34/streamdesk/issues/107), [#109](https://github.com/swp-team-34/streamdesk/issues/109), [#110](https://github.com/swp-team-34/streamdesk/issues/110),| [#99](https://github.com/swp-team-34/streamdesk/pull/99), [#103](https://github.com/swp-team-34/streamdesk/pull/103) | [#83](https://github.com/swp-team-34/streamdesk/issues/82), [#92](https://github.com/swp-team-34/streamdesk/pull/92), [#97](https://github.com/swp-team-34/streamdesk/pull/97), [#101](https://github.com/swp-team-34/streamdesk/pull/101)| - | [roadmap](https://github.com/swp-team-34/streamdesk/blob/main/docs/roadmap.md),[README](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/README.md), [LLM-report](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/llm-report.md), [reflection](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/reflection.md), [llm-report](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/llm-report.md) |
    | @kkonstantin08 | [#124](https://github.com/swp-team-34/streamdesk/issues/124),[#81](https://github.com/swp-team-34/streamdesk/issues/81), [#82](https://github.com/swp-team-34/streamdesk/issues/82) | [#125](https://github.com/swp-team-34/streamdesk/pull/125), [#98](https://github.com/swp-team-34/streamdesk/pull/98), [#83](https://github.com/swp-team-34/streamdesk/issues/83) | - | [quality yml](https://github.com/swp-team-34/streamdesk/blob/main/.github/workflows/quality.yml), [route test](https://github.com/swp-team-34/streamdesk/blob/main/client/src/components/protected-route.test.tsx), [equipment test](https://github.com/swp-team-34/streamdesk/blob/main/client/src/lib/equipment-permissions.test.ts), [package-lock.json](https://github.com/swp-team-34/streamdesk/blob/main/package-lock.json), [package.json](https://github.com/swp-team-34/streamdesk/blob/main/package.json), [vitest.config.ts](https://github.com/swp-team-34/streamdesk/blob/main/vitest.config.ts) | [quality requirements tests](https://github.com/swp-team-34/streamdesk/blob/main/docs/quality-requirement-tests.md), [quality requirements](https://github.com/swp-team-34/streamdesk/blob/main/docs/quality-requirements.md), [testing](https://github.com/swp-team-34/streamdesk/blob/main/docs/testing.md)|
    | @TimBqs | - | [#121](https://github.com/swp-team-34/streamdesk/pull/121) | [#119](https://github.com/swp-team-34/streamdesk/pull/119), [#122](https://github.com/swp-team-34/streamdesk/pull/122), [#125](https://github.com/swp-team-34/streamdesk/pull/125), [#123](https://github.com/swp-team-34/streamdesk/pull/123) | - | [interview transcript](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/customer-review-transcript.md), [summary of interview](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/customer-review-summary.md) |
    | @TripleA89 | - | [#100](https://github.com/swp-team-34/streamdesk/pull/100), [#101](https://github.com/swp-team-34/streamdesk/pull/101) | [#98](https://github.com/swp-team-34/streamdesk/pull/98) | - | - |
    | @rrafich| [#111](https://github.com/swp-team-34/streamdesk/issues/111), [#112](https://github.com/swp-team-34/streamdesk/issues/112) [#113](https://github.com/swp-team-34/streamdesk/issues/113) [#114](https://github.com/swp-team-34/streamdesk/issues/114) | [#108](https://github.com/swp-team-34/streamdesk/pull/108), [#115](https://github.com/swp-team-34/streamdesk/pull/115) | [#116](https://github.com/swp-team-34/streamdesk/pull/116), [#117](https://github.com/swp-team-34/streamdesk/pull/117) | - | [UAT](https://github.com/swp-team-34/streamdesk/blob/main/docs/user-acceptance-tests.md), [DoD](https://github.com/swp-team-34/streamdesk/blob/main/docs/definition-of-done.md), [reflection](https://github.com/swp-team-34/streamdesk/blob/main/reports/week4/reflection.md)

## Evidence Screenshots
41. **Embedded screenshots from `reports/week4/images/`:**
    - Sprint milestone: ![Sprint milestone](images/sprint-milestone.png)
    - Latest protected-default-branch CI run: ![CI run](images/Latest-protected-default-branch-CI-run.png)
    - Branch protection or rules evidence: ![Branch protection](images/branch-protection.png)
    - Coverage or test report: ![Coverage](images/Coverage.png)
    - Additional QA check result: ![Additional QA](images/Additional-QA-check-result.png)
    - SemVer release: ![Release](images/version.png), [Release2](images/next-part.png)
    - Example reviewed issue-linked PR/MR: ![PR example](images/pr-example.png)
42. **Additional relevant screenshots:**
    - Product Backlog: ![Product Backlog](images/product-backlog.png) READY
    - Sprint Backlog: ![Sprint Backlog](images/sprint-backlog.png) READY
    - Deployed product: ![Statistic](images/tg_image_523947626.png), ![Settings of the board](images/tg_image_1353012353.png), ![Edit event](images/tg_image_1357133084.png), ![Task manager](images/tg_image_1613182004.png), ![Task edit](images/tg_image_1681588848.png), ![Settings of board](images/tg_image_1873359177.png), ![Dashboard](images/tg_image_2491747447.png), ![Calendar type1](images/tg_image_3394806835.png), ![Calendar type1](images/tg_image_3394806835.png), ![Calendar type2](images/tg_image_3724288249.png), ![Filters](images/tg_image_4072074126.png)
    - 