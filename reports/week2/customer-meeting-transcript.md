# Customer Meeting Transcript

## Publication Status

The customer explicitly permitted publication of this sanitized transcript in the repository during the meeting.

> PII removed: real names replaced with role identifiers. No timestamps were present in the original recording; section headings reflect natural topic breaks.

## Sanitized Transcript

---

**[Recording and publication permissions]**

**Facilitator:** We just need this to be in the transcription. Do you give permission to record? Our meeting will be recorded.

**Customer:** Yes, yes, I fully permit it.

**Facilitator:** All good. I also need to ask about the transcription itself: we are going to transcribe this meeting, can we include it in the report?

**Customer:** Yes, of course.

**Facilitator:** And @customer also confirmed regarding the MIT license — we will use it in our repository. There are no objections to this.

**Customer:** Okay, could you just explain what this MIT license is?

**Facilitator:** It's about public use. That is, the product is currently public, and we don't hold the rights to it.

**Customer:** And who does? The university?

**Facilitator:** Who holds the rights? Let's see... Well, it's open-source software. At this point, it will be open for transfer to you.

**Customer:** Uh-huh, okay, I get it. And the university?

**Facilitator:** Actually, the university too. Meaning, any user has the rights.

**Customer:** Ah, all good. No, I was just wondering if you transfer these rights to the university or not after finishing the work. That's what I was interested in.

**Facilitator:** It's an Open Source license.

**Customer:** Got it, okay. No problem.

---

**[Meeting agenda and user roles]**

**Facilitator:** Alright, look, let's quickly go over the meeting agenda, hopefully we'll finish soon:

- Show User Stories — what our user journeys are.
- Use the MoSCoW methodology to determine what should be included in MVP version 1.
- Show our prototypes in Figma that we've sketched out.

That's basically the essence of the meeting.

**Customer:** Yes, okay, let's do it.

**Facilitator:** Great. Let me just open... We've defined the roles. We currently have five functional roles:

- **Production Worker** — an average specialist handling cameras (camera operators are included here). They want to take equipment from the warehouse and assign it to themselves, so everyone can see they have it.

- **Video Editor.**

- **Streamer.**

- **Stream Administrator** — monitors all parameters, launches, and connects everything.

- **Manager** — assigns tasks to everyone and oversees the process. They can see tasks in a calendar format to visually track deadlines. The manager can also use the dashboard to see the current completion status of all tasks: in the calendar, as a list, on a Gantt chart, and so on.

Real-time updates are implemented for the manager — all movements within the task manager and dashboard. And, of course, convenient sorting on the dashboard.

Next are non-functional requirements: response time, etc. For the Production Worker, it should just update in real-time regarding who took what. When they mark a task as completed, it gets tagged, displayed everywhere, and an internal notification is sent. The manager, again, sees this in real-time.

Additionally, the Production Worker has the ability to report an on-site issue. If a problem arises within a task, a notification goes to the manager, and they see it all. Tasks have their own parameters that update in real-time: where the site is located, what stage everything is at (displayed using boards). Upcoming tasks with an urgent deadline are marked separately and pushed to the top so they are easiest to spot.

---

**[MoSCoW prioritization]**

**Facilitator:** Now regarding MoSCoW — what we want to implement first.

Must Have (mandatory for MVP v1):

- Task dashboard (specifically for the manager).
- Task calendar.
- Task manager showing the completion level of work with progress, boards, and possibly a Gantt chart.
- Real-time status updates for all users.
- Status boards (for example, if a task is related to a site, you can see the current status of the site itself).

Should / Could Have (additional functionality):

- Sorting by deadlines.
- A more functional calendar.
- Notifications about on-site issues within tasks.
- Equipment reservation and attaching equipment directly to the task card.

---

**[Figma prototype walkthrough]**

Screen sharing in progress.

**Facilitator:** So, here is the task manager. Here are the tasks, who is responsible for them, and the board is set up. Next, we have the calendar — different views. Here's a week, here's a day, here's 3 days.

**Customer:** Yes.

**Facilitator:** And the monthly view. We'll also add a Gantt chart here. Also, there's a list view of the tasks in the calendar.

**Customer:** Good. Super.

**Facilitator:** And the warehouse. Everything is basically fine with the warehouse: there is sorting and icons for various actions (delete, edit, etc.). It displays the equipment model, the location where it's available, and who it belongs to. These are the prototypes for those User Stories that fall under the Must Have category.

**Customer:** Okay, okay. Overall, you used this StreamDesk that already exists as a basis, right?

**Facilitator:** Yes, we are taking it and modernizing it. @customer also asked to change the design, but that's a secondary task.

**Customer:** Regarding the design — yes, that's more secondary. The main point here is purely the task manager, to get it working.

**Facilitator:** Yes.
