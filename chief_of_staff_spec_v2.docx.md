  
**JASON KUPERMAN**

Chief of Staff App

Product Specification v1.0

March 2026  |  Build in Cursor

| WHAT THIS IS A checklist-driven daily task manager with Pomodoro timers, AI rescheduling, and a KPI dashboard — built on the Personal Operating System framework. |
| :---: |

*Three tracks. One cockpit. No excuses.*

# **1\. Product Vision & Design Principles**

The Personal Operating System document is the reference manual — it tells you what the system is. This app is the cockpit — the thing you actually fly the plane from every day. They work together. The OS defines the rules. The app enforces them.

## **Core Design Principles**

| Friction by design | The app should make it slightly harder to skip a task than to do it. Not punitive — just honest. |
| :---- | :---- |
| **Time is real** | Every task has a time estimate. You cannot add a task without one. This forces scope honesty before you start. |
| **Data serves Friday** | Every metric the app tracks exists for one reason: to inform the Friday Review. If it doesn't serve that, it doesn't exist. |
| **Reschedule, don't delete** | When things go wrong — and they will — the app helps you adjust intelligently. It never lets you pretend a task didn't exist. |
| **One screen at a time** | The active task view shows one task and one timer. No overwhelm, no multitasking theater. |

# **2\. App Architecture & Screens**

## **Five Core Screens**

| Screen | What It Does | When You Use It |
| :---- | :---- | :---- |
| **🏠 Today** | Your daily task list organized by track and time block. Active timer lives here. | All day, every day — this is your primary screen |
| **📋 Task Library** | Master list of all recurring tasks across all three tracks, with subtasks and default time estimates. Edit here, deploy to Today. | Weekly during Friday planning, or when adding new tasks |
| **📅 Reschedule** | Drag-and-drop interface for moving tasks when things run over or plans change. AI suggests logical reorder based on priorities. | When life happens — like a last-minute networking event |
| **📊 KPI Dashboard** | Weekly scorecard pulled from task completion data, plus manual KPI inputs. Connects directly to Friday Review. | Friday Review — 20 minutes every week |
| **📈 Analytics** | Historical performance: time saved, pause counts, cancellation patterns, completion rates by track and task type. | Friday Review and monthly check-ins |

## **Navigation**

Bottom navigation bar with five icons corresponding to the five screens above. Active screen highlighted. No hamburger menus, no buried settings. Everything one tap away.

## **Track Color Coding — Used Consistently Everywhere**

| 🟢 Kuperman Advisors | 🔵 Job Search | 🟣 Kuperman Ventures |
| :---: | :---: | :---: |

# **3\. Timer Behavior & Pomodoro Logic**

## **Timer States**

| State | Trigger | What Happens |
| :---- | :---- | :---- |
| **Not Started** | Task exists in Today view | Shows estimated time. Start button visible. |
| **Running** | User clicks Start | Timer counts down. Pause and Complete and Cancel buttons visible. |
| **Paused** | User clicks Pause | Timer freezes. Pause duration begins tracking. Resume button visible. |
| **Completed** | User clicks Complete | Timer stops. Time saved calculated (estimate minus actual). Task marked done. Removed from active view. |
| **Cancelled** | User clicks Cancel | Timer stops. Remaining time logged to cancelled bin. Task flagged — does not disappear, moves to Rescheduled. |
| **Overrun** | Timer reaches zero | Gentle alert. Timer flips to count UP in red. Overrun time tracked separately. |

## **The Overrun Rule — Important Design Decision**

When a task runs over its estimate, the app does NOT automatically push subsequent tasks. It alerts you and lets you decide: complete and absorb the overrun, or cancel and reschedule. This keeps you in control while making the cost of overruns visible.

| *The overrun alert should say: 'You've used your allotted time for \[Task\]. Complete it now, or reschedule the remainder?' — not a passive notification but an active decision point.* |
| :---- |

## **Pomodoro Time Estimates — Defaults**

All time estimates are defaults pulled from the Task Library. The user can override any estimate for any session without changing the library default. Overrides are tracked — if you consistently override a task's estimate, the app suggests updating the default.

| Increment | Used For |
| :---- | :---- |
| **5 min** | Quick admin tasks: logging, updating tracker, sending one message |
| **10 min** | Short focused tasks: reviewing pipeline, writing one outreach message |
| **15 min** | Standard subtasks: research, follow-up, single deliverable |
| **25 min** | Classic Pomodoro block: writing, building, deep focus tasks |
| **45 min** | Extended focus: case study drafting, Cursor build sessions, strategy work |
| **90 min** | Full block: BD session, job search block — broken into subtasks internally |

# **4\. Task Library**

This is the complete master task list derived from the Personal Operating System. Every recurring task across all three tracks, broken into subtasks, with default time estimates and frequency. This is what gets deployed to the Today view each morning.

| *IMPORTANT: This is a living library. Tasks can be added, edited, or archived. But no task can exist without a time estimate and a track assignment. Those are non-negotiable fields.* |
| :---- |

## **Task Library — Editable Fields**

Every task in the library has the following editable fields. Changes to the library affect future deployments only — they never retroactively change a task already in your Today view or a timer already running.

| Field | What It Is | Downstream Impact |
| :---- | :---- | :---- |
| **Task name** | The display name | Updates everywhere it appears — Today view, analytics, KPI dashboard |
| **Track** | Advisors / Job Search / Ventures | Changes color coding and which KPIs it feeds |
| **Subtasks** | The checklist inside the task | Updates next deployment only — does NOT change today's active instance |
| **Default time estimate** | The Pomodoro duration | Updates future deployments only — does NOT change a timer already running |
| **Frequency** | Daily / weekly / monthly / as scheduled | Changes how often it auto-populates in the Today template |
| **Completion type** | Done vs. Done \+ Outcome | Changes whether a follow-up prompt appears on completion |
| **KPI mapping** | Which KPI this task feeds | Updates KPI calculations going forward only |
| **Time block** | BD / Networking / Job Search / Encore OS / Friday | Changes where it sits in the daily template |
| **Status** | Active / Paused / Archived | Active deploys normally. Paused removes from auto-population but preserves history. Archived hides but never deletes — analytics history is always preserved. |

| *THE KEY RULE: The Library is the template. Today is the instance. Editing the template does not reprint yesterday's newspaper. Never delete a task — archive it instead. Deleted tasks break historical analytics.* |
| :---- |

| TRACK 1: KUPERMAN ADVISORS |
| :---: |

## **BD Block — 9:30–11:00am**

**MONDAY — Build Session**

| LinkedIn Profile Optimization  ⏱ 45 min  *Weekly (Monday rotation)* |
| :---- |
| Review current headline and about section against latest positioning |
| Draft one improvement or update |
| Publish change and note what was updated |

| Case Study Development  ⏱ 45 min  *Weekly (Monday rotation)* |
| :---- |
| Open case study draft document |
| Write or refine one section (problem / approach / result / lesson) |
| Review for tone — does it sound like you? |
| Save and note where you left off |

| LinkedIn Thought Leadership Post  ⏱ 45 min  *Weekly (Monday rotation)* |
| :---- |
| Identify one insight, lesson, or point of view from this week |
| Draft post (150–300 words) |
| Review: does it speak to your ICP's pain? |
| Schedule or publish |

| One-Pager / Outreach Asset Update  ⏱ 45 min  *Monthly* |
| :---- |
| Review current one-pager or email template |
| Identify one thing to sharpen based on recent conversations |
| Update and save new version |

**TUESDAY & THURSDAY — Outreach Sessions**

| Pipeline Review  ⏱ 15 min  *Daily (Tue/Thu)* |
| :---- |
| Open fractional CMO pipeline tracker |
| Identify who needs a follow-up today |
| Flag anyone who has gone cold — add to outreach list |
| Note total pipeline status: how many in each stage? |

| Send Outreach Messages (x3)  ⏱ 30 min  *Daily (Tue/Thu)* |
| :---- |
| Write and send message \#1 — Connective member or warm contact |
| Write and send message \#2 — former colleague or LinkedIn connection |
| Write and send message \#3 — next on priority list |
| Log all three in pipeline tracker immediately |

| Follow-Up on Open Threads  ⏱ 15 min  *Daily (Tue/Thu)* |
| :---- |
| Review all contacts in 'Contacted' or 'Replied' status |
| Send follow-up to anyone who hasn't responded in 5+ days |
| Update pipeline tracker with new status |

**WEDNESDAY — Engage Session**

| Connective Meeting Prep  ⏱ 15 min  *Weekly (Wed)* |
| :---- |
| Review this week's Connective agenda or attendee list |
| Identify 2 people to prioritize connecting with |
| Prepare one sentence on what you're working on and what you're looking for |

| Discovery Call Prep & Execution  ⏱ 45 min  *As scheduled* |
| :---- |
| Review prospect's LinkedIn and website before call |
| Prepare 3 diagnostic questions |
| Conduct call |
| Send follow-up within 2 hours of call ending |
| Update pipeline tracker: call held, next action noted |

| LinkedIn Engagement (ICP Founders)  ⏱ 15 min  *Weekly (Wed — if no calls)* |
| :---- |
| Find 5 posts from founders or CMOs in your target ICP |
| Leave a thoughtful comment on each (not just 'great post') |
| Note any that engage back — add to outreach list |

| TRACK 2: JOB SEARCH |
| :---: |

## **Job Search Block — 1:00–2:00pm**

**MONDAY — Pipeline Review**

| Job Search Pipeline Review  ⏱ 20 min  *Weekly (Mon)* |
| :---- |
| Open job search tracker |
| Review all active applications — what is the status of each? |
| Identify anything that needs a follow-up this week |
| Identify 2–3 new target roles to research |

| Recruiter Check-In  ⏱ 10 min  *Weekly (Mon)* |
| :---- |
| Select one recruiter or headhunter to touch base with |
| Send a brief 'staying in touch' message — not desperate, just present |
| Note date of contact in tracker |

**TUESDAY — Research & Target**

| Target Company Deep Research  ⏱ 30 min  *Daily (Tue)* |
| :---- |
| Select one target company from your list |
| Research: are they growing? Funded? Marketing leadership gap? |
| Find the right human contact — not just the job portal |
| Add to tracker with detailed notes |

| Second Company Research  ⏱ 25 min  *Daily (Tue)* |
| :---- |
| Repeat above for second target company |
| Cross-reference: do you have any warm connections here? |
| Add to tracker |

**WEDNESDAY — Apply & Tailor**

| Tailored Application  ⏱ 45 min  *Weekly (Wed)* |
| :---- |
| Select one researched role to apply to today |
| Pull up job description — identify top 3 requirements |
| Tailor resume summary to mirror those requirements (1–2 changes only) |
| Write cover note — specific to this company and role |
| Submit application |
| Attempt warm introduction alongside application |
| Log in tracker: applied, contact identified, follow-up date set |

**THURSDAY — Recruiter & Headhunter Day**

| Recruiter Relationship Management  ⏱ 20 min  *Weekly (Thu)* |
| :---- |
| Send updates to 2 recruiters/headhunters you're actively working with |
| Be specific: 'I had a conversation with X company this week' not just 'still looking' |
| Log contact date in tracker |

| New Executive Search Firm Outreach  ⏱ 25 min  *Weekly (Thu)* |
| :---- |
| Research one new executive search firm focused on CMO/SVP roles |
| Find the right contact — not the general inquiry form |
| Send a targeted introduction message |
| Log in tracker |

| SHARED: NETWORKING BLOCK — 11:00am–12:00pm |
| :---: |

## **Networking Block**

This block serves both Track 1 and Track 2 simultaneously. Tag networking tasks with both tracks in the app — they count toward KPIs for both.

| Warm Reconnect Outreach  ⏱ 10 min  *Daily* |
| :---- |
| Identify one person you've lost touch with |
| Send reconnect message: 'been too long, would love to catch up for 20 min' |
| Log in networking tracker: name, date, channel |

| Coffee Chat / Call  ⏱ 45 min  *As scheduled* |
| :---- |
| Review prep notes before call |
| Conduct call — listen more than you talk |
| Note: is this a fractional lead, a job search lead, or a referral source? |
| Send brief follow-up same day |
| Log in networking tracker with next action |

| LinkedIn Engagement  ⏱ 15 min  *Daily (Tue/Thu)* |
| :---- |
| Find 3–5 posts from founders, CMOs, or ICP-adjacent people |
| Leave thoughtful comments — add genuine perspective |
| Note anyone who engages back — add to outreach list |

| TRACK 3: KUPERMAN VENTURES (ENCORE OS) |
| :---: |

## **Encore OS Block — 2:00–4:00pm**

**MANDATORY: Write your definition of done before any build session task is started. The app enforces this — you cannot start a build session timer without filling in the definition of done field.**

**MONDAY — Tester Outreach**

| Alpha Tester Outreach  ⏱ 25 min  *Weekly (Mon)* |
| :---- |
| Draft personal message to each active alpha tester |
| Ask a specific question: 'When you last logged in, what were you trying to do? Did it work?' |
| Send messages |
| Log responses in feedback tracker as they come in |

**TUESDAY — Product Review**

| Self-Directed Product Audit  ⏱ 45 min  *Weekly (Tue)* |
| :---- |
| Open Encore OS as a new user would |
| Write down every moment of confusion or friction — no editing, just capture |
| Categorize: blocking issue vs. nice to have |
| Update priority list: rank by impact on tester engagement |

**WEDNESDAY & THURSDAY — Build Sessions**

| Cursor Build Session  ⏱ 90 min  *Daily (Wed/Thu)* |
| :---- |
| BEFORE OPENING CURSOR: write definition of done in the app |
| Open Cursor |
| Build only the defined item |
| Test the fix before closing |
| Close Cursor at 4pm regardless of status |
| Log: done / not done / what's left |

**WEEKLY — Tester Call**

| Alpha Tester Call  ⏱ 30 min  *Weekly* |
| :---- |
| Book 20-minute call with one tester |
| Prepare 3 specific questions based on their usage patterns |
| Conduct call |
| Log key feedback: what's blocking them, what do they love, what would make them use it daily |
| Update product priority list based on what you heard |

| FRIDAY REVIEW & PLANNING — 11:00am–12:00pm |
| :---: |

## **Friday Review Block**

This block is non-negotiable. It is the block that makes all the other blocks compound. The app generates a pre-filled Friday Review from the week's task data — you review, annotate, and plan.

| Score the Week  ⏱ 20 min  *Weekly (Fri)* |
| :---- |
| Open KPI Dashboard — review auto-generated completion data |
| Fill in manual KPIs: discovery calls held, coffee chats, applications submitted |
| Mark each KPI: hit or missed |
| Note overall week score: green (7+ KPIs hit) / yellow (4–6) / red (3 or fewer) |

| Three Questions  ⏱ 15 min  *Weekly (Fri)* |
| :---- |
| Write answer to Q1: What actually got in the way? (Be specific) |
| Write answer to Q2: What is ONE thing I am doing differently next week? |
| Write answer to Q3: What is ONE thing I did well this week? |

| Plan Next Week  ⏱ 20 min  *Weekly (Fri)* |
| :---- |
| Review all three pipeline trackers: what needs follow-up Monday? |
| Check calendar: any calls, Connective events, or conflicts? |
| Set Monday intention: one sentence on the most important thing next week |
| Populate next week's Today view from Task Library |

| Clean Up  ⏱ 5 min  *Weekly (Fri)* |
| :---- |
| Close all open browser tabs |
| Clear desktop |
| Write Monday morning first task on a sticky note |

# **5\. Rescheduling Logic — The AI Chief of Staff**

The rescheduling engine is what makes this more than a to-do list. It treats your day as a living schedule, not a static checklist.

## **Trigger Events**

The reschedule screen activates automatically when any of the following occur:

* A task timer runs over its estimate by more than 5 minutes

* A task is cancelled

* The user manually opens the reschedule screen

* A new urgent task is added mid-day

## **Rescheduling Rules — The Logic**

| Scenario | What the App Suggests |
| :---- | :---- |
| **Task runs 15 min over in BD block** | Push the next BD subtask to tomorrow's BD block. Do not touch other tracks. |
| **Task cancelled in BD block** | Flag as cancelled. Offer to reschedule to tomorrow or next available BD slot. Never auto-delete. |
| **Last-minute networking event added** | Show conflicts. Suggest which tasks can move to tomorrow with least impact. Prioritize by track order: Advisors first, Job Search second, Ventures third. |
| **Entire block lost (sick, emergency)** | Mark all block tasks as rescheduled. Distribute across next 3 days based on priority. Flag to review at Friday Review. |
| **Running ahead of schedule** | Show 'bonus time' notification. Suggest next highest-priority task from any track. |

| *IMPORTANT: The app never silently reschedules. Every change is shown to the user and confirmed before it's applied. You are the Chief of Staff. The app is your assistant.* |
| :---- |

# **6\. Scoring & Analytics**

Every action in the app generates data. This section defines exactly what is tracked, how it is calculated, and where it appears.

## **The Six Metrics**

| Metric | How Calculated | What It Tells You |
| :---- | :---- | :---- |
| **Time Saved** | Estimated time minus actual time on completed tasks | You're working efficiently. Positive \= good. |
| **Overrun Time** | Actual time minus estimated time on tasks that went over | Your estimates are off, or the task is harder than expected. |
| **Pause Count** | Number of times you paused a running timer | High pause count \= distraction or task too large. Break it down. |
| **Pause Duration** | Total elapsed time across all pauses | Combined with pause count — long pauses suggest interruptions. |
| **Cancelled Time** | Time remaining on timer when cancelled | Time you committed to but didn't deliver. Review at Friday. |
| **Completion Rate** | Tasks completed / tasks scheduled, by track | Are you doing the work? The only number that really matters. |

## **KPI Dashboard — Fully Auto-Calculated**

Every KPI is calculated automatically from how you close out tasks. There is no manual KPI entry. All numbers come from task completion data.

| *HOW IT WORKS: Every task has a completion type. 'Done' counts toward the KPI automatically. 'Done \+ Outcome' prompts a one-tap follow-up question (e.g. 'Did this result in a booked call?'). That answer feeds the outcome KPI. Zero manual entry required.* |
| :---- |

**Completion Types**

| Completion Type | How It Works |
| :---- | :---- |
| **Done** | Task completed. KPI counter increments automatically. No further input needed. |
| **Done \+ Outcome** | Task completed AND triggered a result. App prompts one follow-up question. One tap yes/no. Both the task and the outcome feed separate KPI counters. |
| **Partial** | Task started but not fully completed. Counts as attempted, not completed. Does not increment KPI. Moves to reschedule queue. |
| **Cancelled** | Task abandoned. Remaining time logged to cancelled bin. Does not increment KPI. Flagged for Friday Review. |

**KPI Definitions**

| KPI | Target | Completion Type | Track |
| :---- | :---- | ----- | :---- |
| Outreach messages sent | **6 / week** | *Done* | Advisors |
| Discovery calls booked | **2 / week** | *Done \+ Outcome* | Advisors |
| Discovery calls held | **1 / week** | *Done \+ Outcome* | Advisors |
| Connective attendance | **100%** | *Done* | Advisors |
| Case study progress | **1 / month** | *Done* | Advisors |
| Warm reconnects sent | **3 / week** | *Done* | Shared |
| Coffee chats held | **1 / week** | *Done \+ Outcome* | Shared |
| LinkedIn comments posted | **5–6 / week** | *Done* | Shared |
| Companies researched | **2 / week** | *Done* | Job Search |
| Applications submitted | **2 / week** | *Done* | Job Search |
| Recruiter touchpoints | **3 / week** | *Done* | Job Search |
| Tester touchpoints | **2 / week** | *Done* | Ventures |
| Definition of done used | **Every session** | *Done* | Ventures |
| Things shipped | **1 / week** | *Done \+ Outcome* | Ventures |

# **7\. Open Decisions — LOCKED**

All six decisions have been made. These are locked and should be built to exactly as specified below.

| \# | Decision | Answer — LOCKED |
| ----- | :---- | :---- |
| **1** | **Authentication** | Simple login — email/password or Google SSO. Data syncs across desktop and laptop. Required for multi-device use. |
| **2** | **Today view population** | Hybrid — weekly template auto-populates at 9am, user can drag/drop to modify before starting. Friday planning sets next week's template. |
| **3** | **Mobile support** | Responsive from day one. Must work on desktop, laptop, and mobile browser. |
| **4** | **Data persistence** | Supabase. Proper database foundation, enables future features, works across devices. |
| **5** | **Definition of done enforcement** | Hard with memory — timer will not start until field is filled with minimum 10 words. App saves the definition and displays it at session end for comparison. |
| **6** | **Friday Review integration** | Hybrid — in-app review screen with auto-filled data and write-in fields, plus exportable PDF summary. |

# **8\. Cursor Build Prompt**

Copy and paste this prompt into Cursor to begin the build. It references this spec document as the source of truth.

| CURSOR PROMPT — Copy exactly: Build me a personal productivity web app called 'Chief of Staff' for a single user. This is a daily task manager with Pomodoro timers, three-track organization, AI-assisted rescheduling, fully auto-calculated KPIs, and a Google Calendar integration roadmap. Tech stack (all decisions are locked — do not substitute): Frontend: React with Tailwind CSS Backend/Database: Supabase Auth: Google SSO — user must be able to log in and sync data across desktop and laptop Responsive: must work on desktop, laptop, and mobile browser from day one Three tracks, color coded consistently throughout: Kuperman Advisors — green \#1E6B3C (Priority 1\) Job Search — blue \#2E75B6 (Priority 2\) Kuperman Ventures — purple \#9B6BAE (Priority 3\) Five screens (bottom nav bar, always visible): Today — daily task list with active Pomodoro timer. One active task displayed at a time. Task Library — master recurring task list. Each task has nine editable fields: name, track, subtasks, default time estimate, frequency, completion type, KPI mapping, time block, status (Active/Paused/Archived). Library edits affect future deployments only — never retroactively change active Today instances. Reschedule — drag-and-drop rescheduling. Auto-triggers on overrun or cancellation. Suggests reorder based on track priority (Advisors \> Job Search \> Ventures). Never silently reschedules — all changes shown and confirmed first. KPI Dashboard — fully auto-calculated from task completion data. No manual entry. Two completion types: 'Done' (auto-increments KPI) and 'Done \+ Outcome' (one-tap follow-up prompt feeds outcome KPI). Weekly scorecard view. Analytics — six metrics by track and week: time saved, overrun time, pause count, pause duration, cancelled time, completion rate. Timer behavior: Six states: Not Started / Running / Paused / Completed / Cancelled / Overrun Track: pause count, pause duration, cancelled time remaining, overrun time, time saved Overrun: timer flips to count up in red, prompts user: 'Complete now or reschedule remainder?' Encore OS / Kuperman Ventures build sessions: HARD-enforce definition of done field before timer starts. Minimum 10 words required. Field cannot be skipped. App saves the definition and displays it at session end alongside what was actually completed. Today view population: Hybrid: weekly template auto-populates at 9am, user can drag/drop to modify before starting Friday planning session sets the template for the following week Tasks organized by time block in this order: BD (9:30–11am) → Networking (11am–12pm) → Job Search (1–2pm) → Encore OS (2–4pm) Friday Review: In-app screen with auto-filled KPI scorecard and three write-in fields: What got in the way? One thing to change? One thing done well? Exports to a printable PDF summary Google Calendar (Phase 7–8, not Phase 1): Phase 7: one-way sync — tasks in Today view create Google Calendar blocks. Rescheduled tasks move their calendar event. Phase 8: two-way sync — new Google Calendar events trigger conflict detection and reschedule suggestions in app. BUILD THIS IN PHASES. Start with Phase 1 only: Today screen and timer logic. Do not build all five screens before testing the first one. Phase 1 is done when all six timer states work and completion type prompts appear correctly. |
| :---- |

# **9\. Recommended Build Order**

Build this in phases. Test each phase before moving to the next. This is your Encore OS 2–4pm block work — one phase per week minimum. Write your definition of done before opening Cursor for each session.

| Phase | What to Build | Definition of Done | Est. Time |
| ----- | :---- | :---- | ----- |
| **Phase 1** | **Today screen \+ Timer** | Can start, pause, complete, and cancel a task with full timer tracking. All six timer states work. Completion type prompt appears on Done \+ Outcome tasks. | *2–3 sessions* |
| **Phase 2** | **Task Library** | Can add, edit, archive, and deploy tasks with all nine editable fields. Status field works. Library edits do not affect active Today instances. | *1–2 sessions* |
| **Phase 3** | **Reschedule screen** | Can drag tasks, see conflict alerts, and apply suggested reorders. All five rescheduling scenarios handled. | *2 sessions* |
| **Phase 4** | **KPI Dashboard** | All KPIs auto-calculate from task completion data. Done \+ Outcome prompts feed outcome KPIs. No manual entry required. | *2 sessions* |
| **Phase 5** | **Analytics screen** | All six metrics displayed by track and week. Historical data visible. Trends readable at a glance. | *1–2 sessions* |
| **Phase 6** | **Friday Review \+ Auth** | In-app review screen generates exportable PDF. Google SSO login works. Data syncs across desktop and laptop. | *2 sessions* |
| **Phase 7** | **Google Calendar one-way sync** | Tasks in Today view create corresponding calendar blocks in Google Calendar. Rescheduled tasks move their calendar event automatically. | *2–3 sessions* |
| **Phase 8** | **Google Calendar two-way sync** | New events added in Google Calendar trigger conflict detection in the app. App suggests reschedule when calendar conflicts are detected. | *3–4 sessions* |

| *REMEMBER: This is your 2–4pm Encore OS block work. Not your BD time. Not your job search time. Cursor opens after your definition of done is written. Cursor closes at 4pm. No exceptions.* |
| :---- |

*Chief of Staff App Spec v1.0  |  Built March 2026  |  Review after Phase 1 is complete*