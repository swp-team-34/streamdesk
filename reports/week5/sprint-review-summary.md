*Customer Sprint Review Summary and Customer UAT Review Summary are collected in this file*

# Customer Sprint Review Summary

## Meeting Details

- **Sprint:** Sprint 3 (Week 5)
- **Format:** Video Call
- **Participants:** Team member, Customer

## Session Note

The meeting functioned as a Sprint Review for Sprint 3. The Team Member demonstrated the completed work via screen share (as the Customer was lacking VPN access). The focus was on Task Manager fixes, Dashboard widget additions, and the new Warehouse functionality. The Customer actively provided feedback and approved the progress.

## Agenda

1. Review Sprint 3 goals (Task Manager bug fixes, Dashboard updates, and Warehouse functionality).
2. Present the technical demo (Dashboard widgets, Task Manager label groups, Warehouse kit assembly).
3. Address project bugs, incomplete items, and the next sprint's roadmap.

## Discussion Points

- **Task Manager Adjustments:** The column dragging synchronization bugs ("jumping around") have been fixed. New filters for workload and locations were added. A new feature for "label groups" (similar to Jira) was introduced, allowing users to group multiple tags (e.g., 'Semester 1' groups math and other subjects) and filter by them collectively.
- **Dashboard Updates:** Two new widgets were added to display task statistics sorted by deadlines, assignees, locations, and tags. Drag-and-drop dashboard interactivity is planned for the future.
- **Warehouse Module:** Demonstrated item tags ('working', 'not working') and the ability to assemble/disassemble kits. Individual items locked within an assembly cannot be checked out separately. Cart/request logic was shown. A bug was identified where tasks were failing to attach to requests, which will be investigated. The barcode display functionality was also validated.
- **QA & Technical Controls:** Continuous Integration (CI) via GitHub Actions is passing ("green") on all Pull Requests. Tests were updated this sprint, and comprehensive system/process architecture diagrams were generated.
- **Roadmap & Constraints:** When deploying to an existing database, the team will ensure data safety by implementing proper migrations. Remaining warehouse features will be finalized next, followed by full dashboard implementation.

## Customer Approvals & Agreements

| Item                    | Status                                               |
| :---------------------- | :--------------------------------------------------- |
| Sprint 3 Baseline       | Approved by the Customer ("Yes, everything is good") |
| Recording Authorization | Granted (initially jokingly denied, then approved)   |
| Post-Meeting Testing    | Customer will perform additional independent testing |

## Action Items

- [ ] **Developer:** Investigate and fix the bug preventing tasks from attaching to requests in the Warehouse module.
- [ ] **Developer:** Prepare database migrations to ensure safe deployments without data loss.
- [ ] **Developer:** Finalize the remaining Warehouse module functionality.
- [ ] **Developer:** Begin work on the interactive (draggable) Dashboard layout.

---

# Customer UAT Review Summary

## Meeting Details

- **Date:** 03-07-2026
- **Format:** Video Call / Screen Sharing
- **Participants:** Team Member, Customer

## Session Note

The meeting functioned as a User Acceptance Testing (UAT) session for the current sprint. The Team Member guided the Customer through interactive testing of the Warehouse module, Task Manager, and Calendar feature. The Customer successfully navigated the interfaces, triggered expected system validations, and provided actionable UI/UX feedback.

## Agenda

1. Obtain recording and transcription permission from the Customer.
2. Conduct UAT for the Warehouse module (navigation, filtering, error handling).
3. Conduct UAT for the Task Manager (UI layout, date validation, participant grouping).
4. Conduct UAT for the Calendar feature (drag-and-drop actions, view switching).
5. Discuss Quality Assurance (GitHub Actions, architecture documentation, ongoing bug fixes) and next steps.

## Discussion Points

- **Warehouse Module:** The Customer successfully located the module via the burger menu and navigated filters (storage location, equipment status). The system successfully prevented the Customer from issuing broken equipment, which was validated as a positive feature. A minor count discrepancy was noted.
- **Task Manager Adjustments:** The Customer provided feedback regarding overlapping UI elements (action buttons on cards) when multiple cards are present or screen sizes change; this was noted for responsive design improvements. The Customer successfully tested date validations (preventing negative deadlines) and participant sorting.
- **Calendar Implementation:** The Customer tested drag-and-drop functionality across different views (3 days, month). Overdue tasks correctly displayed in red. Invalid drag-and-drop actions (dragging a task to an invalid area) correctly triggered an error state without breaking the UI.
- **QA & Technical Controls:** Continuous Integration (CI) is passing cleanly with all GitHub Actions lighting up green on pull requests. Test coverage was expanded in the current sprint. System and procedural architecture diagrams have been finalized.
- **Roadmap & Constraints:** A known bug exists within the Warehouse projects section, which is prioritized for resolution. The immediate roadmap includes finalizing Warehouse stabilization before moving on to the Dashboard module.

## Customer Approvals & Agreements

| Item                    | Status                                                                 |
| :---------------------- | :--------------------------------------------------------------------- |
| Feature Acceptability   | Approved by the Customer ("Yeah, it's convenient, everything is fine") |
| Recording Authorization | Granted                                                                |

## Action Items

- [ ] **Team Member:** Resolve the identified bug in the Warehouse projects section.
- [ ] **Team Member:** Review and fix the UI overlap issue on Task Manager cards for smaller screen sizes/high card densities.
- [ ] **Team Member:** Begin development on the Dashboard module once the Warehouse feature is fully finalized.
- [ ] **Customer:** Conduct independent exploratory testing and submit any additional feedback to Team34 for backlog inclusion.

