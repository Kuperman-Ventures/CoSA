# CoSA Phase 1 + 2 Test Plan (Printable)

Print this page and check off each item while testing.

Date: ____________  Tester: ____________

Environment:

- [ ] Local (`http://localhost:5173`)
- [ ] Production (Vercel URL): ______________________
- [ ] Browser: ______________________
- [ ] Device: Desktop / Laptop / Mobile

## A) Auth + Setup Sanity

- [ ] App loads without console/runtime crash.
- [ ] Google sign-in button appears when signed out.
- [ ] Google sign-in completes and returns to app.
- [ ] Signed-in email displays in header.
- [ ] Sign out button signs user out and returns to login screen.

## B) Phase 1 - Today Timer Logic

Use any task in Today queue and verify all six states:

- [ ] Not Started (default state visible)
- [ ] Running (after Start / Resume)
- [ ] Paused (after Pause)
- [ ] Completed (after Complete)
- [ ] Cancelled (after Cancel)
- [ ] Overrun (timer reaches zero and counts up)

### B1) Core transitions

- [ ] Not Started -> Running
- [ ] Running -> Paused
- [ ] Paused -> Running
- [ ] Running -> Completed
- [ ] Running -> Cancelled
- [ ] Running -> Overrun

### B2) Overrun behavior

- [ ] Timer flips to red overrun state at zero.
- [ ] Overrun prompt appears ("Complete now, or reschedule remainder").
- [ ] Overrun time metric increments.

### B3) Completion prompts

- [ ] Completing without "What was actually completed?" is blocked.
- [ ] For `Done + Outcome` tasks, completion is blocked until Yes/No outcome is selected.
- [ ] Completing after valid input sets state to Completed and shows success message.

### B4) Ventures hard gate

Using `Cursor Build Session` (Encore OS):

- [ ] Start is blocked when definition of done has fewer than 10 words.
- [ ] Start succeeds when definition of done has 10+ words.
- [ ] On completion, recap displays definition of done and actual completed notes.

### B5) Metrics tracking

- [ ] Pause count increments each pause.
- [ ] Pause duration accumulates correctly.
- [ ] Cancelled time shows remaining time when task is cancelled.
- [ ] Time saved / overrun values update correctly.

## C) Phase 2 - Task Library

### C1) Nine editable fields exist and can be edited

For a selected library task, verify all fields are editable:

- [ ] Name
- [ ] Track
- [ ] Subtasks
- [ ] Default Time Estimate
- [ ] Frequency
- [ ] Completion Type
- [ ] KPI Mapping
- [ ] Time Block
- [ ] Status (Active / Paused / Archived)

### C2) Create and update tasks

- [ ] Add Task creates a new library entry.
- [ ] Editing fields updates the selected library task.
- [ ] Validation messages appear when required fields are missing.
- [ ] Status helper text updates based on Active/Paused/Archived.

### C3) Status behavior

- [ ] Active tasks are eligible for deployment.
- [ ] Paused tasks stay in library but do not deploy.
- [ ] Archived tasks stay in library history but do not deploy.
- [ ] Filter (`All`, `Active`, `Paused`, `Archived`) works.

### C4) Deploy preview + deployment

- [ ] "Next Deploy Snapshot" shows active tasks as Ready/Blocked.
- [ ] Deploy is blocked when any Active task has validation errors.
- [ ] Deploy succeeds when Active tasks are valid.
- [ ] Last deployment timestamp updates.
- [ ] Today queue reflects deployed snapshot order by time block.

### C5) Non-retroactive rule (critical)

1. Deploy library to Today.
2. Edit a library task (e.g., name or estimate).
3. Do **not** deploy again.

- [ ] Today still shows old snapshot values (unchanged).

4. Deploy again.

- [ ] Today now shows updated values from latest library template.

### C6) Persistence

- [ ] Refresh browser and confirm library edits persist.
- [ ] Refresh browser and confirm last deployed Today snapshot persists.
- [ ] Active task selection remains valid after refresh.

## D) Responsive checks

- [ ] Desktop layout usable.
- [ ] Laptop layout usable.
- [ ] Mobile browser layout usable (bottom nav visible and usable).

## E) Defects Found

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
4. _______________________________________________

## F) Sign-off

- [ ] Phase 1 accepted
- [ ] Phase 2 accepted

Tester signature: ______________________  Date: ____________
