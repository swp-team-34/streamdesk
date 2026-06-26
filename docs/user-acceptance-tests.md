# User acceptance tests (cover US-002, US-003, US-009)

## UAT-001: Identify Delayed vs. On-Schedule Tasks in Calendar

- Status: Active

- User Goal: As a manager, I want to view all scheduled tasks in a calendar so that I can easily distinguish current and delayed work.

- Preconditions: The calendar contains tasks assigned to various dates, including at least 3 tasks with deadlines that have passed (delayed) and at least 5 tasks with deadlines in the future (current). The user is on the Calendar tab.

### Step-by-step Instructions

- Set the calendar format to "Month" to get an overview of the entire schedule.
- Observe the visual styling (e.g., color, badge, or icon) of task entries in past date cells versus future date cells.
- Click on a past date cell containing delayed tasks and review the task cards.
- Click on a future date cell containing current tasks and review the task cards.
- Expected Outcome: Delayed tasks (past deadlines) are visually distinguishable from current tasks (e.g., red highlight, warning icon) directly in the calendar cells. Both types display priority and deadline, but the delayed status is immediately apparent without opening the task.

### Assignment-Specific Execution Results (To be filled)

### Customer Comments or Observed Issues (To be filled)

### Resulting PBIs or Issues (To be filled)

## UAT-002: Monitor Task Completion Progress from the Dashboard

- Status: Active

- User Goal: As a manager, I want to see the current completion level of work (task description has a completion bar) so that I can manage the team's workload.

- Preconditions: The user has several tasks with varying completion progress. Each task's description field contains a completion bar or progress indicator. The user is on the Dashboard.

### Step-by-step Instructions

- View the task list on the Dashboard without filtering or grouping.
- Create a new task starting from the current interface and set deadline to the new task.
- Return to the Dashboard view and locate the new task. Observe which details are seen in the task's preview.
- Locate the task with partial completion and observe how the progress is presented (e.g., a filled progress bar, text with amount of completed tasks out of all, or both).
- Use the grouping feature to group tasks by Priority and verify that the progress bar remains visible within each group.
- Apply a filter for "In Progress" status (if available) and confirm the completion bars update accordingly.
- Expected Outcome: The completion bar is clearly visible in the task list on the Dashboard for every task. Grouping and filtering do not hide or obscure the progress indicator, allowing the manager to assess workload distribution and identify stuck tasks at a glance.

### Assignment-Specific Execution Results (To be filled)

### Customer Comments or Observed Issues (To be filled)

### Resulting PBIs or Issues (To be filled)

## UAT-003: Read Task Essentials Directly from Calendar Cells

- Status: Active

- User Goal: As a manager, I want calendar cells to show the most important task information concisely so that I can understand the schedule without opening every task.

- Preconditions: The user has tasks assigned across multiple dates, each containing a name, priority (High/Medium/Low), and deadline. The user is on the Calendar tab.

- Step-by-step Instructions:

- Set the calendar view to "7 Days" to see a moderate number of tasks per cell.
- Without clicking anything, scan the tasks displayed in any given cell.
- Note which attributes are displayed (e.g., task name, priority badge, deadline time).
- Switch to "Month" view and observe how the same task information is condensed (e.g., shortened names, priority icons).
- Verify that no task requires a click to reveal its priority or deadline.
- Switch to "1 Day" to see the tasks scheduled within the timeline of one day.
- Verify that deadline of each task is clear enough and none of the important details (e.g. priority icons) are included as well.
- Switch to "3 Days" to see the tasks scheduled within the timeline of three days.
- Verify that deadline of each task is clear enough and none of the important details (e.g. priority icons) are included as well.
- Expected Outcome: Every task in a calendar cell displays at minimum the task name, a visual priority indicator (e.g., color-coded dot or badge), and the deadline time. The information remains legible and non-truncated in "7 Days" view, is appropriately abbreviated but still complete in "Month" view, and clearly showing the deadline along with the other details in time in "1 Day" and "3 Days" view. The manager can grasp the schedule's density and criticality without drill-down.

### Assignment-Specific Execution Results (To be filled)

### Customer Comments or Observed Issues (To be filled)

### Resulting PBIs or Issues (To be filled)

