*This file contains the Customer Sprint Review transcript, the User Acceptance Testing (UAT) transcript, and the Transition Readiness transcript.*

# StreamDesk Customer Meeting Transcript, Week 6

## Meeting Details

- **Participants:** Team Member, Customer
- **Meeting scope:** Sprint 4 review, user acceptance testing (UAT), documentation review, and transition-readiness discussion.
- **Audio duration:** 01:02:25
- **Note:** Utterances are grouped into conversational turns and labeled with two roles based on dialogue context. This is an English translation of the Russian transcript. Obvious recognition errors in product names and terms were normalized; repetitions, informal language, and unfinished phrases are retained where they affect meaning.

# Customer Sprint Review Transcript

## Section Timecode

- **Starts at:** 00:00:00

## Transcript

- [00:00:00 - 00:00:10] **Team Member:** So, hello. The standard question: do you allow the recording and transcription of this meeting for further use?
- [00:00:10 - 00:00:14] **Customer:** Yes, hello. Yes, I allow it.
- [00:00:14 - 00:00:21] **Team Member:** Great. Then we will do the review now. Can you see it?
- [00:00:21 - 00:00:23] **Customer:** Yes.
- [00:00:23 - 00:01:07] **Team Member:** So, this week we worked on the Dashboard. We fixed a couple of bugs in the Calendar and Warehouse tasks, integrated all of that, also touched Projects because they are used in the Warehouse, and added a Locations menu. We will go through all the changes from top to bottom. On the Dashboard, widgets can now be moved; they swap places. They can be resized, hidden, expanded to full screen, and so on. Everything is saved locally for each user. On a phone they simply appear from top to bottom. With this button, you can choose which widgets you need and which you do not.
- [00:01:07 - 00:01:49] **Team Member:** There is also general synchronization: a change in any part is synchronized everywhere. Next, we fixed a Calendar bug where, at a small size, it was impossible to see the item. Now only the title remains, and it can be dragged normally. Previously, at a small size it could only be stretched, not dragged. We also added the Locations section.
- [00:01:49 - 00:02:33] **Team Member:** You can now add a location and report an issue. The location will then be loaded into the task. There is search, status such as occupied or free, and sorting. In Projects there was an issue with integration with the new Task Manager. I will fix it and show it now.
- [00:02:33 - 00:03:16] **Team Member:** You can now create a project and assign a participant. There are statistics, and they update too. Every project now creates its own board. You can create a task and attach locations to it. If a location has an issue, it will be displayed in the task connected to that issue.
- [00:03:16 - 00:03:26] **Team Member:** Here are the statistics and settings. We moved and changed them a little.
- [00:03:28 - 00:04:11] **Team Member:** The filters are still the same, and we also added filtering. There is board order, which we set ourselves. Elements can be arranged as we want. They can be sorted, for example, by priority. If we change a task to urgent, it moves up. That was not available before.
- [00:04:11 - 00:04:54] **Team Member:** A task can be completed and everything updates, including in Projects. In the Warehouse, for example, I can take equipment because I am currently acting as a manager and can choose a location. I noticed that the new Locations are not connected to the Warehouse yet. We did not implement that; we will connect them next week.
- [00:04:54 - 00:05:31] **Team Member:** I can take equipment without a request, but normally an employee creates a request for equipment and it must be approved by a manager. In the cart, we fixed the stretched button and a small visual bug. That is probably the main work for the week, plus a few smaller fixes and visual adjustments. Do you have any feedback, or is there anything else to add?
- [00:05:31 - 00:05:53] **Customer:** So far, no, everything is fine. You said that I could click around myself now. Let me do that and you can comment as we go. Let us open Team34.

---

# User Acceptance Testing (UAT) Transcript

## Section Timecode

- **Starts at:** 00:05:38

## Transcript

- [00:05:53 - 00:05:55] **Team Member:** Okay, where should we go?
- [00:05:55 - 00:06:05] **Customer:** I will send it now. Yes, a link would be better.
- [00:06:05 - 00:06:25] **Team Member:** There is a standard registration flow there.
- [00:06:25 - 00:06:50] **Customer:** Okay, I have registered.
- [00:06:50 - 00:07:05] **Team Member:** Great. Can you turn on screen sharing? You need to turn off the current sharing first.
- [00:07:05 - 00:08:09] **Customer:** Can you see it? Good. I am creating the company now. The generated link is for sharing. Everything is fine; let us work with the Dashboard.
- [00:08:09 - 00:08:49] **Team Member:** Here is the scenario: imagine that you are a manager. You need to move the task-related widgets up and hide technical widgets, equipment, current activity, system information, and other things that do not require your attention.
- [00:08:49 - 00:10:32] **Customer:** Is there a reset button, something that resets the whole layout? I mean a separate button that restores the default positions. When I customize a dashboard, something can break or I may simply dislike the result. I want to press one button and return to the default layout instead of moving everything back by hand. If such a button exists, that would be great.
- [00:10:32 - 00:11:23] **Customer:** These are the same services that are available elsewhere, right? It is good that everything is on one page. There are light and dark themes. In settings I can change my name, email, phone number, notifications, security, password, and language from Russian to English.
- [00:11:23 - 00:11:38] **Customer:** Are integrations something like uChild? Did you not work on that?
- [00:11:36 - 00:11:38] **Team Member:** Another team is responsible for that.
- [00:11:38 - 00:11:56] **Customer:** Okay, fine. The control panel is clear. Let us move on.
- [00:11:56 - 00:12:12] **Customer:** I need to go to Task Manager and create two tasks, one with an overdue deadline and one ordinary task. Do I need to create a project first?
- [00:12:10 - 00:12:16] **Team Member:** You can create it through a project, or create a separate board directly in Task Manager.
- [00:12:16 - 00:13:10] **Customer:** I create a project and see its statistics and progress. If a task is completed, does the project receive that status from the board?
- [00:13:02 - 00:13:10] **Team Member:** Columns have different types. An ordinary column contains active tasks; if a task is placed in a green closed column, it counts as completed.
- [00:13:10 - 00:14:32] **Customer:** If I remove the default columns, I can create my own, for example: Waiting for Editing, Editing, Revisions, and Completed. I created a task and can edit its priority, assignee, dates, and labels.
- [00:14:32 - 00:15:12] **Customer:** I want to create a label such as a course or analysis. Where do I do that?
- [00:15:10 - 00:15:16] **Team Member:** In the board settings you can create a label group.
- [00:15:12 - 00:16:39] **Customer:** I see. These are custom fields rather than a label group. I can add a number field, for example, and a filming date. I can choose a date. Can I add fields inside the task card?
- [00:16:39 - 00:17:20] **Customer:** That is fine, I will use it. As for labels: there are ordinary tags, and in board settings you can create a group of tags, for example, a first semester group containing all first-semester courses. Then the filters can select the group rather than individual courses.
- [00:17:22 - 00:19:52] **Customer:** So I can combine tags into one group and filter by that group. I cannot assign a group itself to a task; I assign the tags inside it. For example, I add the names of courses to the First Semester group and then filter tasks by that group. I understand now; that is an interesting feature.
- [00:19:52 - 00:21:28] **Customer:** The task has positions, lists, start date, deadline, and equipment requests. I can add a subtask, such as cutting the first ten minutes. I can also attach a file or photo. Dragging is not available, but that is not critical. I can view the log and comments.
- [00:21:28 - 00:22:22] **Customer:** I can download and upload attachments. Can I reply to a comment? It looks like comments are flat only. In general, this part is fine. I can move a task smoothly, without anything jumping.
- [00:22:22 - 00:23:15] **Customer:** How do I complete the task?
- [00:22:26 - 00:23:10] **Team Member:** You need to change the column type to Closed and move the task there. The board statistics will update.
- [00:23:15 - 00:24:22] **Customer:** I see board statistics: completed and in progress. I would also like the system to show how many tasks were completed by me. It would be useful to add a responsible person and an initiator, in addition to the assignee. One task may have one or several executors.
- [00:24:20 - 00:24:22] **Team Member:** Multiple assignees are supported.
- [00:24:22 - 00:25:27] **Customer:** Good. Still, a responsible person should supervise execution, and an initiator should be the person who assigned the task. Assignees can remain the same while responsible people change. The board itself moves well. This element looks small only because of my large monitor; it is a minor visual issue.
- [00:25:25 - 00:25:27] **Team Member:** We will fix that.
- [00:25:27 - 00:26:27] **Customer:** I create a task with a deadline before today. It is shown as overdue, which is great. In the Calendar it is red, so overdue status is displayed correctly. Will it also be shown as overdue here?
- [00:26:05 - 00:26:07] **Team Member:** There is no such parameter here yet.
- [00:26:07 - 00:28:29] **Customer:** Fine. The board has Active, Archive, and Trash, plus colors, search, card filtering, and sorting. When board order is selected, I can move cards manually; when a parameter is selected, cards are sorted by that parameter. Custom fields are shared across all cards. I can create them in board settings or inside a task.
- [00:28:29 - 00:32:26] **Customer:** I would like a reusable Location field: we work at several locations regularly, so I should be able to pick one instead of typing it every time. I see that the Locations parameter exists. A multi-select custom field can also be created. When a new field is added, it appears on existing cards too, which is ideal. I can choose whether a custom field is shown on a card or in the list, and hide it where it is not needed.
- [00:32:26 - 00:33:04] **Customer:** A tooltip in the custom-field filter would be useful so that it is clear what is available there. Otherwise, this section is fine. Let us go to Locations and try creating an issue.
- [00:33:04 - 00:41:45] **Customer:** Locations are useful. I can create a new location and add its name, address, description, contacts, capacity, technical information, photos, and an issue. It would be good to treat a location as an archive of knowledge about a venue: notes, files, dates, comments, issue history, and a way to resolve or archive issues. It is similar to a project but for a venue. There should be a long-term record of what happened at the location.
- [00:41:45 - 00:42:24] **Team Member:** Let us move to the Warehouse.
- [00:42:24 - 00:44:37] **Customer:** I can create equipment, select its type and status, set a location, add characteristics, and use filters. It would be useful for users to manage equipment categories and subcategories themselves, rather than requiring a developer to change them. For example, there should be categories such as computers and components, with flexible subcategories.
- [00:44:37 - 00:46:20] **Customer:** I can create a kit from separate equipment items, for example, a computer from a motherboard and a graphics card. This is useful because the kit remains a computer while its components are still visible as parts of the kit.
- [00:46:20 - 00:48:17] **Customer:** In a computer card, it would be convenient to open a component directly. For example, if a USB port burned out on a motherboard, I should open the computer, then the motherboard, and leave a comment. Comments with a photo attached to a specific equipment item would be ideal.
- [00:48:17 - 00:49:40] **Customer:** Equipment cards and task-editing screens contain a lot of information. It could be more convenient to show only the basic parameters first and hide advanced settings behind an additional action. The current Warehouse card is generally fine.
- [00:49:40 - 00:50:36] **Customer:** For a kit, it would be convenient to expand it and see all contained items without opening each one separately. The QR code works; I can download it as a PNG.
- [00:50:36 - 00:51:13] **Customer:** I can print it and add equipment to the cart. It would be better to link a Warehouse request not only to a project but also to a specific task.
- [00:51:13 - 00:52:39] **Customer:** A project can have its own board, but operational work may be on a separate board and not tied to a project. In that case, the cart should allow me to select both the project or operational area and the task. More configuration here would be useful.
- [00:52:41 - 00:55:46] **Customer:** I can take equipment for myself, return it, or assign it to a project. I noticed an important case: if I try to take one component from a kit, for example a motherboard, there should be a warning that it belongs to a kit. I should not be able to take it separately while the kit is in use. I should first explicitly remove it from the kit, with confirmation and logging.
- [00:55:46 - 00:56:19] **Customer:** The log should show that someone removed the motherboard from the kit and when they did it. In general, the things we discussed should be refined; otherwise, everything is good.

---

# Transition Readiness Transcript

## Section Timecode

- **Starts at:** 00:56:21

## Transcript

- [00:56:21 - 00:56:51] **Team Member:** We prepared the Customer Handover and README with the project description.
- [00:56:21 - 00:56:51] **Customer:** I did not look at them after the meeting. Are they in the repository? Where do I look?
- [00:56:51 - 00:57:07] **Team Member:** They are in our GitHub repository. I have sent you the link.
- [00:57:07 - 00:57:18] **Customer:** Yes, I see it now. Everything is fine; I have familiarized myself with it.
- [00:57:24 - 00:57:40] **Team Member:** Let us move to the final Transition Readiness interview. Is StreamDesk currently used anywhere beyond the demonstrations?
- [00:57:26 - 00:57:40] **Customer:** No, for now we are only using it in a demonstration format.
- [00:57:40 - 00:58:09] **Team Member:** What prevents you from using it now?
- [00:57:44 - 00:58:09] **Customer:** If we deploy what is there now, we can already start using it. The only thing that prevented it was that the Warehouse was unfinished. Now we can take it into work.
- [00:58:09 - 00:58:50] **Customer:** From the parts we needed, everything is basically ready. I like that tasks can be created, moved, and managed. The Warehouse exists and is understandable. Locations and alerts need further work, but what exists now can already be used and refined through bug reports.
- [00:58:50 - 00:59:23] **Team Member:** After we fix the agreed items next week, hand everything over, and deploy it, will you be able to use it in real work?
- [00:59:08 - 00:59:23] **Customer:** Yes. We will definitely take it into work and use it.
- [00:59:23 - 00:59:56] **Team Member:** Who will be the product owner after handover? Will you need our support with GitHub issue tracking, configuration, backups, and updates?
- [00:59:25 - 00:59:56] **Customer:** Put me down as the product owner. I think such help will be needed; if you have the possibility, it would be great.
- [00:59:56 - 01:01:40] **Team Member:** Let us classify what is essential to fix next week and what can remain as a known limitation.
- [01:00:17 - 01:01:40] **Customer:** The Dashboard reset button is more of a nice-to-have, so you do not need to spend time on it now. For Locations, it would be good to add the project-like capabilities we discussed. Task Manager is generally fine apart from small fixes. For the Warehouse, make categories and subcategories and add the safeguard so that an item cannot be taken from a kit without first removing it from the kit. The rest is mostly cosmetic work.
- [01:01:40 - 01:02:14] **Team Member:** To summarize: today we completed the UAT, reviewed Sprint 4, and decided what to do next week. We will fix the agreed items, provide deployment documents, and work on deployment and handover. There were backend changes, and we will provide documentation so that the other Go team can add the required endpoints.
- [01:02:14 - 01:02:25] **Customer:** Thank you. Everything is great. Bye.
