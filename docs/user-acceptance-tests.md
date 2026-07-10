# User Acceptance Tests

## UAT-001 — Create and Track Task Status

- **Scenario ID:** UAT-001
- **Title:** Create a task and verify its progress/status visibility
- **Status:** Passed
- **Related feature:** Task Manager

### Objective
Verify that the customer can create a task in the Task Manager and see its current progress or time-related status.

### Preconditions
The user is logged into the system and has access to the Task Manager.

### Test steps

- Open the Task Manager.
- Create a new task.
- Fill in the task title and basic task details.
- Set a due date or deadline for the task.
- Save the task.
- Find the created task in the Task Manager.
- Check whether the task shows its current status, such as upcoming, close to deadline, completed, or overdue.

### Expected result
The created task is visible in the Task Manager. The user can clearly see the task status and understand whether the task is on time, close to the deadline, completed, or overdue.

### Execution result
The user successfully created a board, column, and task. The process was described as easy and intuitive. The deadline status was clearly visible and understandable to the user.

## UAT-002 — Create Task with Time Management and Verify Calendar Display

- **Scenario ID:** UAT-002
- **Title:** Create a task with time information and verify it appears in the calendar
- **Status:** Passed
- **Related feature:** Task Manager / Calendar

### Objective
Verify that a task with assigned time management data is correctly displayed in the calendar.

### Preconditions
The user is logged into the system and has access to both the Task Manager and Calendar.

### Test steps

- Open the Task Manager.
- Create a new task.
- Add a task title and basic task details.
- Add time management information, such as start time, end time, or deadline.
- Save the task.
- Open the Calendar.
- Navigate to the relevant day, week, or month.
- Check whether the created task appears in the correct calendar time slot.

### Expected result
The task is created successfully and appears in the Calendar according to the assigned date and time. The displayed timing matches the time management information entered in the Task Manager.

### Execution result
The user easily located the created task on the calendar. However, the user identified a UI issue: when a task card contains too much information, it visually stretches downwards, making the interface appear broken.

## UAT-003 — Create Task and Verify Calendar Overview

- **Scenario ID:** UAT-003
- **Title:** Create a task and verify its short overview in the calendar
- **Status:** Passed
- **Related feature:** Calendar

### Objective
Verify that the customer can see a short overview of a created task directly from the Calendar.

### Preconditions
The user is logged into the system and has access to the Task Manager and Calendar.

### Test steps

- Open the Task Manager.
- Create a new task.
- Add a task title, description, deadline, and status if available.
- Save the task.
- Open the Calendar.
- Find the created task in the calendar.
- Click or hover over the task in the calendar.
- Check whether a short overview of the task is displayed.

### Expected result
The task is visible in the Calendar. The user can open or preview a short task overview, including key information such as title, date/time, status, and basic task details.

### Execution result
The user easily observed the overview of the task from the Calendar. The information in the short overview was precise and concise enough.

## UAT-004: Verify Equipment features: Equipment Store, Operability, and Task Preview Integration

- **Scenario ID:** UAT-004
- **Title:** Verify Equipment Store, Operability, and Task Preview Integration
- **Status:** Passed
- **Related feature:** Task Manager, Equipment store

### Objective
Verify that a production worker can view complete equipment details (location, responsible person, operability status), request equipment with proper validations, and see those requests accurately reflected in the related task or issue preview.

### Preconditions
The user is logged into the system and has access to the Equipment Store and Task Manager.

### Test steps

- Open the Equipment Store page.
- Verify that a skeleton loading state appears while data is loading.
- After loading, verify each item displays: storage location (room/shelf/zone), responsible person name, and contact details.
- Verify each item displays an operability status: "working", "broken", or "on repair".
- Apply the "working" status filter and confirm only working items are listed.
- Apply the "broken" status filter and confirm only broken items are listed.
- Apply the "on repair" status filter and confirm only "on repair" items are listed.
- Select a "broken" equipment item and attempt to create a taking request. Verify the system blocks the request and shows an error.
- Select a "working" equipment item. Attempt to submit a taking request while leaving a required field (e.g., quantity) blank. Verify a validation error appears.
- Fill in all required fields for the "working" item, link the request to an existing task/issue, and submit it successfully.
- Log in as the Equipment Manager. Edit the storage location and operability status of an existing item. Save and reload the page. Verify the changes are persisted.
- Log out and log back in as the standard Production Worker (non-manager). Open the equipment list. Verify the statuses are visible, but edit/change controls for status are not available.
- Navigate to the task/issue that was linked in step 10 and open its preview pane.
- Verify the preview shows the request summary, including equipment name, requester name, quantity, and current request status.
- As the Manager, approve the request. Refresh the task/issue preview and verify the displayed status updates to "Approved".

### Expected result
All steps execute without errors. The equipment store displays the correct loading state, location details, contact info, and operability statuses. Status filters work accurately. The system blocks requests for broken/on-repair items and enforces mandatory fields for working ones. Authorized edits persist correctly, while non-managers can view but not modify statuses. The task preview correctly displays the equipment request summary (name, requester, quantity, status) and updates immediately to reflect the latest approval/rejection status.

### Execution result
The user easily and intuitively executed the whole process with no complainings or errors found.

## UAT-005 — Verify Task Manager features: Workload, Deadline Ordering, Calendar Color-Coding, and Drag-and-Drop

- **Scenario ID:** UAT-005
- **Title:** Verify Manager Dashboard workload tracking, deadline-based task ordering, Calendar color-coding, and drag-and-drop deadline management
- **Status:** Passed
- **Related feature:** Task Manager, Calendar

### Objective
Verify that managers can monitor real-time workload with grouping options, view tasks sorted by deadline urgency, see color-coded burning/overdue tasks in the calendar, and easily adjust deadlines via drag-and-drop.

### Preconditions
The user is logged into the system and has access to the Calendar and Task Manager. Several tasks with designated deadlines already exist.

### Test steps

- Open the Task Manager.
- After loading, verify the work level widget displays counts for active, completed, overdue, and in-progress tasks.
- In the task list, verify tasks are sorted by deadline in ascending order (nearest deadline first).
- Verify that overdue tasks appear before any future-dated tasks and are visually marked as overdue.
- Verify that tasks with no assigned deadline are placed at the very bottom of the list.
- Verify that tasks sharing the same deadline are secondarily sorted by priority or creation time.
- Apply the "group by team member" filter and verify workload values split per team member.
- Apply the "group by location" filter and verify workload values split per location.
- Open the Calendar page. Locate (or create) a task with a deadline within the next 24 hours. Verify it displays a distinct warning color (e.g., orange or red) on its card.
- Locate an overdue task. Verify it displays a different, more urgent color (e.g., dark red) on its card.
- Verify the color-coding is applied to the card's background, border, or a prominent badge.
- Refresh the calendar view and verify the color-coding persists and updates correctly based on current time thresholds.
- In the Calendar, drag a task card from one day cell and drop it onto a different day cell. Verify the target cell highlights as a valid drop zone during the drag.
- After the drop, verify the task's deadline date updates in the system and persists after a page refresh.
- Drag the same task and drop it outside any valid calendar cell (e.g., onto the sidebar). Verify the task reverts to its original position and an appropriate error message is shown.
- Repeat the drag-and-drop test (successful and failed) in the 1 Day, 3 Days, 7 Days, and Month calendar views. Verify the functionality works in all four formats.

### Expected result
All steps execute without critical errors. The dashboard loads with skeleton states, displays correct workload counts, sorted task lists, and grouped breakdowns. Real-time updates reflect status changes without reloading, and network errors show a message while preserving cached data. The calendar color-codes 24-hour and overdue tasks distinctly using appropriate urgency colors. Drag-and-drop successfully moves task deadlines, persists changes after refresh, reverts on invalid drops, and works consistently across all four calendar views.

### Execution result
All steps are executed with no problems. The coloring is eye-catching enough and the sorting is logical for the user.

## UAT-006 — Verify Recording Place Statuses and Location-Based Issue Reporting

- **Scenario ID:** UAT-006
- **Title:** Verify recording place status visibility, filtering, and issue reporting at production locations
- **Status:** Draft
- **Related feature:** Recording Places, Issue Management

### Objective
Verify that production workers can view and filter recording place statuses (available, occupied, unavailable, under maintenance) and report issues at a location, with real-time visibility for managers.

### Preconditions
One or two users can take the roles of production worker and manaer for feature testing; the system contains recording places with various statuses; at least one location/task exists to link issues to.

### Test steps

- Open the Recording Places list or dashboard section.
- Verify a skeleton loading state appears while data loads.
- After loading, verify each place displays its current status (available, occupied, unavailable, or under maintenance) clearly near the place name.
- Apply the "available" status filter and confirm only available places are listed.
- Apply the "occupied" status filter and confirm only occupied places are listed.
- Apply the "unavailable" status filter and confirm only unavailable places are listed.
- Select an "occupied" or "unavailable" place and view its related equipment options. Verify the system indicates that equipment planning for this place may be limited or unavailable.
- Log in as an authorized Manager. Update a recording place status to a new value. Save and reload the page. Verify the status is persisted.
- Log back in as the Production Worker. Navigate to a task, stream, or location page.
- Create a new issue with a valid title, description, and location/work item. Submit it. Verify the system saves the issue and marks it as "reported".
- Attempt to submit another issue with a required field (e.g., title) left empty. Verify the system prevents submission and shows validation errors.
- Log in as the Manager. Open the dashboard or issue list. Verify the newly reported issue appears with its status, reporter, time, and related location/task.
- Log back in as the Production Worker. Update the description of your reported issue and save. Verify the change is persisted.
- As the Manager, refresh the dashboard and verify the issue updates are visible in real time without a manual page reload.

### Expected result
Recording places display correct statuses near their names, filters work accurately, and occupied/unavailable places show equipment planning limitations. Authorized status updates persist after reload. Issues require mandatory fields, save successfully when complete, and appear on the Manager dashboard with full details. Updates and cancellations persist and reflect in real time on authorized dashboards.

### Execution result
To be filled

## UAT-007 — Verify Project-Specific Task Board and Compact/Sortable Task Manager

- **Scenario ID:** UAT-007
- **Title:** Verify project-specific Kanban board creation, membership sync, and Task Manager compact sorting UX
- **Status:** Draft
- **Related feature:** Projects, Task Manager

### Objective
Verify that each project has a dedicated task board synced with project members, and that the Task Manager workspace is compact, sortable by deadline/priority, and optimized for scanning.

### Preconditions
The user takes the role of the manager; multiple projects with assignees and tasks with varying data (deadlines, priorities etc.) exist.

### Test steps

- Open a project that has no linked task board and click its Tasks action. Verify the system creates a dedicated Kanban board for that project (idempotently-clicking again does not create duplicates).
- Open a project that already has a linked board and click Tasks. Verify the Task Manager opens directly to that specific board (not the generic page).
- From the project board, create a new task/card and save it. Verify the card remains associated with the project and is found when reopening Tasks for that project.
- Link an equipment request to this project task/card. Open the task preview and verify the equipment request summary (name, requester, quantity, status) is visible.
- Go to Project Members and add a new user to the project. Open the project task board and verify the new member appears as a board member.
- Remove a member from the project. Sync/refresh the board and verify the board membership reflects the current team, without deleting manually added members not in the project.
- In the Task Manager, locate the sorting controls. Sort cards by deadline and verify overdue cards appear first, then future cards nearest first, and cards without deadlines placed last.
- Sort by priority and then by creation/update time. Verify the order changes accordingly.
- Apply a filter (e.g., by assignee) and sort simultaneously. Verify both operate together without resetting the board or view.
- Verify the statistics block is removed or hidden from the main board workspace on both desktop and mobile views.
- On the list view, verify rows are visually simplified without unnecessary decorative wrappers for easy scanning.
- On a mobile view, verify the top workspace area is compact and keeps board selector, search, filter, and sort controls accessible without pushing the board below the fold.
- Verify secondary actions (settings, create board/list/card, management) are moved to compact icon or overflow controls when space is limited.

### Expected result
Projects correctly create/find dedicated boards idempotently, with membership syncing to project assignments. Tasks and linked equipment requests stay associated with the project board. Sorting works by deadline (overdue first), priority, and time, with no-deadline tasks last. Filters and sorts combine seamlessly. The workspace is compact—statistics removed, list rows simplified, mobile controls accessible, and secondary actions moved to icons/overflow.

### Execution result
To be filled

## UAT-008 — Verify Dashboard Widget Drag-and-Drop Customization

- **Scenario ID:** UAT-008
- **Title:** Verify users can drag and drop Dashboard widgets to rearrange their workspace
- **Status:** Draft
- **Related feature:** Dashboard

### Objective
Verify that managers and users can customize their Dashboard layout by dragging widgets to new positions, with the layout persisting across sessions.

### Preconditions
The user has access to the Task Manager that displays at least 3–4 widgets in a grid layout.

### Test steps

- Open the Dashboard and observe the current widget grid layout.
- Click and drag a widget (e.g., the Work Level widget) from its current position to a new grid position.
- During the drag, verify the widget follows the cursor and that other widgets shift/relocate without overlapping.
- Drop the widget at the new position. Verify the layout updates smoothly.
- Perform a hard page reload (or log out and back in). Verify the widget remains at the new position.
- Drag a second widget to a different position and reload again. Verify both custom positions are preserved.
- Attempt to drag a widget partially outside the grid or onto a non-grid area. Verify the widget snaps back or stays within bounds without breaking the grid layout.

### Expected result
All widgets are draggable. Visual feedback (cursor tracking, shifting neighbors) works smoothly. Dropped positions persist across page reloads and sessions. The grid remains intact with no overlapping or broken elements during and after drag operations.

### Execution result
To be filled
