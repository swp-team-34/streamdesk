*Customer Sprint Review Summary, Customer Trial / UAT Review Summary, and Transition Readiness Summary are collected in this file*

# Customer Sprint Review Summary

## Meeting Details

- **Sprint:** Sprint 4 (Week 6)
- **Format:** Video Call / Screen Sharing
- **Participants:** Team member(s), Customer
- **Recording Timecode:** 00:00:00 - 00:05:38

## Session Note

The meeting started with recording and transcription permission, followed by a Sprint 4 review of StreamDesk. The team demonstrated completed changes in Dashboard, Calendar, Task Manager, Projects, Locations, and Warehouse. The Customer confirmed the shown progress was generally acceptable and then moved into hands-on testing.

## Agenda

1. Obtain permission to record and transcribe the meeting.
2. Review Sprint 4 completed work.
3. Demonstrate Dashboard layout customization, Calendar fixes, Task Manager / Project updates, Locations, and Warehouse updates.
4. Collect immediate Customer feedback before hands-on trial.

## Discussion Points

- **Dashboard Updates:** Widgets can now be moved, resized, hidden, maximized, and restored locally per user. The Customer later requested a separate reset-to-default layout action.
- **Calendar Fixes:** Small-card rendering was adjusted so compact events remain draggable and visible through the title area.
- **Locations / Площадки:** A Locations section was added, including location creation, status, sorting, search, and error/reporting flow.
- **Projects and Task Manager Integration:** Project boards now create task boards, statistics update from task status, and locations/errors can be connected to tasks.
- **Task Manager Updates:** Board statistics, filters, priority sorting, custom fields, labels, and label groups were demonstrated or discussed.
- **Warehouse Updates:** Equipment can be issued/returned, requested through a cart, filtered by status/usage, assembled into kits, and linked with project/task workflows, though some location integration remains incomplete.

## Customer Approvals & Agreements

| Item | Status |
| :--- | :--- |
| Recording and transcription | Approved by the Customer |
| Sprint 4 shown progress | Accepted as generally normal / acceptable |
| Move to hands-on trial | Approved |

## Action Items

- [ ] **Team:** Add or refine Dashboard reset-to-default layout behavior.
- [ ] **Team:** Complete Locations integration with Warehouse and tasks.
- [ ] **Team:** Continue polishing Task Manager and Warehouse UI details found during UAT.

---

# Customer Trial and UAT Review Summary

## Meeting Details

- **Sprint / Release:** Week 6 trial / handover-candidate release
- **Format:** Customer hands-on testing through screen sharing
- **Participants:** Customer executing actions, Team member(s) observing and providing minimal guidance
- **Recording Timecode:** 00:05:38 - 00:56:21

## Session Note

The Customer independently registered, created a company, configured Dashboard widgets, tested Task Manager and Calendar workflows, created Locations, explored Warehouse equipment and kit workflows, and provided extensive product feedback. The trial result is **Passed with observations**: the Customer was able to use the core workflows, but identified several improvements needed before or after MVP v3.

## Agenda

1. Register and enter the Week 6 trial release.
2. Test Dashboard customization from a manager perspective.
3. Create projects, boards, columns, tasks, labels, custom fields, and deadlines.
4. Verify Calendar display for overdue tasks.
5. Create and use Locations / площадки.
6. Test Warehouse equipment filters, kits, QR codes, cart/request flow, and status handling.
7. Capture product feedback and classify follow-up work.

## Discussion Points

- **Dashboard:** The Customer successfully hid technical widgets, prioritized management/task widgets, inspected theme/profile/settings areas, and requested a separate button to reset widget layout to default.
- **Task Manager:** The Customer created a project and board workflow, created custom columns, edited tasks, used labels and label groups, verified custom fields, checked attachments/comments/logs, moved tasks, and confirmed deadline/overdue display.
- **Task Ownership:** The Customer requested clearer separation between executor, responsible person / manager, and task initiator. Multiple executors already appear to be supported when more users are present.
- **Custom Fields:** Custom fields propagate to existing cards and can be shown/hidden on cards. The Customer asked for clearer hints/tooltips in field filters.
- **Calendar:** Overdue tasks were correctly shown in red. The Customer asked whether overdue status can also be displayed in other task views.
- **Locations:** The Customer created a location and found the feature valuable, especially as a long-term archive/documentation area for venues, technical notes, attachments, issue history, dates, comments, and resolve/archive workflows.
- **Warehouse:** The Customer tested equipment types, filters, kit assembly, QR code download/print, cart/request flow, and ownership/status flows. The Customer requested user-configurable equipment categories/subcategories, easier kit expansion, comments/photos on equipment, and stronger safeguards when components belong to a kit.
- **Request Linking:** The Customer recommended linking Warehouse cart/request flows not only to projects, but also to specific tasks.

## UAT Results

| Scenario | Result | Evidence / Timecode |
| :--- | :--- | :--- |
| Dashboard customization | Passed with observations | Customer configured widgets and requested reset-to-default action, 00:08:09 - 00:10:32 |
| Task Manager / Project / Board workflow | Passed with observations | Customer created project/columns/tasks, verified labels, custom fields, and status/statistics, 00:11:56 - 00:32:56 |
| Calendar overdue display | Passed | Overdue task shown in red, 00:25:57 - 00:26:23 |
| Locations | Passed with observations | Customer created location and recommended archive/documentation expansion, 00:32:58 - 00:41:45 |
| Warehouse | Passed with observations | Customer tested equipment, kits, QR, cart, ownership, and component constraints, 00:41:49 - 00:56:17 |

## Customer Feedback Response

| Feedback point | Type | Priority | Expected outcome | Resulting issue/PBI/action | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Add Dashboard reset-to-default layout action | Product | Could | User can restore default widget layout after experimentation or broken layout | Create Dashboard reset action | Team | Open |
| Add clearer hints for custom field filters | Product / UX | Should | User understands which custom fields can be filtered and how | Add tooltip/helper text | Team | Open |
| Add responsible person / initiator fields in addition to executors | Product | Should | Task ownership and supervision are explicit | Extend task metadata model/UI | Team | Open |
| Expand Locations into venue archive/documentation | Product | Should | Location can store notes, dates, files, comments, and venue-specific knowledge | Design location archive/comments/history | Team | Open |
| Add user-configurable equipment categories/subcategories | Product | Must / Should | Customer can organize equipment without developer-side taxonomy changes | Add category/subcategory management | Team | Open |
| Prevent or warn when issuing kit components separately | Product / Data integrity | Must | Components inside active kits cannot be silently issued independently | Add validation/warning and logging | Team | Open |
| Link Warehouse requests to tasks as well as projects | Product | Should | Equipment requests map to the exact operational task | Add task selector to request flow | Team | Open |
| Add comments/photos to equipment items | Product | Should | Equipment condition/history can be documented directly | Add equipment comments/attachments | Team | Open |

---

# Documentation and Transition Readiness Summary

## Meeting Details

- **Meeting Scope:** Documentation review, transition-readiness interview, Sprint 5 prioritization, closing confirmation
- **Format:** Video Call / Screen Sharing
- **Participants:** Team member(s), Customer
- **Recording Timecode:** 00:56:21 - 01:02:25

## Session Note

The Customer stated that the documentation looked fine after receiving the repository link. In the transition discussion, the Customer confirmed StreamDesk is not yet used outside demonstration meetings, but the current state is already close enough to begin practical use after deployment and agreed Week 7 fixes. The Customer also confirmed willingness to use the product after handover and identified themselves as the product owner after transfer.

## Agenda

1. Check README and Customer Handover documentation.
2. Confirm whether StreamDesk is currently used outside review meetings.
3. Discuss current blockers to real use.
4. Confirm readiness after Week 7 fixes and deployment.
5. Identify product owner and support expectations.
6. Prioritize Sprint 5 / Week 7 work.

## Discussion Points

- **Documentation:** Customer initially had not reviewed the documents, then opened the repository link and stated that everything was familiar / fine.
- **Current Usage:** StreamDesk is not currently used outside demonstration meetings.
- **Readiness:** Customer said that, if the current version is deployed and the discussed work is fixed, the system can be taken into work and used.
- **Ready Areas:** Customer highlighted task creation/movement, Warehouse, Locations/alerts, and the general product flow as already understandable and usable with refinements.
- **Deployment:** The product is not yet deployed on the Customer side. The team expects to provide deployment documentation and support.
- **Ownership:** Customer agreed that product ownership after handover can be assigned to them.
- **Support:** Customer would appreciate team help with GitHub issue tracker, configuration, backups, updates, and transition support if available.
- **Week 7 Priority:** Must/important fixes include Warehouse categories/subcategories, kit-component safeguards, Locations/project-like improvements, and UI/cosmetic refinements.

## Transition Readiness

```text
Customer independently used the Week 6 trial: Yes
Product currently used outside review meetings: No
Current usage: Demonstration/testing only
Deployed or operated on customer side: No
Current handover level: Week 6 trial / handover candidate
Ready parts: Task Manager, Warehouse basics, Locations basics, Dashboard customization
Parts requiring changes: Warehouse taxonomy and kit safeguards, Locations archive/workflow, request-to-task linking, UI polish
Team-side blockers: Week 7 fixes, deployment documentation, handover support
Customer-side blockers: Product not yet deployed on customer side
External blockers: None explicitly stated
Required Week 7 actions: Fix agreed Warehouse and Locations issues, provide deployment documentation, coordinate transition
Customer confirmed readiness after Week 7 work: Yes
Conditions: Discussed fixes are completed and product is deployed / handed over
Documentation feedback: Customer stated documentation looked fine after opening the repository link
Evidence/timecodes: 00:56:21 - 01:02:25
```

## Customer Approvals & Agreements

| Item | Status |
| :--- | :--- |
| Documentation familiarity | Customer stated it was fine after opening repository link |
| Product currently used outside demos | No |
| Ready for use after Week 7 fixes/deployment | Yes |
| Product owner after handover | Customer agreed to be owner |
| Need for support | Support would be useful if available |

## Action Items

- [ ] **Team:** Complete agreed Week 7 fixes before MVP v3 handover.
- [ ] **Team:** Prepare and provide deployment / handover documentation.
- [ ] **Team:** Share backend/API endpoint changes with the other team working on Go.
- [ ] **Team:** Support deployment, backups, updates, and issue tracker setup if possible.
- [ ] **Customer:** Review final Week 7 build and documentation before final acceptance confirmation.
