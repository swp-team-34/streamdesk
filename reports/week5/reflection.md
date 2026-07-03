# Week 5 Reflection

## Learning points
- **From responding to customer feedback**: we learned some technical details ([customer feedback RT](customer-feedback-RT.md))
- **From documenting the architecture**: We figured out the responsibility of each code block, so now it is easier to change them if needed.
- **From UAT execution**: we learned that customers interact with the product in ways we don't always anticipate. For example, the customer immediately tried to filter equipment by "working condition" and expected the system to prevent issuing broken equipment - which it did, validating our business rules. However, the customer also identified edge cases (overlapping buttons at high card density) that our automated tests didn't cover.

## Validated assumptions
- **Assumption**: The current Warehouse workflow (checkout requests with approve/reject) is intuitive enough for the customer and doesn't require the older date-range reservation interface.
- **Result**: Confirmed. The customer successfully navigated the checkout request flow, understood the status transitions (pending > approved/rejected), and did not request the legacy reservation interface during UAT.
- **Assumption**: The Task Manager UI is sufficiently responsive and does not have significant layout issues at different screen sizes or card densities.
- **Result**: Rejected. The customer immediately pointed out that action buttons on cards overlap when multiple cards are present or when the screen size changes. This was not caught by our automated tests.
- **Assumption**: Centralizing permission evaluation only on the client side (`ADR-001`) is sufficient for `MVP v2`, and server-side route-local checks are adequate.
- **Result**: Partially validated, but risk identified. The client-side evaluator works correctly and is well-tested (100% coverage), but we now explicitly acknowledge the risk of drift between client and server authorization logic. This is documented as a follow-up in `ADR-001`.
- **Assumption**: The current single-VPS deployment model is sufficient for MVP v2 and doesn't require immediate migration to a more scalable architecture.
- **Result**: Confirmed. The customer did not report performance issues during UAT, and the deployment successfully handled the demo session. However, the customer raised concerns about safe database deployments, which we added as a new User Story (`US-019`).

## Needs clarification
**Mobile Task Manager UI**: Should one-card-per-screen mobile layout be a priority for the next sprint, or deferred until Dashboard is complete?
**Dashboard drag-and-drop**: Is this a "Must" for the next sprint or a "Could"?
**Database migrations**: Which deployment scenarios are most critical (adding columns, changing types, data migration)? Are there rollback requirements?
**Post-UAT independent testing**: Waiting for customer's additional feedback after their own exploratory testing.
**Warehouse bug priority**: Which of the identified bugs (tasks not attaching, quantity discrepancy, "Send to project" UI glitch) is most critical?

## Planned response
To address the gaps and friction identified during the Sprint Review, we have adapted the Product Backlog with the following actions:

Added PBIs:

- [Bug: Task Manager card action buttons overlap (Should)](https://github.com/swp-team-34/streamdesk/issues/154)
- [Bug: Task Manager mobile view optimization (Could, deferred)](https://github.com/swp-team-34/streamdesk/issues/155)
- [Bug: Warehouse "Send to project" button UI glitch (Should)](https://github.com/swp-team-34/streamdesk/issues/156)
- [Bug: Tasks failing to attach to checkout requests (Must)](https://github.com/swp-team-34/streamdesk/issues/157)
- [Bug: Minor quantity/count discrepancy in equipment list (Should)](https://github.com/swp-team-34/streamdesk/issues/158)
- [US-018: Dashboard drag-and-drop interactivity (Could)](https://github.com/swp-team-34/streamdesk/issues/159)
- [US-019: Safe database deployments without data loss (Must)](https://github.com/swp-team-34/streamdesk/issues/160)