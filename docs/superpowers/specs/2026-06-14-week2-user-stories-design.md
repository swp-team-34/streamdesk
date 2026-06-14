# Week 2 User Stories Design

## Personas

- Production worker
- Manager
- Streamer
- Editor

The current requirements explicitly describe production-worker and manager workflows. Streamer and editor remain documented personas, but no unsupported stories will be invented for them.

## Story Set

The ten supplied requirements will be preserved as active user stories with stable IDs:

- `US-01`: Reserve equipment from storage — Should Have
- `US-02`: View scheduled tasks in a calendar — Must Have
- `US-03`: View work completion progress — Should Have
- `US-04`: View recording-place status — Could Have
- `US-05`: Organize tasks on a dashboard — Must Have
- `US-06`: Show equipment requests in task previews — Should Have
- `US-07`: Report on-site issues — Could Have
- `US-08`: View work progress in real time — Should Have
- `US-09`: Show concise task details in calendar cells — Must Have
- `US-10`: Order dashboard tasks by deadline — Must Have

The requirements originally labelled non-functional are treated as user stories because they describe visible user behaviour. Their real-time, concise-display, and ordering aspects will also be recorded as constraints.

## Initial Proposed MVP v1 Scope

The initial proposed MVP v1 scope contains:

- `US-02`
- `US-05`
- `US-09`
- `US-10`

This produces two related manager workflows:

1. Review scheduled, current, and delayed tasks through a calendar whose cells show concise task information.
2. Review and organize tasks through a dashboard ordered by deadline urgency.

## Part 3 Implications

The graphical prototype must cover both the calendar and dashboard workflows, including navigation between them. It should demonstrate representative normal, empty, and error states, plus visually distinct delayed or deadline-critical tasks.

