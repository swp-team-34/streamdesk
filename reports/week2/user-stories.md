# User Stories

## Product Context

StreamDesk is a production workflow management system for broadcast teams. It
combines task planning, equipment coordination, recording-place monitoring, and
work-progress tracking in one interface.

The identified user roles are:

- **Production worker:** uses equipment and recording spaces and reports
  operational issues.
- **Manager:** plans work, monitors progress, and coordinates tasks.
- **Streamer:** conducts live broadcasts using production resources.
- **Editor:** prepares and processes recorded media.

The current requirements focus on production workers and managers. Stories for
streamers and editors will be added after their workflows are clarified with
the customer.

## User Stories

### US-01: Reserve equipment from storage

**Requirement status:** Active

**MoSCoW priority:** Should Have

As a production worker,
I want to reserve and take equipment from storage,
so that I can secure the equipment required for my work.

#### Notes and constraints

The system should distinguish available, reserved, and unavailable equipment.
The approval and return processes still require clarification.

### US-02: View tasks in a calendar

**Requirement status:** Active

**MoSCoW priority:** Must Have

As a manager,
I want to view all scheduled tasks in a calendar,
so that I can easily distinguish current and delayed work.

#### Notes and constraints

Task dates and delayed status must be visually clear. This story is included in
the initial proposed MVP v1 scope.

### US-03: View work completion progress

**Requirement status:** Active

**MoSCoW priority:** Should Have

As a manager,
I want to see the current completion level of work,
so that I can manage the team's workload.

#### Notes and constraints

The method used to calculate completion must be agreed with the customer.

### US-04: View recording-place status

**Requirement status:** Active

**MoSCoW priority:** Could Have

As a production worker,
I want to see the availability and status of recording places,
so that I can coordinate equipment and production work more efficiently.

#### Notes and constraints

Possible statuses include available, occupied, reserved, and unavailable. The
final status model requires customer confirmation.

### US-05: Organize tasks on a dashboard

**Requirement status:** Active

**MoSCoW priority:** Must Have

As a manager,
I want to organize all tasks on a dashboard,
so that I can manage the current production process more easily.

#### Notes and constraints

The dashboard should provide a clear overview and access to individual task
details. This story is included in the initial proposed MVP v1 scope.

### US-06: Show equipment requests in task previews

**Requirement status:** Active

**MoSCoW priority:** Should Have

As a production worker,
I want my equipment requests to be visible in the related task preview,
so that the equipment required for the task is clear to the team.

#### Notes and constraints

The preview should show the requested equipment and request status without
overloading the task summary.

### US-07: Report on-site issues

**Requirement status:** Active

**MoSCoW priority:** Could Have

As a production worker,
I want to report issues that occur at a production location,
so that my managers are notified and can respond.

#### Notes and constraints

Issue categories, severity levels, and notification channels require
clarification.

### US-08: View progress in real time

**Requirement status:** Active

**MoSCoW priority:** Should Have

As a manager,
I want to see work progress updates in real time,
so that I can coordinate the team's work using current information.

#### Notes and constraints

Relevant updates should appear without a manual page reload. The acceptable
update delay requires technical validation.

### US-09: Show concise task details in calendar cells

**Requirement status:** Active

**MoSCoW priority:** Must Have

As a manager,
I want calendar cells to show the most important task information concisely,
so that I can understand the schedule without opening every task.

#### Notes and constraints

The initial prototype should show at least the task title, scheduled time or
deadline, and status. This story is included in the initial proposed MVP v1
scope.

### US-10: Order dashboard tasks by deadline

**Requirement status:** Active

**MoSCoW priority:** Must Have

As a manager,
I want dashboard tasks to be ordered by deadline urgency,
so that tasks approaching or exceeding their deadlines are visible first.

#### Notes and constraints

Overdue tasks should be visually distinguishable from upcoming tasks. This
story is included in the initial proposed MVP v1 scope.

## Acceptance Criteria

### US-01

- A production worker can identify equipment available for reservation.
- Reserved or unavailable equipment is not displayed as freely available.
- A successful reservation is associated with the requesting worker.

### US-02

- A manager can view scheduled tasks by date in the calendar.
- Current and delayed tasks are visually distinguishable.
- The manager can navigate between relevant calendar periods.

### US-03

- A manager can see a completion indicator for applicable work.
- The indicator reflects the latest recorded progress.
- Tasks without progress data are clearly identified.

### US-04

- A production worker can view the current status of each recording place.
- Available and unavailable recording places are visually distinguishable.
- An empty state is shown when no recording places are configured.

### US-05

- A manager can open a dashboard containing current tasks.
- Each item contains enough information to identify the task.
- The manager can open a task to inspect its details.

### US-06

- A task preview shows equipment requested for that task.
- Each request includes its current status.
- An empty state is shown when there are no equipment requests.

### US-07

- A production worker can submit an issue for a production location.
- The report contains a description of the issue.
- The system confirms submission or displays an understandable error.

### US-08

- A manager sees progress changes without manually reloading the page.
- The interface indicates when live updates are unavailable.
- Incoming updates do not remove existing task information.

### US-09

- A calendar task cell displays the task title.
- It displays the scheduled time or deadline and current status.
- The information is readable without opening the full task.

### US-10

- Dashboard tasks are ordered by deadline urgency.
- Overdue tasks appear before tasks with future deadlines.
- Tasks with the same deadline use a consistent secondary ordering.

## Priorities

| ID | Short title | Requirement status | MoSCoW priority |
| --- | --- | --- | --- |
| US-01 | Reserve equipment from storage | Active | Should Have |
| US-02 | View tasks in a calendar | Active | Must Have |
| US-03 | View work completion progress | Active | Should Have |
| US-04 | View recording-place status | Active | Could Have |
| US-05 | Organize tasks on a dashboard | Active | Must Have |
| US-06 | Show equipment requests in task previews | Active | Should Have |
| US-07 | Report on-site issues | Active | Could Have |
| US-08 | View progress in real time | Active | Should Have |
| US-09 | Show concise task details in calendar cells | Active | Must Have |
| US-10 | Order dashboard tasks by deadline | Active | Must Have |

## Initial proposed MVP v1 scope

The initial proposed MVP v1 scope contains:

- `US-02` - View tasks in a calendar
- `US-05` - Organize tasks on a dashboard
- `US-09` - Show concise task details in calendar cells
- `US-10` - Order dashboard tasks by deadline

Together, these stories form two connected manager workflows: reviewing work in
a calendar and managing deadline-prioritized tasks through a dashboard.
