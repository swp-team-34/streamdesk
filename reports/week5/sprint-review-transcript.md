*Customer Sprint Review Transcript and Customer UAT Review Transcript are collected in this file*

# Customer Sprint Review Transcript

## Meeting Details

- **Participants:** Team member (Developer / Scrum Master), Customer (Client / Tester)
- **Sprint Goal Reviewed:** Sprint 3 — Fix bugs in the Calendar and Task Manager, update the Dashboard, and implement Warehouse features.

## Transcript

- [00:00:00] **Team member:** Here, well as, as always, hello again. So... permission to record this interview and to place its transcript in our GitHub...
- [00:00:08] **Customer:** I forbid it.
- [00:00:10] **Team member:** Well, okay then.
- [00:00:11] **Customer:** Come on, I allow it.
- [00:00:13] **Team member:** Well, we won't cut it.
- [00:00:15] **Customer:** Yeah, yeah, leave it like that.
- [00:00:17] **Team member:** So, excellent. Look, in general, the goal of the sprint was to fix all bugs in the calendar and task manager. And implement there, finish all the warehouse functions. So, this is our third sprint. What was fixed: in the task manager there were bugs with columns, meaning they were jumping, running around, in short, not syncing. We fixed all that. With the calendar, in principle, everything is stable there. Also, we worked on the interface; in the task manager we changed it a bit. We'll continue to change it further, but that's in the next sprint. In the dashboard we added statistics specifically for tasks, added two widgets. So far we haven't worked on the dashboard itself. Well, so that everything can be dragged around and so on. And the equipment warehouse...
- [00:01:05] **Customer:** By the way, do you want me to test it right now? Because I don't have access to this site.
- [00:01:10] **Team member:** Well, generally, yes.
- [00:01:12] **Customer:** Ah, right now...
- [00:01:14] **Team member:** Well, I can open it, you can just tell me where, where to click.
- [00:01:18] **Customer:** Ah, well okay, let's do that then. Because I... I can't find my VPN right now.
- [00:01:23] **Team member 2:** Uh-huh. Okay, good. Is it sitting on our server or on the University one?
- [00:01:28] **Team member:** On the University one.
- [00:01:30] **Team member:** So, I'll show everything now. Give me a sec, the demo. So, can you see it?
- [00:01:35] **Customer:** Yes.
- [00:01:36] **Team member:** Excellent. Here is the dashboard. Here, actually, are the two new widgets. So here are tasks sorted by deadlines, and here you can filter which tasks are on whom, by employees, by locations, by tags. And, well, the numbers. Let's move on to the task manager. Let's create board 1. Well, we fixed the dragging of cards, now they lock into place normally.
- [00:02:01] **Customer:** Uh-huh.
- [00:02:02] **Team member:** There. We also added filters for workload and locations. Now... Here's some more statistics...
- [00:02:08] **Customer:** Well, like in Jira, right? Meaning the same thing, that you can make stickers for each board, poke them there so that everything...
- [00:02:15] **Team member:** Well, the stickers are right here, these are the tags. So here. Here, it is displayed.
- [00:02:20] **Customer:** And this, ah... Ah, got it, I see.
- [00:02:23] **Team member:** Well, and it filters specifically by this tag. Look, here's another feature. We have, let me open the board settings. Here, we have label groups, for example, 'semester one'. Here we have the group 'semester one', and we attach this group to this tag. Then also, let's create a tag right now, let's say this one and this one. There. The orange one doesn't have this group. And we'll just create two tasks right now. Yeah. Understood. We hang this tag here. And this one here. So, look at how it will filter. I mean, right now we'll filter by which one... by the green one, it turns out, yes. Only green ones. At the same time, if we set the filter by label groups 'semester 1' right now, we'll only have the blue one, the green one; there won't be an orange one.
- [00:03:18] **Customer:** But do I understand correctly that I can, say, make a 'semester 1' group, put like math in there...
- [00:03:24] **Team member:** Like math analysis and so on, yes, yes.
- [00:03:27] **Customer:** Yes, yes, yes, and can I have several groups on one card like that, right?
- [00:03:32] **Team member:** Yes.
- [00:03:33] **Customer:** Got it, okay.
- [00:03:35] **Team member:** No, you can't attach the group itself to a card, but you can, well... there can be several tags in one group. Meaning, in one semester there are several courses. And like all courses will be displayed. Like this.
- [00:03:48] **Customer:** Ah, got it, okay.
- [00:03:50] **Team member:** There. So, moving on. Well, the calendar remained the same as it was. Here it goes. Events are created. Synchronization, you know, colors... red ones. Something didn't save... Okay. It probably gets colored because it's a stream. That's why it gets colored. Now, moving on to the warehouse. Oh. Now it decided not to be created. Yes, well yes. Well, for instance, this one appeared, it has tags 'working', 'not working'. You can create... assemble a kit, disassemble. Well, basically everything works.
- [00:04:25] **Customer:** And if we deploy it to an existing database, it won't like, erase everything?
- [00:04:30] **Team member:** We just need to add a migration, we'll figure it out.
- [00:04:33] **Customer:** Okay.
- [00:04:34] **Team member:** Here you can take it, you can return it.
- [00:04:37] **Customer:** Uh-huh.
- [00:04:38] **Team member:** So at the same time, if it is in an assembly, then you can't like take it separately. You can only take the assembly. Here we took it, displayed it, you can return it. You can add it to the cart, bam. This becomes a request. In this form. You can also attach tasks to requests...
- [00:04:55] **Customer:** A button flew off there, where it says "send to project".
- [00:04:59] **Team member:** Let's see... Oh, well it was like that, by the way.
- [00:05:03] **Customer:** Oh well.
- [00:05:04] **Team member:** Oh, right, here, return before the 4th, for example. It asks to load. We need to create a project for this. There, it's attached to the project. And in theory we can attach tasks right now. Why didn't it attach? Not good... Anyway, we will investigate why it didn't attach.
- [00:05:22] **Customer:** Ah wait, show the barcode, show it.
- [00:05:25] **Team member:** Sec... Yes, doing...
- [00:05:27] **Customer:** Yes, yes, yes.
- [00:05:29] **Team member:** So, anyway, something like this. And here all tasks are displayed. If we do it in the task manager right now, actually, make a "closed" column, move a task here, it will be completed, everything will be displayed here. Done. Well, this is our sprint. Basically, this is what we did. Now let's move on to the next item, which is quality. So, regarding quality, GitHub Actions on every pull request are green, everything is executing, everything is being tested. Everything from the last time works, in this sprint we also tweaked the tests a bit. Also, for the current sprint we formed the project architecture, meaning we formed all the diagrams, like architecture, how it communicates, process architecture, which processes are executed on which actions, in parallel, not in parallel. But... we haven't managed to finish everything regarding the warehouse yet. Well, as we can see, there's a bug with the project. Otherwise, it is... Anyway, this was discussed earlier, it turns out, now we are planning to finish the warehouse and as the next step form the dashboard. Like we discussed. After the demo of the sprint, what do you think? Is everything okay, or do we need to tweak something else?
- [00:07:05] **Customer:** Yes, everything is good.
- [00:07:07] **Team member:** Excellent. Well, that's it then, thank you very much. If there are any more questions or if there are thoughts on improvements after independent additional testing on team 34, write to us, we'll take everything into account, add it to the product backlog.
- [00:07:22] **Customer:** Yes, good.

---

# Customer UAT Review Transcript

## Date: 03-07-2026

## Participants: Team Member, Customer

## Sprint Goal Reviewed: UAT for Warehouse, Task Manager, and Calendar features, plus QA overview.

- [00:00:00] Team Member: Now let's move on to this testing. Once again, I want to ask for permission to record and transcribe.
- [00:00:06] Customer: Of course, you can.
- [00:00:08] Team Member: Great. So... right now our first task is — we are on the main page of this, we need to get to the warehouse. Yes, you'll be clicking and so on...
- [00:00:18] Customer: Damn, where do I actually click? Well, on the three dots, there's warehouse, is that it?
- [00:00:23] Team Member: Uh-huh. Well, the burger menu, right? There.
- [00:00:27] Team Member: So, look, now your... storage location, responsible person, and equipment status. Do you see everything?
- [00:00:34] Customer: Yes... Damn, your questions are tough. What storage location... Well, if it's storage location, look through the filters, uh, or it'll probably be in projects.
- [00:00:44] Team Member: Say that again?
- [00:00:46] Customer: Well, you can send it to a project, I don't know if it displays there, but if you send it to a project, there's a projects tab on the left.
- [00:00:54] Team Member: Ah, well here, it displays. In the composition.
- [00:00:57] Customer: Ah, okay.
- [00:00:58] Team Member: It just has the project name in numbers. So, now you need to... you only need working equipment, where will you go, where will you click?
- [00:01:08] Customer: Well, there's the 'working condition' filter.
- [00:01:10] Team Member: Uh-huh. Well, 'working'. There. Great. A sobriety test.
- [00:01:16] Customer: What? Looks like a sobriety test.
- [00:01:18] Team Member: Really. So, now let's create this equipment. And we'll edit it, let's say it's broken. There, well, and... aha, got it. There, it doesn't display, everything is fine. So, now your task is to take the broken equipment. There, to see that it will give you an error.
- [00:01:40] Customer: What, am I an idiot or something?
- [00:01:42] Team Member: Well, you have to. So here, go ahead... issuing error.
- [00:01:46] Customer: Ah, got it, cool feature.
- [00:01:48] Team Member: Everything is like... Ah, here, we returned one. Is the quantity there?
- [00:01:53] Customer: What?
- [00:01:54] Team Member: Yes, we have a little bit of a... alright, it doesn't quite match. There, now this... Well, regarding the warehouse, that's basically it for now.
- [00:02:04] Customer: Uh-huh.
- [00:02:05] Team Member: There, well, there are different filters here, you can scan, but that's on the phone. There, adding, everything is generally great. So, now let's move on to the next one. So, now you need to open the task manager.
- [00:02:18] Customer: You know what, by the way... There's this thing, when you have a lot of cards or the screen size changes, these little plates that are drawn right on the card, like edit, take, don't take, they sometimes overlap each other.
- [00:02:32] Team Member: That doesn't happen right now.
- [00:02:34] Customer: Ah, well okay.
- [00:02:36] Team Member: There, your task now is to go to the task manager.
- [00:02:40] Customer: Well, there's those three stripe things. Three Adidas stripes and tasks.
- [00:02:45] Team Member: Great.
- [00:02:47] Customer: And how does all this look on the phone?
- [00:02:50] Team Member: I'll show you now. It looks like this. Well, like, just one card will fit on the screen.
- [00:02:56] Customer: Well yeah, it's preferable if it were bigger, I mean one on the screen, and again, so this menu isn't on top, because it'll get in the way a bit, you just click on the board too. Uh-huh. And that's it, just so there's a separate button with all this info. There, and so... Well, look at how they did it in others, I mean it's convenient there that there's literally one stripe, you scroll it, move things if you need to, somehow that's convenient.
- [00:03:18] Team Member: Yeah, yeah, yeah. There. So, let's continue. There, essentially we now need to set a specific deadline for tasks. There, let's say, we set yesterday's date. Yesterday's date. Op, close. There, and here let's say we... choose the next day.
- [00:03:36] Customer: Is there a fool-proof error so you can't make the deadline go into the negative?
- [00:03:40] Team Member: Yes.
- [00:03:41] Customer: Okay.
- [00:03:42] Team Member: Look here. So, your task now is to make sure that the overdue card is actually in this... At the top, and the others aren't.
- [00:03:52] Customer: Aha.
- [00:03:53] Team Member: So, well the sorting here... the sorting changes.
- [00:03:57] Customer: Uh-huh. Good.
- [00:03:59] Team Member: Well, the overdue one is on top, then the planned ones, the ones without a deadline hang at the very bottom. Or you can move them arbitrarily. But otherwise, they will update automatically.
- [00:04:10] Customer: Uh-huh.
- [00:04:11] Team Member: So, now the next task, you need to apply this grouping by participant.
- [00:04:16] Customer: Holy cow, what does that mean? Like two guys in one card?
- [00:04:20] Team Member: Well, filter, no. Filter by participant.
- [00:04:24] Customer: Ah, well you go into filters there.
- [00:04:26] Team Member: Uh-huh.
- [00:04:28] Customer: And... assignee.
- [00:04:30] Team Member: Great. So next, again this... Now we need to go to the calendar.
- [00:04:35] Customer: These three dots here, three stripes, calendar.
- [00:04:39] Team Member: There, and well, you see the overdue task, it's glowing red.
- [00:04:44] Customer: Uh-huh.
- [00:04:45] Team Member: That's it, you see the other color too, so it's like a task that's just sitting there.
- [00:04:49] Customer: Uh-huh.
- [00:04:50] Team Member: There, also after refreshing the page, everything is saved. Now you need to drag the task to another day, move it.
- [00:04:58] Customer: Well, you click and drag.
- [00:05:00] Team Member: Great. Op, done, color changed. There, now let's say you drag it to the wrong place. There. Nothing changes. It gives you an error. There, everything is great. Also this, now you need to switch to another 3-day view.
- [00:05:15] Customer: Well, you click on 3 days there.
- [00:05:17] Team Member: Uh-huh. There, and we also drag the task to later. Everything works perfectly. So, and then you go to month. And let's say you drag it to the eleventh. Everything is great.
- [00:05:28] Customer: Yours, yours just totally crashed.
- [00:05:31] Team Member: No, no, it's just a long task.
- [00:05:33] Customer: Ah, got it, okay.
- [00:05:35] Team Member: There. Great. Overall, is it convenient or inconvenient?
- [00:05:39] Customer: Yeah, it's convenient, everything is fine.
- [00:05:41] Team Member: That's it, great. So. Well, basically we have... finished the user acceptance part, so thank you. So, now let's move on to our next point — quality...
- [00:05:52] Team Member: So basically for quality, our GitHub Actions on every pull request are green, everything executes, everything is tested. There, everything works from last time, in this sprint we also tweaked the tests a bit. There, also for the current sprint we formed the project architecture, meaning we formed all the diagrams, like the architecture of how it communicates, the procedural architecture of what processes run on what actions, in parallel or not. There.
- [00:06:20] Team Member: But as for the warehouse, we haven't managed to finish everything yet. Well, we see there's a bug with the project. Otherwise, it's there. Anyway, we discussed this earlier, so right now we are planning to finish the warehouse and as the next step, form the dashboard. There, just as we discussed after the demo in the sprint, what do you think? Is everything fine or do we need to refine something else?
- [00:06:42] Customer: Yeah, everything is good.
- [00:06:44] Team Member: Great. So, well thank you very much then. That's it, if you have any more questions or ideas for improvements after your additional independent testing, write to Team34, we will take everything into account and add it to the product backlog.
- [00:06:58] Customer: Yeah, alright.
