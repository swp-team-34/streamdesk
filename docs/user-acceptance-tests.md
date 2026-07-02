# User Acceptance Tests

## UAT-001 — Create and Track Task Status

- Scenario ID: UAT-001
- Title: Create a task and verify its progress/status visibility
- Status: Passed
- Related feature: Task Manager

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

- Scenario ID: UAT-002
- Title: Create a task with time information and verify it appears in the calendar
- Status: Passed
- Related feature: Task Manager / Calendar

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

- Scenario ID: UAT-003
- Title: Create a task and verify its short overview in the calendar
- Status: Passed
- Related feature: Calendar

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
