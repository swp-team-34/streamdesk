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
- **Status:** Active
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
To be filled during the week 5 workflow

## UAT-005 — Verify Task Manager features: Workload, Deadline Ordering, Calendar Color-Coding, and Drag-and-Drop

- **Scenario ID:** UAT-005
- **Title:** Verify Manager Dashboard workload tracking, deadline-based task ordering, Calendar color-coding, and drag-and-drop deadline management
- **Status:** Active
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
To be filled
