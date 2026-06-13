# User Stories

**Responsible:** @rrafich

## Product Context

StreamDesk is a production workflow management system for broadcast and event teams. It covers equipment inventory, task management, calendar scheduling, and real-time monitoring in one interface.

## User Roles / Personas

| Role | Description |
|---|---|
| **Production worker** | Field technician who uses equipment from the store and reports issues on location |
| **Manager** | Oversees task execution, schedules, and team workload |
| **Streamer** | Operates streaming gear and monitors broadcast status |
| **Editor** | Post-production specialist managing recording places and media assets |

---

## US-01: Reserve equipment from store

**Requirement status:** Active
**MoSCoW priority:** Should Have

As a production worker,
I want to take equipment from the store,
so that I can secure it for myself for an upcoming event.

### Notes and constraints

Equipment reservation must update inventory availability in real time so other workers see the current stock.

---

## US-02: View tasks in calendar format

**Requirement status:** Active
**MoSCoW priority:** Must Have

As a manager,
I want to see all the tasks scheduled in calendar format,
so that seeing current and delayed tasks will be visually easier.

### Notes and constraints

Calendar must highlight overdue tasks distinctly. Week and month views are both useful.

---

## US-03: Monitor work completion level

**Requirement status:** Active
**MoSCoW priority:** Must Have

As a manager,
I want to see the current level of work completion,
so that work will be manageable and I can identify blockers early.

### Notes and constraints

Completion percentage should aggregate across tasks, assignees, and deadlines.

---

## US-04: See recording place statuses

**Requirement status:** Active
**MoSCoW priority:** Must Have

As a production worker,
I want to see the recording places status,
so that equipment management will be more optimized and I avoid conflicts with occupied locations.

### Notes and constraints

Status should reflect real-time occupancy and equipment availability per location.

---

## US-05: Dashboard task overview

**Requirement status:** Active
**MoSCoW priority:** Must Have

As a manager,
I want to organize all tasks in a dashboard,
so that it will be easier to manipulate the process of current tasks.

### Notes and constraints

Dashboard should support filtering by assignee, status, and deadline. Tasks ordered by deadline by default (see US-10).

---

## US-06: Equipment requests visible on task preview

**Requirement status:** Active
**MoSCoW priority:** Could Have

As a production worker,
I want my requests for taking equipment to be visible on the task/issue preview,
so that the team context is clear without opening the full task.

### Notes and constraints

This is a convenience feature. Equipment request summaries shown inline in the task card are sufficient for MVP scope.

---

## US-07: Mark on-location issues

**Requirement status:** Active
**MoSCoW priority:** Should Have

As a production worker,
I want to mark issues that occurred on location,
so that my superiors will be notified and can respond promptly.

### Notes and constraints

Issues should trigger a notification to the responsible manager. Severity levels (minor / critical) may be added later.

---

## US-08: Real-time work level updates

**Requirement status:** Active
**MoSCoW priority:** Must Have

As a manager,
I want to see the current level of work in real time,
so that I can coordinate the work correctly without waiting for manual status updates.

### Notes and constraints

WebSocket-based live updates are already scaffolded in the codebase. Polling fallback acceptable for MVP v1.

---

## US-09: Concise task info in calendar cells

**Requirement status:** Active
**MoSCoW priority:** Should Have

As a manager,
I want to see the most important information about a task in a concise format in the calendar cells,
so that I can assess the workload at a glance without opening each task.

### Notes and constraints

Calendar cell should show: task title, assignee avatar, and status indicator. Truncation with tooltip is acceptable.

---

## US-10: Tasks ordered by deadline in dashboard

**Requirement status:** Active
**MoSCoW priority:** Should Have

As a manager,
I want to see the tasks in the dashboard in the order of deadlines,
so that deadline-burning tasks are visible first and nothing is missed.

### Notes and constraints

Default sort by nearest deadline. User should be able to toggle sort order.

---

## Initial proposed MVP v1 scope

The following Must Have stories form the initial proposed MVP v1 scope:

- **US-02** — View tasks in calendar format
- **US-03** — Monitor work completion level
- **US-04** — See recording place statuses
- **US-05** — Dashboard task overview
- **US-08** — Real-time work level updates

These stories represent the core management and coordination workflows. They are small enough to prototype and discuss meaningfully with the customer.
