# Week 4 Reflection

## Learning points
- **From responding to customer feedback**: we learned some technical details ([customer feedback RT](customer%20feedback%20RT.md))
- **From defining quality requirements**: We learned how to prevent bugs during the developing by writing the quality requirements.
- **From configuring CI**: We learned how to prevent merging code with bugs.

## Validated assumptions
- **Assumption:** We assumed that the initial task creation flow was intuitive enough for the user. 
- **Result:** **Confirmed.** The customer successfully created boards, columns, and tasks without help and described the process as easy.
- **Assumption:** We assumed that the calendar view layout was visually robust and would handle varying amounts of task information gracefully. 
- **Result:** **Rejected.** The customer identified a UI bug where task cards stretch downwards awkwardly when containing excessive text, making the interface appear broken.
- **Assumption:** We assumed that users would be comfortable clicking into a task to view details and edit it. 
- **Result:** **Rejected.** The customer explicitly requested drag-and-drop functionality to move and edit tasks directly on the calendar, indicating our assumption about their preferred editing workflow was incorrect.

## Friction and gaps
- **UI/UX Gap (Visual Bug):** The calendar task cards do not handle text overflow properly. When a task has a long description or title, the card stretches vertically in an awkward way, breaking the visual consistency of the calendar grid.
- **Feature Gap (Direct Manipulation):** The calendar view currently lacks drag-and-drop capabilities. The customer expects to be able to move tasks between time slots directly on the calendar interface.
- **Feature Gap (Visual Cues):** There is no visual indication of deadline proximity. The customer suggested color-coding tasks to show how close a deadline is, which is currently missing.
- **Testing Gap (Overlap Verification):** Although the moderator confirmed that task overlap logic works correctly on the backend, there is currently no automated UI test or specific UAT step dedicated to verifying that overlapping tasks render correctly without visual clutter on the frontend.

## Planned response
To address the gaps and friction identified during the Sprint Review, we have adapted the Product Backlog with the following actions:

1. **Fix UI Stretching Bug:** We created a Bug PBI to investigate and fix the CSS/layout issue where calendar task cards stretch awkwardly with excessive text. 
   *Link:* [Issue #90 - Bug: move of elements](https://github.com/swp-team-34/streamdesk/issues/90)
2. **Implement Drag-and-Drop:** We added a new User Story to the backlog for implementing drag-and-drop functionality for moving and editing tasks directly on the calendar interface. Due to its complexity, it will be refined and prioritized for the next Sprint.
   *Link:* [Issue #112 - Add drag-and-drop support for calendar tasks](https://github.com/swp-team-34/streamdesk/issues/112)
3. **Implement Deadline Color-Coding:** We created a User Story to evaluate and implement dynamic color-coding for calendar tasks based on deadline proximity.
   *Link:* [Issue #114 - Add color-coding for tasks based on deadline proximity](https://github.com/swp-team-34/streamdesk/issues/114)
4. **Implement task overlapping avoidance:** We captured Customer's wish to avoid task overlapping in calendar in a new User Story when the feature itself was already implemented to review the feature in the future for acceptance by the Customer.
   *Link:* [Issue #113 - Avoid tasks UI overlapping](https://github.com/swp-team-34/streamdesk/issues/113)
5. **Fix task description overflow bug:** We created a Bug PBI to investigate and fix the info overflow issue where the short info about the task doesn't fit into the task card in calendar.
   *Link:* [Issue #113 - Bug: Text information overflow in task card at Calendar page](https://github.com/swp-team-34/streamdesk/issues/111)
