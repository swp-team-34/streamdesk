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

## UAT-004A: Verify Equipment Destination and Kanban V2 Work Context

- **Scenario ID:** UAT-004A
- **Title:** Verify equipment destination and optional project/Kanban V2 context
- **Status:** Passed
- **Related feature:** Warehouse, Locations, Projects, Kanban V2

### Objective
Verify that checkout and authorized editing keep physical destination separate from work context, reject cross-company or archived selections for new records, and never create new Legacy Task Manager links.

### Preconditions
The user belongs to a company with at least two active Locations, one archived Location, one project, and two Kanban V2 cards linked to that project. A working equipment item belongs to the same company.

### Test steps

- Open a working Warehouse item and start a checkout request.
- Select an active company Location, then optionally select the project and both Kanban V2 cards. Submit the request.
- Verify the manager view shows the destination, project, and both cards. Approve the request and verify the equipment becomes in use at the selected Location.
- Return the item, create another request with a manual destination, and verify the manual text is shown instead of a Location.
- Attempt to select both a Location and manual destination through the API. Verify the request is rejected.
- Attempt to use the archived Location or a Location/project/card from another company. Verify each new relation is rejected while an existing archived destination remains readable in equipment details.
- Edit only the destination and work context of an item. Verify status, holder, reservation state, and operability do not change.
- Select multiple cards from the same project and verify the project equipment summary contains the item only once.
- Verify no Legacy Task Manager selector appears and a direct API attempt to create a new `taskId` relation is rejected.
- Open the Warehouse in a second authenticated session and verify the affected Warehouse/project summaries refresh without a page reload.

### Expected result
The Warehouse persists one physical destination alternative and optional project/multiple-card Kanban V2 context with company authorization. Manual and checkout-created links remain distinguishable, project summaries are deduplicated, archived history stays readable, and context-only edits do not change inventory workflow state.

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

## UAT-006 — Verify Location Statuses and Threaded Topics

- **Scenario ID:** UAT-006
- **Title:** Verify Location status visibility, filtering, and threaded note/problem workflows
- **Status:** Passed
- **Related feature:** Location workspaces, threaded topics, Kanban V2 and project links

### Objective
Verify that production workers can view and filter Location statuses, create separate note/problem topics, discuss them with safe files, and see authorized realtime updates across Locations, Kanban V2, projects, and Dashboard.

### Preconditions
Two users can take the roles of production worker and company manager; the system contains active and archived Locations with different statuses; at least one Location is linked to a project and a Kanban V2 card.

### Test steps

- Open the Locations list or Dashboard section.
- Verify a skeleton loading state appears while data loads.
- After loading, verify each Location displays its current status clearly near the name.
- Apply the "available" status filter and confirm only available places are listed.
- Apply the "occupied" status filter and confirm only occupied places are listed.
- Apply the "unavailable" status filter and confirm only unavailable places are listed.
- Log in as an authorized Manager. Update a Location status to a new value. Save and reload the page. Verify the status is persisted.
- Log back in as the Production Worker. Create a `note` topic with title and description. Verify severity is not requested and the topic remains separate from maintained Location notes.
- Create an `issue` topic with title, description, severity, and optional links to the related project and Kanban V2 card. Verify the initial status is `active`.
- Attempt to submit another topic with a required field left empty or a link from another company. Verify the system rejects it.
- Add a text reply and supported photo/document attachment. Verify author, timestamp, filename, and size are shown. Attempt an unsupported or oversized file and verify it is rejected.
- Open the linked Kanban V2 card, project, and Dashboard widget. Verify each shows a compact active-topic summary and navigates back to the correct Location topic.
- As the Manager, resolve the topic, reopen it, then resolve and archive it. Verify each state is visually distinct and available through filters, while history remains readable.
- Verify a regular member cannot change lifecycle status and cannot read topics from another company.
- With both users online, create a reply and change status. Verify authorized views update without manual reload; disconnect and reconnect one client and verify HTTP refetch restores current state.
- Verify desktop and mobile layouts, empty states, archived Location behavior, and direct links using `locationId` plus `topicId`.

### Expected result
Locations display and filter statuses correctly. Topics preserve author/time history, keep durable notes separate, validate links and files, enforce company access and manager lifecycle permissions, and distinguish active/resolved/archived states. Linked Kanban V2, project, and Dashboard summaries navigate back to the topic and update through realtime events with polling/reconnect fallback.

### Execution result
To be filled

## UAT-007 — Verify Project-Specific Task Board and Compact/Sortable Task Manager

- **Scenario ID:** UAT-007
- **Title:** Verify project-specific Kanban board creation, membership sync, and Task Manager compact sorting UX
- **Status:** Passed
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
- **Status:** Passed
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

## UAT-009 — Verify Warehouse and Project Autosave

- **Scenario ID:** UAT-009
- **Title:** Verify existing Warehouse and project records save automatically and synchronize globally
- **Status:** Passed
- **Related feature:** Warehouse, Projects, Global Sync

### Objective
Verify that valid edits to existing equipment, equipment notes, and projects persist without a Save button, pending changes are not lost when the editor closes, and related views receive synchronized data.

### Preconditions
The user can edit Warehouse equipment and projects. At least one equipment item, project, active Location, and Kanban V2 card exist. A second authorized browser session is available for realtime verification.

### Test steps

- Open an existing equipment item for editing and change its name, storage data, physical destination, project, and Kanban V2 context.
- Verify the editor reports pending and saving states, then reports that all changes are saved without pressing a Save button.
- Close the equipment editor immediately after another valid change, reopen it, and verify the latest value was flushed and persisted.
- Enter an invalid state such as an empty required name or an empty manual destination. Verify invalid data is not sent and the editor remains open on close with a clear error.
- Open equipment details, edit the note, and verify it autosaves without a separate Save action.
- Open an existing project and change its name, description, assignee, participants, Task Manager visibility, and linked Locations.
- Verify valid project changes autosave, closing flushes pending changes, and invalid project data is not persisted.
- Observe the global synchronization control in the header during Warehouse and project edits. Verify it shows synchronization, success, and error states consistently.
- In the second authorized session, verify the equipment or project update appears after the scoped realtime event without a manual page reload.
- Create a new equipment item and a new project. Verify creation still requires the explicit Add/Create action and does not create incomplete records automatically.

### Expected result
Existing Warehouse and project records persist valid changes automatically, pending changes flush safely before close, invalid data remains local with a visible error, related query data refreshes, the header reflects synchronization state, and other authorized sessions receive realtime refreshes. New records are created only after explicit confirmation.

### Execution result
To be filled

## UAT-010 — Verify Dashboard Widget Resize, Reset, and New Operational Widgets

- **Scenario ID:** UAT-010
- **Title:** Verify widget resizing via handles, reset options, and new Sprint 5 operational widgets
- **Status:** Passed
- **Related feature:** Dashboard

### Objective

Verify that managers can resize widgets directly using corner handles, reset layout positions/sizes, and view the new operational widgets (active projects, equipment for tasks, upcoming returns, unassigned tasks, team workload, location updates).

### Preconditions
- The user is logged in as a Manager.
- The Dashboard is populated with multiple widgets, including the new Sprint 5 widgets.
- Some widgets are hidden via the visibility controls.
- The user has different saved layouts in two company workspaces.

### Test steps

1. Open the Dashboard. Locate a supported widget and verify it has a clear corner resize handle that does not block drag, links, or controls.
2. Drag the resize handle horizontally and vertically. Verify the widget resizes within documented min/max bounds and snaps to the Dashboard grid, reflowing neighbors without overlap.
3. Verify the fixed `S/M/L/XL` selector is removed from the primary workflow.
4. Open the reset control menu. Select `Reset positions` and confirm. Verify widgets return to default order/placement while retaining their current sizes.
5. Select `Reset positions and sizes` and confirm. Verify widgets return to default order AND default dimensions.
6. Verify both reset actions preserved which widgets were visible and hidden before the reset.
7. Verify the reset asks for confirmation and successfully recovers a malformed saved layout.
8. Reload the page. Verify all layout dimensions and placement persist without interrupting widget data refresh.
9. Switch to the second company and reload the Dashboard. Verify its scoped layout is applied on the first render, without briefly showing the first company's layout.
10. Observe the new widgets.
11. For each new widget, verify it has loading, empty, error, and refresh states without resizing surrounding layout unexpectedly.
12. Verify each new widget respects company isolation and existing module permissions.
13. Verify item counts are capped with a clear route to the complete source list.
14. On a mobile viewport, verify the Dashboard remains usable and does not require precise corner dragging where too narrow; verify an accessible fallback is available.

### Expected result

Resize handles work and snap to grid; S/M/L/XL selector is removed. Reset options restore positions/sizes correctly while preserving visibility selections; confirmations prevent accidents. All new Sprint 5 widgets load data correctly, show proper states, link to source lists, respect permissions, and support hide/show/move/resize/persistence. The Dashboard layout persists after reload, loads from the active user/workspace scope on the first render, and mobile fallback functions without breaking.

### Execution result

All test steps were executed successfully. The customer verified the functionality in the Sprint 5 follow-up build and confirmed the behavior meets expectations without any issues.

## UAT-011 — Verify Equipment Categories, Storage Locations, Kit Expansion, and Physical/Work Context

- **Scenario ID:** UAT-011
- **Title:** Verify equipment taxonomy maintenance, storage location hierarchy, kit component expansion, and destination/work-context assignment
- **Status:** Passed
- **Related feature:** Warehouse

### Objective

Verify that warehouse managers can maintain equipment categories/subcategories and storage locations, expand kits to inspect components, and assign physical destinations and work context to equipment without altering availability state.

### Preconditions

- The user is logged in as a Warehouse Manager.
- A Production Worker user is available for permission testing.
- Multiple equipment items, kits, categories, and storage locations exist.

### Test steps

- Open Warehouse Settings. Navigate to Categories. Create a new category with subcategories. Rename, reorder, and archive/restore a category. Verify archived values remain on existing records but are excluded from new selections by default.
- Navigate to Storage Locations (separate section). Create a hierarchical location (e.g., Room A > Rack 3 > Shelf 2). Archive a location with equipment linked to it; verify confirmation is required and historical value remains visible.
- Open a kit card. Click to expand/collapse its complete component list without leaving the page. Verify each component displays name, inventory ID, availability, operability, ownership/location, and relevant warnings.
- Select a component from the expanded list. Verify it opens the equipment details without losing kit navigation context. From the equipment details, verify it links back to the parent kit.
- Verify composition updates immediately after adding/removing a component or changing its status. Verify broken/on-repair/checked-out/overdue components are visually distinguishable inside the kit.
- For a large kit, verify the list is searchable or progressively disclosed rather than expanding indefinitely.
- Open an equipment edit or return form. Select a structured Warehouse storage location. Verify archived storage locations are excluded from new selections while the historical value remains visible on an existing record.
- Open an equipment checkout or work-context form. Select an active production Location OR enter a manual physical destination. Verify the two destination choices are mutually exclusive and archived production Locations cannot be selected for a new destination.
- Optionally select a company project and one or more Kanban V2 cards as work context. Verify the card selector filters by the selected project, and selecting a card derives its project (conflicting selection shows feedback).
- Verify automatic request/checkout links and manual contextual links are stored distinctly (e.g., labeled differently).
- Verify that adding, editing, or removing physical/work context does NOT issue, return, reserve, repair, or change availability/operability state.
- Verify broken/on-repair equipment cannot be newly issued via this workflow, but historical context remains visible.
- Log in as a standard Production Worker. Verify they can view the context but cannot modify protected taxonomy or storage locations unless permissions explicitly allow.

### Expected result

Category and storage-location hierarchies are maintainable with archive/restore, preserving historical data. Kits expand fully with component details and navigation to parent/child. Physical and work context (destination, project, Kanban cards) can be assigned separately from inventory state changes. Links are distinct, filters work by project, and state-changing actions (checkout/return) remain separate. Permissions are enforced, and mobile/desktop layouts are usable.

### Execution result

All test steps were executed successfully. The customer verified the functionality in the Sprint 5 follow-up build and confirmed the behavior meets expectations without any issues.

## UAT-012 — Verify Production Location Editing, Bidirectional Links, and Threaded Discussions

- **Scenario ID:** UAT-012
- **Title:** Verify production location metadata editing, bidirectional linking with cards/projects, and threaded topic discussions with photos
- **Status:** Passed
- **Related feature:** Locations

### Objective

Verify that managers can edit and archive production locations, link them bidirectionally to Kanban V2 cards and projects, and maintain threaded issue discussions with photos at the location level.

### Preconditions

- The user is logged in as a Production Manager.
- A Kanban V2 card and a Project exist.
- Another user (Production Worker) is available for collaboration or one user can log in as both roles.

### Test steps

- Open a Production Location details. Edit its name, type, address, operational status, and maintained notes. Verify who last updated it and when.
- Archive the location while it has active cards or unresolved discussions. Verify a confirmation dialog summarizes those active links before allowing archiving.
- Restore the location from the archive filter. Verify it reappears in normal selections while historical links remain intact on existing cards/projects.
- Open a Kanban V2 card. Select multiple company locations for it. Remove one. Save. Navigate to the Location details view and verify the card appears in its linked list.
- Open a Project. Select multiple locations (either directly or via aggregation from its board cards). Verify the Location details view lists both the project and its linked cards.
- Navigate from the card directly to the location, and from the location back to the card/project, without losing context.
- At the Location page, create a topic (type `issue`) with title, description, severity, and optional links to a Kanban V2 card/project.
- Create a second topic (type `note`). Verify they are visually distinct and filterable by active/resolved/archived.
- Add replies inside the `issue` topic. Verify each reply shows author and timestamp, and photos/files can be attached using existing upload safeguards.
- Mark the issue topic as resolved, then reopen it. Verify it transitions correctly and remains in history.
- Verify general maintained location notes remain separate from the discussion/thread history.
- On the linked Kanban V2 card/project, verify a compact topic/issue summary appears and navigates back to the location topic.
- As the Manager, refresh the Dashboard location widget and verify it updates when topics are created, replied to, resolved, or archived (real-time/WebSocket with refetch fallback).

### Expected result

Location metadata edits persist with auditing. Archiving warns about active links, preserves history, and is reversible. Bidirectional linking works seamlessly between locations, Kanban V2 cards, and projects, with clear navigation. Topic discussions support notes/issues with severity, threaded replies, photo attachments, and resolved/archived states. Topic summaries appear on linked work items, and the Dashboard widget reflects changes in real time.

### Execution result

All test steps were executed successfully. The customer verified the functionality in the Sprint 5 follow-up build and confirmed the behavior meets expectations without any issues.

## UAT-013 — Verify Free Horizontal Scrolling in Calendar Timeline Views

- **Scenario ID:** UAT-013
- **Title:** Verify free horizontal scrolling and day-boundary snapping in Day, 3 Days, and Week Calendar views
- **Status:** Passed
- **Related feature:** Calendar

### Objective

Verify that users can freely scroll horizontally across adjacent dates in Day, 3 Days, and Week timeline views, with smooth snapping to full day boundaries, while existing navigation and drag/drop remain stable.

### Preconditions

- The user is logged in.
- The Calendar contains events and Kanban V2 cards across multiple adjacent dates.
- Weekends are enabled in Calendar settings for the seven-day Week-view assertion.

### Test steps

- Open the Calendar in Day view. Using a horizontal trackpad gesture, a horizontal mouse wheel, `Shift` + mouse wheel, or touch, scroll horizontally to the right. Verify adjacent dates load without a full page reload.
- Stop scrolling. Verify the viewport aligns to the start of one complete day, with no partial leading day at the left edge.
- Switch to 3 Days view. Scroll horizontally and verify the viewport aligns to a day boundary while displaying three complete days.
- Switch to Week view with weekends enabled. Scroll horizontally and verify the viewport aligns to a day boundary while displaying seven complete days at supported desktop widths.
- Verify scrolling can advance by one day at a time—it is not limited to whole-view page jumps.
- Use the existing previous/next navigation arrows and the Today button. Verify they synchronize the same visible date range as the scrolled position.
- Load the Calendar directly while data is still loading, then wait for the timeline. Verify the selected period is aligned as soon as it appears and the toolbar label updates without a visible delay.
- Verify the header, all-day area, and timeline columns remain aligned during and after scrolling.
- Drag a Kanban V2 card to a different day/time slot. Verify drag/drop remains stable while horizontal scrolling is available.
- Resize an existing event by dragging its bottom edge. Verify resize behavior remains stable during the scroll.
- Using keyboard navigation (e.g., arrow keys) and reduced-motion preferences, verify usable fallbacks exist.
- On a mobile viewport, scroll horizontally and verify the gesture does not accidentally trigger page-level horizontal overflow outside the Calendar container.
- Confirm Month view is explicitly excluded from this timeline-scrolling scope (it does not have free horizontal scroll behavior).

### Expected result

Day, 3 Days, and Week views support free horizontal navigation through horizontal input, `Shift` + wheel, or touch. Adjacent data loads dynamically. The viewport aligns its leading edge to a day boundary and shows one, three, or seven complete days respectively; Week shows seven days only when weekends are enabled (otherwise five). Navigation arrows/Today sync with the scrolled range. Header/columns stay aligned. Drag/drop and resize operations remain fully functional. Keyboard and accessibility fallbacks work. Mobile scrolling stays contained without page overflow.

### Execution result

All test steps were executed successfully. The customer verified the functionality in the Sprint 5 follow-up build and confirmed the behavior meets expectations without any issues.

## UAT-014 — Verify Project Statistics, Autosave for Projects/Equipment, and Active Workspace Switching

- **Scenario ID:** UAT-014
- **Title:** Verify detailed project statistics, autosave behavior on edits, and active company/personal workspace switching
- **Status:** Passed
- **Related feature:** Projects, Global Workspace

### Objective

Verify that project statistics display comprehensive operational metrics, that editing projects and equipment saves automatically after debounce, and that switching between company workspaces and personal workspace properly isolates data.

### Preconditions

- The user has membership in at least two companies.
- A project with a dedicated Kanban V2 board exists, containing cards with assignments, deadlines, locations, and equipment links.
- A second authorized browser session is available for realtime verification; an existing account without a completed onboarding flag is available for the onboarding recovery check.

### Test steps

- Open a Project. Navigate to its Statistics section. Verify it displays: total/active/in-progress/completed/overdue/unassigned Kanban V2 cards.
- Verify deadline statistics distinguish overdue, due soon, future, and no-deadline cards.
- Verify assignee statistics show card distribution/workload based on current project members.
- Verify location statistics show linked active/archived locations and unresolved issues by severity.
- Verify equipment statistics show linked/requested/approved/issued/returned/overdue/broken-or-repair counts without double counting.
- Click on a metric (e.g., "overdue cards"). Verify task metrics open the project Kanban board, while Location and equipment metrics open their respective source modules. Do not expect a pre-applied metric filter.
- Update a card status, deadline, assignment, or equipment link. Verify statistics update without a page reload.
- Open the Edit Project form. Change its name, description, or assignees. Wait for the autosave debounce. Verify the form shows idle → dirty → saving → saved states, without a Save button.
- Leave a required field empty. Verify the form remains dirty and does not send an invalid request, then auto-saves after correction.
- Temporarily simulate a failed project save (for example, disconnect the network), then restore it. Verify the form shows an error without losing valid local values and saves the latest valid state after a retry.
- Open an existing Equipment record. Edit its physical destination and work context. Verify the same autosave states appear and changes reflect globally.
- Observe the global header synchronization indicator—verify it reflects autosave progress, success, or error.
- Switch the active workspace from Company A to Company B using the workspace switcher. Verify pending autosaves complete safely before switching.
- After switching, verify query caches, Dashboard data, notifications, and realtime subscriptions are cleared/refreshed for the new company.
- Switch to Personal Workspace. Verify it exposes only personal Kanban V2 boards, Calendar events, and projects—company-only modules/actions are hidden or show a clear empty state.
- Verify the user remains in the same module if it exists in the target workspace; otherwise, they land on the target Dashboard.
- Create a third company through the workspace switcher. Verify pending autosaves are flushed and the new company becomes active immediately.
- Log in with the separate existing account whose completion flag is missing or false. Verify it is sent to onboarding rather than an unusable Dashboard, then complete onboarding and choose a workspace.
- Log out and back in. Verify the last still-authorized workspace is restored automatically.

### Expected result

Project statistics show accurate linked metrics across tasks, people, locations, and equipment, updating in real time. Task metrics navigate to the project board, while Location and equipment metrics navigate to their source modules. Autosave works via debounce with clear UI states, handles invalid fields gracefully, preserves valid local values after a failed save, and integrates with the global sync indicator. Workspace switching or company creation safely completes autosaves, clears caches, isolates company/personal data, and remembers the last valid choice. An existing user with incomplete onboarding is redirected to onboarding and can reach a valid workspace after completing it. Personal workspace shows only personal boards/events/projects without leaking company data.

### Execution result

All test steps were executed successfully. The customer verified the functionality in the Sprint 5 follow-up build and confirmed the behavior meets expectations without any issues.

## UAT-015 — Verify Kanban V2 Workflow, Collaboration, and Equipment Links

- **Scenario ID:** UAT-015
- **Title:** Verify board persistence, card workflow, collaboration, and synchronized equipment links
- **Status:** Passed
- **Related feature:** Kanban V2, Warehouse, Projects

### Objective

Verify that Kanban V2 preserves the active board, supports efficient card updates and collaboration, and keeps card equipment links synchronized with the Warehouse module.

### Preconditions

- A company workspace contains at least two Kanban V2 boards, cards with different deadline states, and project members.
- At least one equipment item can be linked to a card and is visible to the current user.
- Two authorized browser sessions are available for realtime checks.

### Test steps

- Select a non-default board, reload the application, and verify the same board remains active in the same workspace. Switch to another workspace and verify no board from the first workspace is exposed.
- Use quick edit and the card action menu to change a card title, assignee, status, and deadline. Reload and verify the updates persist.
- Create an overdue card and a completed card with an earlier deadline. Verify overdue state and deadline labels are consistent in the board, card details, and related task views; a completed card is not shown as overdue.
- Link equipment to a card. Verify the card displays the current linked equipment information and navigation to its equipment record.
- In the Warehouse module, return, remove, or otherwise change the linked equipment. Verify the card reflects the valid current state without a stale link after refresh or realtime update.
- Add a discussion comment, a reply, and a permitted file attachment to a card. Verify author, timestamp, reply relationship, and attachment visibility in the second browser session.
- Use filters for assignees, dates/deadlines, and custom fields. Select multiple visible cards and verify bulk-selection actions affect only the selected, authorized cards.

### Expected result

The active board is preserved only within the authorized workspace. Card edits persist and deadline status is consistent. Equipment links are visible on cards and remain synchronized with Warehouse changes. Comments, replies, files, filters, custom fields, and multiple selection work without leaking data across users or workspaces.

### Execution result

All test steps were executed successfully. The customer verified the functionality in the Sprint 5 follow-up build and confirmed the behavior meets expectations without any issues.

## UAT-016 — Verify Safe Warehouse Kit Lifecycle and Equipment History

- **Scenario ID:** UAT-016
- **Title:** Verify nested kits, safe component operations, storage locations, and equipment activity history
- **Status:** Passed
- **Related feature:** Warehouse, Equipment, Projects

### Objective

Verify that nested equipment kits can be managed safely, destructive operations preserve components and history, and return destinations use the correct Warehouse storage model.

### Preconditions

- The company has a Manager and a Worker user.
- At least two equipment items, a parent kit, and a nested kit are available; one structured Warehouse storage location and one production Location exist.
- One equipment item has activity history with a comment or attachment available for verification.

### Test steps

- Create or edit a parent kit and add a nested kit and equipment components. Verify the hierarchy is visible from both parent and nested-kit cards.
- Attempt to place a kit inside itself or create a circular nesting relationship. Verify the operation is rejected and the existing kit composition remains unchanged.
- Attempt a component-affecting operation, such as checkout, return, transfer, or removal, on equipment contained in a kit. Verify the application requires the safe extraction/confirmation flow and does not silently corrupt the parent kit composition.
- Delete or disband a kit through the explicit confirmation flow. Verify its components remain as recoverable equipment records with their history; they are not silently deleted with the kit.
- In an equipment edit or return flow, select a structured Warehouse storage location. Verify archived storage locations are unavailable for a new selection while historical values remain visible on existing records.
- In a checkout or work-context flow, select an active production Location or enter a manual physical destination. Verify these destination choices are mutually exclusive and are not confused with Warehouse storage locations.
- Add a comment and a permitted attachment to equipment, then review the activity history in the second browser session. Verify author, timestamp, attachment, and the completed kit action are recorded and become visible without a manual page rebuild.
- As the Worker, attempt an action restricted to Managers. Verify the action is denied or routed through the intended request/approval path without changing equipment state.

### Expected result

Nested kits preserve a valid acyclic hierarchy. Component actions and kit deletion/disbanding are explicit and safe, with components and history retained. Warehouse storage locations remain distinct from production Locations and manual destinations. Equipment history, comments, files, and permissions remain accurate for all authorized users.

### Execution result

All test steps were executed successfully. The customer verified the functionality in the Sprint 5 follow-up build and confirmed the behavior meets expectations without any issues.
