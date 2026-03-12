**CoSA \-- Chief of Staff App**

Complete Build Spec & Cursor Execution Prompt

github.com/Kuperman-Ventures/CoSA  |  co-sa.vercel.app  |  March 2026

| *This is the complete technical execution spec for CoSA, written for Cursor. It covers everything identified across the full code review: schema gaps, data layer migration, behavioral issues, missing features, and UI corrections. Every item in this document is an instruction. Phases 1-6 are built. This spec covers what to fix, complete, and add before Phases 7-8.* |
| :---- |

**1\. Rules for This Build Session**

| Commit the current working codebase to GitHub before touching anything. If something breaks, you need a clean rollback point. |
| :---- |

| Do NOT rewrite App.jsx from scratch. Make surgical, targeted changes only. The timer logic, KPI calculations, analytics math, and all five screens are correct \-- do not touch them. |
| :---- |

| Do NOT change any UI layout, color, or navigation. Visual design is locked. |
| :---- |

| localStorage must remain functional as a fallback. Never remove persistState() calls. The app must work without sign-in. |
| :---- |

| Build and test one section at a time. After each section, verify the app loads and the Today screen still works before proceeding. |
| :---- |

| All Supabase functions must handle errors gracefully: log to console, return null, never crash the app. |
| :---- |

| Never delete task data \-- archive instead. Deleting tasks breaks historical KPI and analytics. |
| :---- |

| DEFINITION OF DONE FOR THE ENTIRE SPEC: Open the app on desktop. Complete one task. Open the app on a different device with the same Google account. The completed task appears in the KPI dashboard without any localStorage clearing or manual sync. That is this spec done. |
| :---- |

**2\. Current State \-- What's Built and What's Not**

Phases 1-6 were shipped in one build pass. The following is the complete honest inventory.

| Item | Status | Gap |
| :---- | :---- | :---- |
| **Five screens \+ bottom nav** | Built correctly | None |
| **All six timer states** | Built correctly | None |
| **Overrun count-up in red \+ prompt** | Built correctly | None |
| **Definition of done hard gate (10 words)** | Built correctly | None |
| **KPI auto-calculation from log data** | Built correctly | None |
| **Done \+ Outcome one-tap prompt** | Built correctly | None |
| **Task Library \-- 9 editable fields** | Built correctly | None |
| **Snapshot/deploy pattern** | Built correctly | None |
| **Task validation before deploy** | Exceeds spec | None |
| **Reschedule queue on cancel/overrun** | Built correctly | None |
| **Drag-to-reorder on Reschedule screen** | Built correctly | None |
| **Friday Review \-- 3 Qs \+ intention** | Built correctly | None |
| **Friday Review \-- PDF export** | Built correctly | None |
| **Google SSO auth** | Built correctly | None |
| **Analytics \-- 6 metrics by track/week** | Built correctly | None |
| **Encore OS session recap (purple card)** | Built \-- needs UI fix | Recap is too subtle. Must be a prominent blocking modal, not a footnote at the bottom of the task card. |
| **AI Chief of Staff suggest button** | Wired but unconfirmed | Endpoint /api/suggest-reschedule may not be deployed as a Vercel serverless function. Must verify. |
| **Networking track assignment** | WRONG TRACK | Warm Reconnect, Coffee Chat, LinkedIn tasks assigned to jobSearch (blue). Should be a shared networking track feeding both Advisors and Job Search KPIs. |
| **Data layer \-- Supabase-first** | WRONG ARCHITECTURE | App runs on localStorage with Supabase as secondary sync. Must flip to Supabase as source of truth. |
| **supabaseSync.js \-- task library** | JSON BLOB | Task library stored as JSON blob. Must use task\_templates table with proper rows. |
| **supabaseSync.js \-- timer sessions** | FLAT ARRAY | Completion log stored as flat array. Must use timer\_sessions table. |
| **Today view auto-population at 9am** | NOT BUILT | Deployment is manual only. Spec calls for hybrid auto-populate from weekly template at 9am. |
| **Schema: task\_templates columns** | 5 of 9 columns | Missing: frequency, kpi\_mapping, subtasks, outcome\_prompt. |
| **Schema: time\_block check constraint** | Missing Friday | Friday tasks cannot be inserted to task\_templates or today\_task\_instances. |
| **Schema: completion\_type check** | Missing Partial | Partial completions fail at the database level. |
| **Schema: today\_task\_instances snapshots** | Missing 4 cols | frequency\_snapshot, kpi\_mapping\_snapshot, subtasks\_snapshot, outcome\_prompt\_snapshot not stored. |
| **Schema: reschedule\_queue table** | Not in database | Queue lives in localStorage only \-- not cross-device. |
| **Schema: friday\_reviews table** | Not in database | Reviews not stored as queryable rows. |
| **Schema: networking track value** | Not a valid track | task\_templates check constraint does not include networking as a valid track value. |

**3\. Schema Migrations**

Run all of these in the Supabase SQL editor before writing any application code. Run them in order. Confirm each one succeeds before proceeding.

| MIGRATION 1 \-- Add Missing Columns to task\_templates |
| :---: |

| ALTER TABLE public.task\_templates   ADD COLUMN IF NOT EXISTS frequency      text NOT NULL DEFAULT 'Weekly'     CHECK (frequency IN ('Daily','Weekly','Monthly','As scheduled')),   ADD COLUMN IF NOT EXISTS kpi\_mapping    text NOT NULL DEFAULT '',   ADD COLUMN IF NOT EXISTS subtasks       text NOT NULL DEFAULT '',   ADD COLUMN IF NOT EXISTS outcome\_prompt text NOT NULL DEFAULT ''; \-- subtasks is plain text, newline-separated. \-- Do NOT use JSONB. The app splits on newlines. |
| :---- |

| MIGRATION 2 \-- Add 'Friday' to time\_block Check Constraints |
| :---: |

| ALTER TABLE public.task\_templates   DROP CONSTRAINT IF EXISTS task\_templates\_time\_block\_check; ALTER TABLE public.task\_templates   ADD CONSTRAINT task\_templates\_time\_block\_check     CHECK (time\_block IN ('BD','Networking','Job Search','Encore OS','Friday')); ALTER TABLE public.today\_task\_instances   DROP CONSTRAINT IF EXISTS today\_task\_instances\_time\_block\_snapshot\_check; ALTER TABLE public.today\_task\_instances   ADD CONSTRAINT today\_task\_instances\_time\_block\_snapshot\_check     CHECK (time\_block\_snapshot IN ('BD','Networking','Job Search','Encore OS','Friday')); |
| :---- |

| MIGRATION 3 \-- Add 'Partial' to completion\_type Check Constraints |
| :---: |

| ALTER TABLE public.task\_templates   DROP CONSTRAINT IF EXISTS task\_templates\_completion\_type\_check; ALTER TABLE public.task\_templates   ADD CONSTRAINT task\_templates\_completion\_type\_check     CHECK (completion\_type IN ('Done','Done \+ Outcome','Partial')); ALTER TABLE public.today\_task\_instances   DROP CONSTRAINT IF EXISTS today\_task\_instances\_completion\_type\_snapshot\_check; ALTER TABLE public.today\_task\_instances   ADD CONSTRAINT today\_task\_instances\_completion\_type\_snapshot\_check     CHECK (completion\_type\_snapshot IN ('Done','Done \+ Outcome','Partial')); ALTER TABLE public.timer\_sessions   ADD COLUMN IF NOT EXISTS completion\_type text     CHECK (completion\_type IN ('Done','Done \+ Outcome','Partial','Cancelled')); |
| :---- |

| MIGRATION 4 \-- Add Missing Snapshot Columns to today\_task\_instances |
| :---: |

| ALTER TABLE public.today\_task\_instances   ADD COLUMN IF NOT EXISTS frequency\_snapshot      text NOT NULL DEFAULT 'Weekly',   ADD COLUMN IF NOT EXISTS kpi\_mapping\_snapshot    text NOT NULL DEFAULT '',   ADD COLUMN IF NOT EXISTS subtasks\_snapshot       text NOT NULL DEFAULT '',   ADD COLUMN IF NOT EXISTS outcome\_prompt\_snapshot text NOT NULL DEFAULT '',   ADD COLUMN IF NOT EXISTS template\_id\_snapshot    text; \-- template\_id\_snapshot stores the string ID from INITIAL\_TASK\_LIBRARY \-- e.g. 'lib-advisors-1' for traceability during migration |
| :---- |

| MIGRATION 5 \-- Add 'networking' to task\_templates track Constraint |
| :---: |

| ALTER TABLE public.task\_templates   DROP CONSTRAINT IF EXISTS task\_templates\_track\_check; ALTER TABLE public.task\_templates   ADD CONSTRAINT task\_templates\_track\_check     CHECK (track IN ('advisors','jobSearch','ventures','networking')); |
| :---- |

| MIGRATION 6 \-- Create reschedule\_queue Table |
| :---: |

| CREATE TABLE IF NOT EXISTS public.reschedule\_queue (   id                   uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),   user\_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   task\_name            text NOT NULL,   track                text NOT NULL,   time\_block           text NOT NULL,   reason               text NOT NULL CHECK (reason IN ('overrun','cancelled','partial')),   remaining\_minutes    integer,   status               text NOT NULL DEFAULT 'pending'     CHECK (status IN ('pending','confirmed','dismissed')),   suggested\_date       date,   suggested\_time\_block text,   confirmed\_at         timestamptz,   dismissed\_at         timestamptz,   created\_at           timestamptz NOT NULL DEFAULT now() ); ALTER TABLE public.reschedule\_queue ENABLE ROW LEVEL SECURITY; CREATE POLICY "reschedule\_queue\_own\_all"   ON public.reschedule\_queue FOR ALL   USING (auth.uid() \= user\_id)   WITH CHECK (auth.uid() \= user\_id); |
| :---- |

| MIGRATION 7 \-- Create friday\_reviews Table |
| :---: |

| CREATE TABLE IF NOT EXISTS public.friday\_reviews (   id               uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),   user\_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   week\_start       date NOT NULL,   week\_score       text CHECK (week\_score IN ('green','yellow','red')),   kpis\_hit         integer,   kpis\_total       integer,   q1               text,   q2               text,   q3               text,   monday\_intention text,   created\_at       timestamptz NOT NULL DEFAULT now(),   updated\_at       timestamptz NOT NULL DEFAULT now(),   UNIQUE (user\_id, week\_start) ); ALTER TABLE public.friday\_reviews ENABLE ROW LEVEL SECURITY; CREATE POLICY "friday\_reviews\_own\_all"   ON public.friday\_reviews FOR ALL   USING (auth.uid() \= user\_id)   WITH CHECK (auth.uid() \= user\_id); |
| :---- |

| MIGRATION 8 \-- Create subtask\_checks Table |
| :---: |

| CREATE TABLE IF NOT EXISTS public.subtask\_checks (   id               uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),   user\_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   timer\_session\_id uuid NOT NULL REFERENCES public.timer\_sessions(id) ON DELETE CASCADE,   subtask\_index    integer NOT NULL,   checked          boolean NOT NULL DEFAULT false,   created\_at       timestamptz NOT NULL DEFAULT now(),   updated\_at       timestamptz NOT NULL DEFAULT now() ); ALTER TABLE public.subtask\_checks ENABLE ROW LEVEL SECURITY; CREATE POLICY "subtask\_checks\_own\_all"   ON public.subtask\_checks FOR ALL   USING (auth.uid() \= user\_id)   WITH CHECK (auth.uid() \= user\_id); |
| :---- |

**4\. Rewrite supabaseSync.js \-- Complete Function Map**

Replace supabaseSync.js in its entirety. The current file uses a JSON blob for the task library and a flat array for the completion log. The new file has 11 proper CRUD functions, one per data domain. Each function handles its own error \-- it logs to console and returns null on failure. None throw.

| Function | Behavior |
| :---- | :---- |
| **upsertTaskTemplates(tasks, userId)** | Upserts each task as a row in task\_templates. Maps all 9 app fields to correct columns. Uses task.id as the unique key. |
| **loadTaskTemplates(userId)** | SELECT \* FROM task\_templates WHERE user\_id \= userId ORDER BY time\_block, created\_at. Maps rows back to the app task object shape. |
| **upsertTodayTasks(tasks, userId, date)** | Upserts deployed task snapshots to today\_task\_instances for the given date. Writes all snapshot columns including the 4 new ones. |
| **loadTodayTasks(userId, date)** | SELECT \* FROM today\_task\_instances WHERE user\_id \= userId AND scheduled\_for\_date \= date ORDER BY queue\_order. Returns today deployed tasks for date (ISO string). |
| **upsertTimerSession(session, userId)** | Upserts a single timer session to timer\_sessions. Called on every state change: start, pause, complete, cancel. Writes completion\_type column. |
| **loadTimerSessions(userId, days=30)** | SELECT \* FROM timer\_sessions WHERE user\_id \= userId AND created\_at \>= now() \- interval. Returns sessions for KPI and analytics. |
| **syncRescheduleQueue(items, userId)** | Upserts pending items to reschedule\_queue. Called when a task is cancelled, overruns 5+ min, or is marked partial. |
| **loadRescheduleQueue(userId)** | SELECT \* FROM reschedule\_queue WHERE user\_id \= userId AND status \= 'pending' ORDER BY created\_at DESC. |
| **updateRescheduleItem(id, status, userId)** | Updates status to 'confirmed' or 'dismissed'. Sets confirmed\_at or dismissed\_at timestamp accordingly. |
| **upsertFridayReview(record, userId)** | Upserts review to friday\_reviews by (user\_id, week\_start). Updates all fields on conflict. |
| **loadFridayReviews(userId)** | SELECT \* FROM friday\_reviews WHERE user\_id \= userId ORDER BY week\_start DESC. Returns all past reviews. |

| *The old saveTaskLibrary and syncLogEntries calls in App.jsx must be replaced with calls to these new functions. Remove all blob-based sync logic. Keep the persistState() calls to localStorage untouched.* |
| :---- |

**5\. Data Flow \-- Supabase-First with localStorage Fallback**

Supabase is the source of truth when the user is signed in. localStorage is the fallback when not signed in. The app must function fully in both modes.

| Trigger | New Behavior |
| :---- | :---- |
| **App loads, user signed in** | In order: (1) loadTaskTemplates \-\> setTaskLibrary, (2) loadTodayTasks for today \-\> setTodayTasks, (3) loadTimerSessions \-\> setCompletionLog, (4) loadRescheduleQueue \-\> setRescheduleQueue, (5) loadFridayReviews \-\> setFridayReviews. Seed localStorage from Supabase as cache. |
| **App loads, no user** | Load all state from localStorage only. All features work. Show non-blocking banner: 'Sign in to sync across devices.' |
| **Task library edited** | Call upsertTaskTemplates debounced 500ms after state update. Update localStorage cache simultaneously. |
| **Deploy to Today** | Call upsertTodayTasks with full snapshot. Update localStorage. |
| **Timer: any state change** | Call upsertTimerSession with full current session state on every transition: start, pause, complete, cancel, overrun. |
| **Task cancelled / partial / overrun 5+ min** | Call syncRescheduleQueue with the new item. Update localStorage. |
| **Reschedule confirmed** | Call updateRescheduleItem(id, 'confirmed'). Update localStorage. |
| **Reschedule dismissed** | Call updateRescheduleItem(id, 'dismissed'). Update localStorage. |
| **Friday Review saved** | Call upsertFridayReview. Update localStorage. |
| **User signs out** | Clear Supabase session. Keep localStorage cache intact. App shows 'unsynced' banner. |

**6\. Fix the Networking Track Assignment**

Three tasks in INITIAL\_TASK\_LIBRARY are assigned to track: jobSearch. They belong to a shared networking track that feeds both Kuperman Advisors and Job Search KPIs simultaneously.

| Change | Instruction |
| :---- | :---- |
| **TRACKS constant** | Add networking entry: { key: 'networking', label: 'Shared (Networking)', color: '\#B8600B', priority: 1.5 }. Priority 1.5 places it between Advisors (1) and Job Search (2) in sorted displays. |
| **Warm Reconnect Outreach** | Change track from 'jobSearch' to 'networking' |
| **Coffee Chat / Call** | Change track from 'jobSearch' to 'networking' |
| **LinkedIn Engagement** | Change track from 'jobSearch' to 'networking' |
| **KPI\_DEFINITIONS** | Warm reconnects, coffee chats, LinkedIn comments are already in a Shared (Networking) group. Confirm their kpiMapping strings match the 3 tasks after the track change. |
| **Friday Review week score** | Networking KPIs count toward overall KPIs hit regardless of track \-- they are not isolated to one track score. |

**7\. Encore OS Session Recap \-- Make It a Moment**

When a Ventures track task completes, the app shows a purple session recap comparing definition of done vs. actually completed. This is one of the most important behavioral features in the app. The current implementation is too subtle \-- it appears at the bottom of the task card as an afterthought. It needs to be a prominent blocking modal that the user must actively acknowledge before moving on.

| Element | Specification |
| :---- | :---- |
| **Trigger** | Fires immediately on completion of any task with track \=== 'ventures' that has a definition\_of\_done recorded. |
| **Presentation** | Full-width modal overlay. Purple (\#6B3FA0) header bar. Not a card fragment within the task list \-- a blocking overlay that commands attention. |
| **Header text** | 'Session Accountability' in white on purple. Ventures track badge visible. |
| **Body \-- Definition of done** | Label: 'You said you would:' in purple. Text: the definition\_of\_done string. Left-bordered in purple. |
| **Body \-- Actually completed** | Label: 'What actually happened:' in dark gray. Text: the actual\_completed string. Left-bordered in gray. |
| **Comparison prompt** | If definition\_of\_done and actual\_completed are substantially different (simple string comparison, not AI), show yellow callout: 'These don't match \-- note the gap for your Friday Review.' |
| **Acknowledgment button** | 'Acknowledged' in purple. Closes the modal. No skip or X button \-- must click Acknowledged. |
| **What does NOT change** | The definition of done input gate (10-word minimum) and the actual\_completed input at completion. Only the recap presentation changes. |

| *The recap data is already captured correctly in timer\_sessions (definition\_of\_done and actual\_completed fields). This is a UI-only change \-- no data model changes required.* |
| :---- |

**8\. Today View \-- Auto-Population at 9am**

Currently deployment is entirely manual. The spec calls for hybrid auto-population: the app auto-deploys Active tasks from the library at 9am, with the user able to reorder or remove before starting.

| Condition | Behavior |
| :---- | :---- |
| **App loads, signed in, today\_task\_instances EXIST for today in Supabase** | Load them. Auto-populate already ran or user deployed manually. No action. |
| **App loads, signed in, NO today\_task\_instances for today, time \< 09:00** | Show 'No tasks deployed yet' state with manual Deploy button. Do not auto-populate. |
| **App loads, signed in, NO today\_task\_instances, time \>= 09:00, lastAutoDeployDate \!= today** | Auto-deploy all Active tasks from library. Write to today\_task\_instances in Supabase. Set lastAutoDeployDate \= today in localStorage. Show toast: 'Today's tasks auto-deployed from your library.' |
| **App loads, no user (local mode)** | Deployment remains manual only. Auto-population requires Supabase. |
| **lastAutoDeployDate check** | Stored in localStorage as ISO date string. Prevents re-triggering if app is refreshed on the same day after auto-populate ran. |

**9\. AI Chief of Staff \-- Verify and Complete**

The app calls /api/suggest-reschedule from the Reschedule screen. This endpoint must exist as a Vercel serverless function in the api/ folder at the repo root.

**Verification Steps**

1. Check that api/suggest-reschedule.js exists in the repo root. If not, create it.  
2. Confirm ANTHROPIC\_API\_KEY is set in Vercel environment variables. Do not commit it to the repo.  
3. Confirm the endpoint is reachable: deploy to Vercel and check the Functions tab in the Vercel dashboard.  
4. Test with a manual POST: send { rescheduleQueue: \[\], remainingTasks: \[\], todayDate: YYYY-MM-DD } and confirm a response within 5 seconds.

**Required Endpoint Behavior**

| // api/suggest-reschedule.js export default async function handler(req, res) {   if (req.method \!== "POST") return res.status(405).end();   const { rescheduleQueue, remainingTasks, todayDate } \= req.body;   // Model: claude-sonnet-4-5   // Priority rules in prompt: Advisors \> Job Search \> Ventures   // Prompt includes: pending reschedule items with reasons,   //   remaining unstarted tasks with estimates and tracks,   //   today date, hard stop at 4pm rule   // Returns: { suggestion: string }   // suggestion is plain text, 2-4 sentences   // e.g. 'Move the cancelled BD outreach to your first slot tomorrow.' } |
| :---- |

| *The app already handles the response correctly \-- it displays suggestion as plain text in the Reschedule screen. The only thing to confirm is that the endpoint exists, is deployed, and calls the Anthropic API with the right model and priority-aware prompt.* |
| :---- |

**10\. Build Order \-- Execute in This Sequence**

Each step has a definition of done. Do not proceed to the next step until the current one passes. Steps are ordered to minimize risk: schema first, then data layer, then app logic, then UI.

| Step | What | Definition of Done | Risk |
| :---: | :---- | :---- | :---: |
| **1** | **Run all 8 schema migrations in Supabase SQL editor** | Query each table. All columns present. No constraint errors. Migrations are idempotent \-- safe to re-run. | HIGH |
| **2** | **Rewrite supabaseSync.js with 11 CRUD functions** | Call each function independently in browser console. Each returns expected data shape or null. No throws. | HIGH |
| **3** | **Fix networking track in TRACKS \+ 3 task reassignments** | 3 networking tasks show orange. KPI dashboard shows Shared (Networking) group. No task data lost. | MED |
| **4** | **Wire sign-in useEffect to load all state from Supabase** | Sign in. Sign out. Sign in again. Library, today tasks, timer sessions all present without manual action. | HIGH |
| **5** | **Wire task library writes to Supabase** | Edit a task. Sign out. Clear localStorage. Sign back in. Edit is preserved. | HIGH |
| **6** | **Wire Deploy to Today to write today\_task\_instances** | Deploy tasks. Sign out. Open app in a different browser same account. Today tasks are present. | HIGH |
| **7** | **Wire timer session writes on every state change** | Complete a task. Sign out. Sign back in. KPI dashboard shows the completion. | HIGH |
| **8** | **Wire reschedule queue reads/writes to Supabase** | Cancel a task. Sign out. Sign back in. Reschedule item is present in Reschedule screen. | MED |
| **9** | **Wire friday\_reviews reads/writes to Supabase** | Save a Friday Review. Sign out. Sign back in. Review appears in history. | MED |
| **10** | **Add 9am auto-population logic** | Load app at/after 9am with no today tasks. Tasks auto-populate. Toast appears. Refresh \-- does NOT re-populate. | MED |
| **11** | **Encore OS session recap \-- promote to blocking modal** | Complete a Ventures task with definition of done set. Full-width purple modal appears. Acknowledged button required to dismiss. | MED |
| **12** | **Verify AI endpoint deployed and responding** | Click Get Suggestion in Reschedule screen. Response appears within 5 seconds. No console errors. | MED |
| **13** | **Cross-device end-to-end test** | Full workflow on desktop: deploy, start timer, complete task. Open app on laptop same account. KPI count matches. | HIGH |

**11\. What Does NOT Change**

Everything below is correct and complete. Cursor must not touch these.

| Do Not Touch | Reason |
| :---- | :---- |
| **All timer logic \-- all six states, overrun count-up** | Correct and complete |
| **Definition of done 10-word gate before timer starts** | Correct and complete |
| **KPI calculation logic (countKpi, isKpiHit, calcMetrics)** | Logic is correct \-- only data source changes |
| **Analytics calculations** | Same \-- only data source changes |
| **All five screens and bottom navigation** | Correct and complete |
| **Track color coding and visual design** | Locked \-- no changes |
| **Drag-to-reorder on Reschedule screen** | Correct and complete |
| **Friday Review UI, 3 questions, PDF export** | Correct and complete \-- only persistence layer changes |
| **Google SSO auth flow** | Correct and complete |
| **INITIAL\_TASK\_LIBRARY task content** | Keep all tasks, subtasks, estimates \-- only change the 3 track assignments |
| **persistState() localStorage calls** | Must remain \-- app needs to work without sign-in |
| **Validation system blocking deploy of incomplete tasks** | Exceeds spec \-- keep it |
| **Session recap data capture (definition\_of\_done, actual\_completed fields in timer\_sessions)** | Correct \-- only the presentation changes per Section 7 |

*CoSA Complete Build Spec  |  Kuperman Ventures  |  March 2026*