# Customer Sprint Review Summary

## Meeting Details

- **Date:** 2026-06-28
- **Format:** Video Call
- **Participants:** Developer, Customer

## Session Note

The meeting functioned as a Sprint Review for Sprint 2. The Developer demonstrated the completed work to the Customer, focusing on the new Calendar feature and fixes applied to the Task Manager. The Customer actively provided feedback and confirmed feature requirements throughout the session.

## Agenda

1. Obtain recording permission from the Customer.
2. Review Sprint 2 goals (Calendar implementation and Task Manager fixes).
3. Present the technical demo (Calendar capabilities, configuration settings, and Task Manager views).
4. Discuss Quality Assurance indicators (CI/CD, UAT, protected routes).
5. Address project risks, incomplete items, and the next sprint's roadmap.

## Discussion Points

- **Calendar Implementation:** The Developer showcased all-day tasks, fluid drag-and-drop actions, and manual card stretching. Tasks change colors dynamically based on deadline proximity. Multiple layouts are supported (3 days, 1 day, list, month).
- **Local User Settings:** Users can individually configure their calendar view, including activating a compact layout and narrowing working hour visibility (e.g., from 10:00 to 20:00). The Customer confirmed understanding that these preferences are strictly local.
- **Task Manager Adjustments:** Interface clutter was reduced by hiding complex filters. The Customer inquired if tags/labels are shared across the system; the Developer clarified that labels are uniquely bound to specific boards. Custom fields remain in active development.
- **QA & Technical Controls:** Continuous Integration (CI) and automated validation runs via GitHub Actions pass cleanly on every Pull Request. Core system application routes are locked down against unauthorized or unauthenticated users. User Acceptance Testing (UAT) completed successfully.
- **Roadmap & Constraints:** Minor dragging bugs are present in the Task Manager columns and will be addressed shortly. Development for the "Warehouse" feature is scheduled to begin next week. Parallel bug resolution might slightly shift the Warehouse timeline, prioritizing Calendar and Task Manager stability.

## Customer Approvals & Agreements

| Item                        | Status                                                             |
| :-------------------------- | :----------------------------------------------------------------- |
| Sprint 2 Baseline           | Approved by the Customer ("Everything is good, I like it")         |
| Recording Authorization     | Granted                                                            |
| Outstanding Task Management | Agreed to roll incomplete tasks over and share the status via chat |

## Action Items

- [ ] **Developer:** Fix remaining visual anomalies during column repositioning within the Task Manager.
- [ ] **Developer:** Conclude active development on custom fields before closing out the sprint day.
- [ ] **Developer:** Post a final status delta report to the shared channel if any remaining edge-case tasks require migration.
- [ ] **Developer:** Initialize the structure for the "Warehouse" module next week while maintaining focus on ongoing stabilization.

---
