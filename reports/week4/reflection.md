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
[How the team will respond in the next Sprint or assignment, with links to affected PBIs, quality requirements, UAT scenarios, CI checks, milestones, releases, or documentation where relevant.]