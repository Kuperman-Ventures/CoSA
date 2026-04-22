# JasonOS — Product Specification v0.1.1

**For:** Jason Kuperman
**Date:** April 21, 2026 (v0.1.1 patch April 21, 2026)
**Purpose:** Single-source spec for building JasonOS — a personal, desktop-resident command center that unifies Jason's four tracks of work into one always-on pull-model view. Designed to be handed to Cursor as context for vibe-coding the frontend against a Supabase backend.

> **Implementation note (April 21, 2026):** The spec calls out "Stripe" as the source for `gtmtools.io MRR` in §3.2. In practice, **gtmtools.io billing runs on Lemon Squeezy**, not Stripe. The implementation reflects this:
> - `lib/integrations/lemon-squeezy.ts` powers the gtmtools.io MRR / trials / 30d revenue tiles.
> - `lib/integrations/stripe.ts` powers Kuperman Advisors + Refactor Sprint revenue (where Stripe is the actual source of truth).
> - The "Revenue MTD" cross-track KPI is the sum of Stripe MTD + Lemon Squeezy 30d.
>
> Treat the spec as the **product** intent and the integration files as the **technical** truth where they disagree.

---

## 1. Vision & Operating Principles

### 1.1 Vision

JasonOS is the single place Jason opens in the morning and leaves on his second monitor all day. It unifies four tracks — Kuperman Venture, Kuperman Advisors, Job Search, and Personal — into one glanceable, actionable surface. It answers two questions at all times:

1. **What is the single best next action to move the ball forward?**
2. **What is trending across everything I care about?**

### 1.2 Principles

1. **Action-first.** If a card doesn't end in an action Jason can take inside the dashboard, it's a report, not a card. Reports belong in email.
2. **Pull, never push.** No Slack, no email, no notifications. The dashboard is always on; Jason decides when to look.
3. **Beautiful, dense, glanceable.** Designed for a second monitor, visible all day, readable in a three-second glance.
4. **Nothing sends without approval.** The system can draft, queue, rank, and propose — but every outbound action is human-confirmed.
5. **Status change, not disappearance.** Actioned cards stay visible with a changed state. The queue only grows — smart archival handles density.
6. **Judgment stays with Jason.** Claude assembles, ranks, and drafts. Jason decides.
7. **One-person tool.** Solo use. Single-tenant Supabase schema. No permissioning layer in v1.

---

## 2. Information Architecture

### 2.1 The Four Tracks

Tracks are the primary organizing dimension. Every object (card, to-do, project, contact, tile) is assigned to exactly one track.

| Track | Scope |
|-------|-------|
| **Kuperman Venture** | Vibe-coded products: gtmtools.io, encoreos.co, JasonOS itself, internal tools. SaaS metrics, product health, tester engagement. |
| **Kuperman Advisors** | Fractional CMO practice + Refactor Sprint. Pipeline, prospects, active clients, content marketing. |
| **Job Search** | Executive role pursuit. Applications, networking, interviews, role matches. |
| **Personal** | Non-business priorities. Family, health, finance, side interests. |

### 2.2 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HERO STRIP — Track pipelines + 4-6 cross-track KPIs         │
├───────────────────────────┬──────────────────────────────────┤
│                           │                                  │
│   TODAY'S MUST-DOS        │   MONITORING GRID                │
│   (Best Next Action       │   (Tiles by track,               │
│    engine output, 3-7     │    pinnable, with trends         │
│    items, editable)       │    and refresh timestamps)       │
│                           │                                  │
│   ACTION QUEUE            │                                  │
│   (All open cards, grouped│                                  │
│    by track, filterable)  │                                  │
│                           │                                  │
├───────────────────────────┴──────────────────────────────────┤
│  DAILY WRAP — end-of-day synthesis, persistent until archived │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 The Hero Screen

The first thing Jason sees when he opens JasonOS cold:

- **Track strip (top, full width):** Four tiles, one per track, each showing the single most important "pipeline" metric for that track, plus a mini-sparkline of the last 30 days. Clickable to filter the view below to just that track.
  - *Kuperman Venture:* MRR (gtmtools) + active encoreos testers
  - *Kuperman Advisors:* Weighted pipeline value + active Sprint count
  - *Job Search:* Active conversations count + days-since-last-forward-motion
  - *Personal:* Single user-configurable metric (default: "count of open personal to-dos")
- **Cross-track KPI strip:** Revenue MTD, Outstanding invoices, Meetings this week, Error count.
- **Today's Must-Dos (left, immediately below hero):** 3–7 items from the Best Next Action engine. Always reasoned — each has a one-line "why this, now" from Claude.

### 2.4 Navigation

- Primary nav: **Home**, **Tracks** (filters), **Projects**, **To-Dos**, **Contacts**, **Settings**
- A universal **"Tell Claude"** bar at the top, always available — takes natural language input that scopes itself based on where the cursor is.

---

## 3. Module Inventory

### 3.1 Action Queue Modules (cards requiring decisions)

Each module produces cards. Cards have: track assignment, object type, age, priority, state, linked context, verb options, and optional "why now" from the BNA engine.

#### Kuperman Advisors

| Module | What it surfaces | Primary verbs |
|--------|------------------|---------------|
| Crunchbase Daily | ICP-filtered funded companies, top 3 with drafted LinkedIn + email | Send, Edit & Send, Push to HubSpot, Snooze, Dismiss with reason |
| Refactor Sprint pipeline | Prospects by stage, days-since-last-touch, suggested next move | Send follow-up, Log call, Mark won/lost, Add to-do |
| Active client console | One row per engagement: last meeting summary, open commitments, draft of this week's update | Send update, Regenerate, Log time, Add to-do |
| LinkedIn engagement queue | Prospect/client posts worth commenting on, drafted comment | Post comment, Edit & post, Dismiss |
| HubSpot reply triage | Prospect replies awaiting Jason's response, drafted reply | Send, Edit & Send, Schedule meeting, Add to-do |

#### Kuperman Venture

| Module | What it surfaces | Primary verbs |
|--------|------------------|---------------|
| gtmtools.io new signups | Trial starts in last 24h, enrichment data | Welcome email, Add to HubSpot, Flag for outreach |
| gtmtools.io trial expirations | Trials ending in next 3 days, conversion prompts | Send nudge, Offer extension, Flag for call |
| gtmtools.io churn risk | Paid users with declining usage | Send check-in, Investigate, Dismiss |
| encoreos.co tester activity | New tester requests, active testers, dormant testers | Approve, Nudge, Request feedback |
| gtmtools.io account activity | Plan changes, payment issues, account events not covered by signup/expiration/churn | Send outreach, Add to-do |
| Site error monitor | Broken links, 5xx errors, deploy failures across 4 properties | Fix in Cursor, Create ticket, Dismiss |
| Feature request inbox | Testers/users requesting features, grouped by theme | Add to roadmap, Reply, Merge similar |

#### Job Search

| Module | What it surfaces | Primary verbs |
|--------|------------------|---------------|
| Pipeline triage | Contacts/applications that need a status update (stuck in "sent") | Set status, Send follow-up, Withdraw |
| Networking touch-ups | Contacts dormant 45+ days, context-aware check-in drafted | Send, Edit & Send, Schedule coffee, Dismiss |
| Reply triage | Incoming replies from Gmail matching job-search pipeline | Reply, Schedule, Flag VIP |
| Role match queue | New roles matching filter, scored | Apply, Save, Dismiss with reason |
| Interview prep | Interviews on calendar in next 5 days, auto-generated prep doc | Open prep, Schedule mock, Add to-do |
| Data hygiene queue | Duplicates, missing roles, missing next-actions in encore-os | Merge, Backfill, Dismiss |

#### Personal

| Module | What it surfaces | Primary verbs |
|--------|------------------|---------------|
| Personal to-dos | User-created personal to-dos | One-click done, Add note, Push to Things |
| Finance reminders | Mercury transactions requiring attention | Log, Categorize, Flag |
| Family/relationships | User-defined reminders (birthdays, anniversaries, check-ins) | Send message, Schedule, Snooze |

### 3.2 Monitoring Tiles (passive situational awareness)

Tiles show a number, a trend, and (when something is off) a contextual action button. No vanity metrics. Every tile must pass the "would I act differently if this number changed?" test.

#### Sites & Marketing

| Tile | Data source | Cadence |
|------|-------------|---------|
| kupermanadvisors.com traffic | Vercel Analytics | Daily |
| refactorsprint.com traffic | Vercel Analytics | Daily |
| encoreos.co traffic | Vercel Analytics | Daily |
| gtmtools.io traffic | Vercel Analytics | Daily |
| Meeting bookings | HubSpot | Real-time |
| Top referrers (all 4 sites) | Vercel Analytics | Daily |
| SEO rankings (key terms) | Manual or search console | Weekly |
| LinkedIn performance | Taplio API | Daily |

#### Outbound & Email

| Tile | Data source | Cadence |
|------|-------------|---------|
| Instantly sequence performance | Instantly API | Real-time |
| Reply rate trend (30d) | Instantly | Daily |
| Send-vs-reply volume | Instantly | Daily |
| Subject line leaders | Instantly | Weekly |
| Inbox median reply time | Gmail API | Daily |

#### Pipeline & Revenue

| Tile | Data source | Cadence |
|------|-------------|---------|
| Weighted pipeline (Advisors) | HubSpot | Real-time |
| Stage aging (deals in stage >N days) | HubSpot | Daily |
| Win rate trend | HubSpot | Weekly |
| Source attribution | HubSpot | Weekly |
| Revenue MTD/QTD | Stripe + Mercury | Daily |
| Outstanding invoices | Stripe / Mercury | Daily |
| 90-day weighted forecast | HubSpot + Stripe | Daily |

#### Refactor Sprint Engagements (Consultancy Lifecycle)

Refactor Sprint is a one-time $7,500 consultancy engagement, not a subscription. Metrics below track the engagement lifecycle and alumni flywheel, not SaaS metrics.

| Tile | Data source | Cadence |
|------|-------------|---------|
| Active Sprints in flight | HubSpot (deals in "Sprint: In Progress" stage) | Real-time |
| Sprints completed QTD | Stripe + HubSpot | Daily |
| Revenue from Sprints MTD/QTD | Stripe | Daily |
| Prospective Sprint pipeline (value + stages) | HubSpot | Real-time |
| Avg time from first contact → signed | HubSpot | Weekly |
| Avg deal-to-close conversion rate | HubSpot | Weekly |
| Client Console engagement (per active engagement) | Refactor Sprint app backend | Daily |
| Days-since-last-login per active client | Refactor Sprint app backend | Daily |
| Post-Sprint NPS / feedback score | Manual or client feedback form | Weekly |
| Referrals from Sprint alumni (count + sourced deals) | HubSpot (tagged source) | Weekly |
| Alumni touch queue (last contact per alumnus) | HubSpot | Weekly |

Note: The exact HubSpot deal stages need confirmation — this spec assumes stages exist for "Discovery," "Qualified," "Proposal Sent," "Signed," "Sprint: In Progress," and "Sprint: Complete." Stage names may differ.

#### Kuperman Venture — Product Health

| Tile | Data source | Cadence |
|------|-------------|---------|
| gtmtools.io MRR | Stripe *(actual: Lemon Squeezy — see implementation note above)* | Real-time |
| gtmtools.io paid subscribers | gtmtools.io admin (refactorsprint.com/portal/subscribers) | Daily |
| Plan mix (Starter/Pro/Agency) | gtmtools.io admin | Daily |
| Generation volume (per tool) | gtmtools.io admin | Daily |
| Trial-to-paid conversion | Stripe *(actual: Lemon Squeezy)* | Weekly |
| Churn rate | Stripe *(actual: Lemon Squeezy)* | Weekly |
| encoreos.co active testers | encore-os backend | Real-time |
| encoreos.co tester activity heatmap | encore-os backend | Daily |
| Site uptime (all 4) | Vercel / Pingdom | Real-time |

#### Job Search

| Tile | Data source | Cadence |
|------|-------------|---------|
| Active conversations | encore-os + HubSpot + LeadDelta (reconciled) | Daily |
| Pipeline by status | encore-os | Daily |
| Funnel conversion rates | encore-os | Weekly |
| Networking cadence (touches/wk) | encore-os | Weekly |
| Response rate (by target company) | encore-os | Weekly |
| Dormant-but-warm contacts | encore-os | Daily |

#### Personal Operating

| Tile | Data source | Cadence |
|------|-------------|---------|
| Time allocation by track | Google Calendar (with track tags) | Daily |
| Meeting load | Google Calendar | Daily |
| Deep-work block count | Google Calendar | Weekly |
| Outreach throughput | Instantly + Gmail + LinkedIn | Weekly |

### 3.3 Tile Behavior

- Every tile has: number, trend (sparkline + delta vs. previous period), refresh timestamp, drill-in view.
- Tiles can spawn action cards when thresholds cross (e.g., "Reply rate dropped 18% on Sequence X — pause?").
- Jason can pin/unpin tiles to a personal "primary" set per track.

---

## 4. Object Model

Core entities in JasonOS:

### 4.1 Card

The unit of action. Represents one decision waiting on Jason.

```
Card {
  id
  track: enum(venture | advisors | job_search | personal)
  module: string  // which source module generated it
  object_type: enum(outreach | reply | todo | alert | prospect | hygiene | ...)
  title: string
  subtitle: string
  body: rich_text  // may include drafts, context, links
  linked_objects: [Contact | Company | Deal | Email | Meeting | Project | ToDo]
  priority_score: float  // computed by BNA engine
  state: enum(open | actioned | dismissed | snoozed | archived)
  state_history: [{state, timestamp, reason?}]
  verbs: [Verb]  // available actions for this card
  why_now: string  // one-line BNA reasoning
  vip: bool  // inherited from linked contact/company
  created_at, updated_at, actioned_at, snoozed_until
}
```

### 4.2 To-Do

```
ToDo {
  id
  track: enum  // required
  project_id: uuid? // optional, if part of a Project
  title: string
  notes: rich_text
  tags: [string]
  due_date: date?
  source_card_id: uuid?  // auto-linked context
  source_type: enum(manual | auto_extracted | plan_step | card_spawned)
  state: enum(open | done)
  completion_note: string?
  external_push: { things_id?, hubspot_task_id? }
  created_at, updated_at, completed_at
}
```

### 4.3 Project (Initiative)

Introduced for the Goal → Plan decomposer. Groups related to-dos under a goal.

```
Project {
  id
  track: enum  // required
  name: string
  goal_statement: string
  success_criteria: [string]
  status: enum(active | paused | completed | abandoned)
  source: enum(user_defined | claude_decomposed)
  conversation_id: uuid?  // links to the planning conversation
  target_date: date?
  todos: [ToDo]
  created_at, updated_at, completed_at
}
```

### 4.4 Contact

Reconciled contact across encore-os, HubSpot, LeadDelta, Gmail.

```
Contact {
  id
  name
  email[]
  linkedin_url
  title
  company_id
  vip: bool
  tracks: [enum]  // which tracks this contact appears in
  source_ids: { encore_os?, hubspot?, leaddelta? }
  last_touch_date
  last_touch_channel
  objective_result: enum(yes | no | neutral | null)  // from encore-os
  notes
}
```

### 4.5 Company

```
Company {
  id
  name
  domain
  vip: bool
  hubspot_id?
  tracks: [enum]
  tags: [string]
}
```

### 4.6 Disposition Log

Every dismiss/snooze/send/complete is logged here. This is the training data for personalization.

```
Disposition {
  id
  card_id | todo_id | contact_id
  action: enum(sent | edited_sent | dismissed | snoozed | completed | deferred | reassigned)
  reason_code: enum(not_icp | bad_timing | low_quality_draft | already_done | other)
  reason_note: string?
  timestamp
}
```

### 4.7 Alert

Alerts are a special card type with auto-generation rules.

```
Alert {
  id
  category: enum(error | reply | opportunity | deadline)
  severity: enum(info | warn | critical)
  source: string  // which monitor fired
  title, body
  linked_card_id?
  state: enum(open | acknowledged | resolved)
  created_at, resolved_at
}
```

---

## 5. The "Best Next Action" Engine

### 5.1 Model: Heavy, Editable

Each morning (and on demand via refresh), Claude runs a reasoned pass over the entire open state and produces a ranked list of 3–7 Must-Dos.

### 5.2 Inputs

- Every open Card (across all tracks)
- Active Projects and their next-step to-dos
- VIP flags
- Deadlines (explicit + inferred from meetings, commitments in notes)
- Recent dispositions (what Jason has been ignoring or pushing to)
- Track balance (last 7 days of time allocation — Claude tries to prevent one track from starving)
- Alert stream (opens, replies, errors, opportunities)
- The current day's calendar (blocks already committed vs. free)

### 5.3 Output

A ranked list, each item with:
- The card/to-do it points to
- A 1–2 sentence "why this, now" from Claude
- A suggested time-block if appropriate ("do this in the 45 min before your 11am")
- Editable rank: Jason can drag to reorder, remove, or pin items

### 5.4 Editability

- Drag to reorder → updates the list for the day
- Pin an item → it stays in the Must-Dos until actioned regardless of re-runs
- Reject an item → logs to disposition; Claude avoids re-surfacing same reasoning tomorrow
- Add item manually → Jason types or picks a card; gets a Claude-generated "why now"

### 5.5 Prompt Skeleton (for implementation)

The BNA engine is a Claude prompt + a structured output schema. Rough shape:

```
SYSTEM: You are Jason's chief of staff. You see every open card across four tracks
(Kuperman Venture, Kuperman Advisors, Job Search, Personal). Produce 3-7 ranked
Must-Dos for today. Consider:
- Track balance (don't starve a track)
- Time-sensitivity (deadlines, replies waiting, stale stages)
- VIP-linked items
- Jason's calendar for today
- Recent dispositions (what he's been avoiding, what he's been shipping)

Output: ranked array of {card_id, rank, why_now, suggested_time_block?}

INPUT: {serialized_state: open_cards, projects, calendar, recent_dispositions, vips}
```

---

## 6. Goal → Plan Decomposer

### 6.1 Capability

Jason can open a chat with Claude and describe a goal in natural language. Claude asks clarifying questions, then produces a named **Project** with sequenced **To-Dos**, correctly tracked and tagged.

### 6.2 Interaction Model

1. Jason: "I want to land a CMO role at a $50M–$500M SaaS by end of Q3."
2. Claude asks 2–4 clarifying questions (target list? preferred stage? remote/hybrid? compensation floor?)
3. Claude produces a draft Project with success criteria + 8–15 sequenced to-dos (some date-anchored, some dependent), all tagged to the Job Search track.
4. Jason reviews and can: accept as-is, ask for revisions ("add a step for LinkedIn optimization after 3"), regenerate sections, split/merge to-dos.
5. On acceptance, the Project is saved, to-dos hit the to-do system, and the BNA engine starts surfacing them.

### 6.3 Plan Revisability

- "Add a step after X"
- "Combine 3 and 4"
- "Push this out 2 weeks"
- "Remove step 7"
- "Break step 5 into smaller parts"
- "Mark step 2 done retroactively"

All handled via natural language through the "Tell Claude" interface on the Project card.

### 6.4 Plan Sources

Projects can be created from:
- Explicit Jason-initiated conversation (primary)
- Commitments extracted from meeting transcripts (Granola/Fireflies) — Claude proposes a Project, Jason confirms
- Reactive: Claude notices a pattern ("You've taken 4 to-dos this month related to X — want to formalize as a Project?")

---

## 7. "Tell Claude" Universal Override

### 7.1 Scope

Every card, project, and to-do has an inline "Tell Claude" input. There's also a global input in the top nav.

### 7.2 Example Overrides

- On a Crunchbase card: "Send this but change the opener to reference their Series B announcement"
- On a pipeline card: "Research this company first, then draft the follow-up"
- On a Project: "I actually only have 2 weeks, not 3 months — compress the plan"
- On a to-do: "This is dependent on Joe's reply — snooze until he responds"
- Globally: "What should I work on for the next hour?" → pulls a mini-BNA of items fitting a 1-hour block

### 7.3 Implementation

- Each invocation passes the card/project/todo context + the user's natural-language instruction to Claude
- Claude produces a proposed change (edit, new to-do, reorder, draft update)
- Jason confirms (one click) or edits further

---

## 8. Action Vocabulary

### 8.1 Universal Verbs (available on most cards)

| Verb | What it does | External side-effect |
|------|--------------|----------------------|
| **Send** | Sends the drafted outreach as-is | Gmail / Instantly / LinkedIn (via Taplio) |
| **Edit & Send** | Opens the draft in an inline editor, then sends | Same as above |
| **Draft** | Generates a draft without sending | None |
| **Snooze** | Hides card until date; sets `snoozed_until` | None |
| **Add to-do** | Creates a to-do linked to this card | Optional push to Things / HubSpot Tasks |
| **Schedule** | Creates a calendar event | Google Calendar |
| **Prioritize** | Pins this card to Must-Dos until actioned | None |
| **Log to HubSpot** | Creates/updates HubSpot contact, deal, or task | HubSpot |
| **Mark won/lost** | Sets deal stage to closed | HubSpot |
| **Forward to** | Forwards context to a specified contact via Gmail | Gmail |
| **Add to memory** | Saves a fact/preference to Claude's memory | memory/ |
| **Generate doc** | Creates a doc (prep doc, recap, brief) and saves to Drive | Google Drive |
| **Open in Cursor** | Opens source file (for product health cards) | Cursor |
| **Dismiss (with reason)** | Closes card, logs disposition with reason code | Disposition log |
| **Tell Claude** | Natural-language override/refinement | Varies |

### 8.2 To-Do-Specific Verbs

| Verb | What it does |
|------|--------------|
| **Done** | One-click complete |
| **Done with note** | Complete + optional note (captures disposition) |
| **Push to Things** | Syncs as Things to-do |
| **Push to HubSpot Tasks** | Syncs as HubSpot task |
| **Re-link context** | Manual re-link to a different source card |

### 8.3 Project-Specific Verbs

| Verb | What it does |
|------|--------------|
| **Pause** | Project goes dormant, to-dos hidden |
| **Resume** | Reactivates |
| **Complete** | Marks project done, archives to-dos |
| **Abandon (with reason)** | Logs why this was dropped; feeds personalization |
| **Replan** | Re-runs the Goal → Plan decomposer with current context |

---

## 9. To-Do System

### 9.1 Source Types

- **Manual** — Jason types one
- **Auto-extracted** — Claude pulls from meeting notes, emails, commitments ("You said you'd send X by Friday")
- **Plan step** — generated by Goal → Plan decomposer, tied to a Project
- **Card-spawned** — created from a Card via the "Add to-do" verb

### 9.2 Grouping & Filtering

Default grouping: **by Track**. Secondary groupings available:
- By Project
- By Deadline (Today / This Week / Later / No date)
- By Tag (user-defined)
- By Source type

### 9.3 External Sync

Optional per-todo push targets:
- **Things** (personal task manager) — for to-dos Jason wants visible on mobile
- **HubSpot Tasks** — for to-dos tied to HubSpot deals/contacts

Sync is one-directional (JasonOS → Things/HubSpot) in v1. Completion happens in JasonOS; pushed copies get marked done on next sync.

### 9.4 Context Linking

Every to-do retains a `source_card_id` (or `source_meeting_id`, `source_email_id`). Clicking the to-do surfaces the originating context so Jason remembers *why* it exists.

### 9.5 Completion Flow

- Default: one-click "Done" → state → done, timestamp logged
- Optional: "Done with note" → single-field note captured to disposition log
- Auto-extracted to-dos: when marked done, Claude checks the source meeting/email to see if the commitment was actually fulfilled (heuristic check, Jason confirms)

---

## 10. Alert Rules

Alerts are a high-severity card type. Four categories:

### 10.1 Errors
- Any of the 4 sites returns 5xx or is unreachable
- Vercel deploy failure
- Stripe webhook failure
- encore-os MCP endpoint returns error (e.g., tester engagement schema bug)
- Sync failure with any integration

### 10.2 Replies
- New reply in Gmail to an outbound that's tracked in HubSpot or encore-os pipeline
- New reply to an Instantly sequence
- New DM on LinkedIn via Taplio

### 10.3 Opportunities
- New trial signup on gtmtools.io
- New tester signup on encoreos.co
- ICP-matching company in Crunchbase with a trigger event (funding, exec change)
- A VIP contact surfaces new activity (LinkedIn post, job change)

### 10.4 Deadlines
- Meeting in <24h without a prep doc generated
- Invoice overdue by 1 day
- Sprint client hasn't logged into Console in 7 days
- To-do with due date today/tomorrow and not done
- Trial expiring in 24h on gtmtools

### 10.5 Thresholds (initial)

Start permissive — surface more, filter later based on Jason's dispositions.

| Metric | Alert Threshold |
|--------|----------------|
| Site uptime | <99% rolling 24h |
| Email reply rate | 30% drop vs. 14-day median |
| Open rate | 25% drop vs. 14-day median |
| Site traffic | 40% drop day-over-day |
| Trial-to-paid | 25% drop vs. 30-day median |
| Deal stage aging | >14 days in current stage |
| Pipeline reply wait | >3 business days |

All thresholds are tunable in Settings.

---

## 11. Personalization & Learning

### 11.1 Disposition-Driven Learning

Every dismiss, snooze, send, or complete writes to the Disposition Log. Reason codes are multiple-choice + "Other":

**Dismiss reasons (Crunchbase / prospect cards):**
- Not ICP
- Bad timing
- Already in conversation
- Low quality draft
- Competitor relationship
- Other

**Dismiss reasons (networking):**
- Too cold
- Recently contacted
- Not interested anymore
- Other

**Snooze reasons:**
- Waiting on reply
- Dependency on X
- Not ready mentally
- Other

### 11.2 Proactive Surfacing

Claude proactively suggests pattern-based updates (weekly or when threshold hit):

- "Based on your last 30 Crunchbase dismissals, your ICP now looks more like Series B Fintech than Series A SaaS — update filter?"
- "You've snoozed 60% of LinkedIn engagement cards in the last 2 weeks — want to turn that module off or change its threshold?"
- "3 of your last 5 won deals came from warm referrals, not outbound — shift weight toward the referral module?"

### 11.3 Weekly Self-Review Card

Auto-generated every Sunday. Contents:

- **What got actioned this week** — by track, by verb, count + notable items
- **What got repeatedly dismissed** — patterns to surface
- **Where time went** — calendar time by track
- **Balance check** — was any track starved?
- **Forward-looking** — what's on deck, what's stale, what the BNA engine suggests for next week
- **One reflection prompt** — open text field for Jason's own note

### 11.4 VIP System

Jason can flag any Contact or Company as VIP. Effects:
- VIP-linked cards get a rank boost in BNA
- Any activity by a VIP triggers an Opportunity alert
- VIP contacts never fall out of the Networking Touch-up module

---

## 12. Integration Map

### 12.1 Source of Truth per Domain

| Data | Source of Truth | Access Method |
|------|----------------|---------------|
| Advisor pipeline value + stages | HubSpot | HubSpot API |
| Prospect contacts (Advisors) | HubSpot | HubSpot API |
| Email sequences (outbound) | Instantly | Instantly API |
| Open/reply rates | Instantly | Instantly API |
| LinkedIn engagement + metrics | Taplio | Taplio API |
| LinkedIn CRM (job search) | LeadDelta | LeadDelta API / scrape |
| Job search pipeline (primary) | encore-os | MCP (wired) |
| Job search networking log | encore-os | MCP (wired) |
| Job search tester engagement | encore-os | MCP (wired, schema bug) |
| Meetings & calendar | Google Calendar | MCP (wired) |
| Meeting transcripts | Granola + Fireflies | MCP (wired for both) |
| Email | Gmail | MCP (wired) |
| Site analytics | Vercel Analytics | Vercel API |
| gtmtools.io subscriber admin | refactorsprint.com/portal/subscribers | Custom REST (needs token) |
| Crunchbase briefings | Gmail (Crunchbase Daily newsletter) | Parse via Gmail MCP |
| Revenue (Sprint + Advisors) | Stripe | Stripe API ✓ wired |
| Revenue (gtmtools.io subscriptions) | **Lemon Squeezy** | Lemon Squeezy API ✓ wired |
| Banking | Mercury | Mercury API (limited) |
| Personal tasks (sync target) | Things | Things URL scheme / sync |
| Memory | memory/ directory | File system |

### 12.2 Known Gaps

1. **gtmtools.io admin API** — need to confirm what refactorsprint.com/portal/subscribers exposes. May need to wrap in an MCP.
2. **Refactor Sprint Client Console activity** — if usage-per-client is tracked, we want it. If not, add lightweight telemetry.
3. **LeadDelta API** — confirm API access or plan scraping via Chrome connector.
4. **encore-os `approved_at` schema bug** — file fix; affects tester engagement endpoint.
5. **Vercel Analytics tier** — confirm whether current plan exposes the data we need; may supplement with Plausible or Fathom.
6. **Mercury** — API is limited; some data may need CSV export scheduling.

---

## 13. Supabase Schema (v1 core)

> **Implemented in:** `supabase/migrations/0001_init_jasonos_schema.sql`. All tables live under the `jasonos` Postgres schema for clean isolation from CoSA.

SQL for the primary tables. Includes RLS placeholders even though v1 is single-user. See the migration file for the canonical version (with `jasonos.` prefixes, idempotent enum creation, indexes, and `set_updated_at` triggers).

### 13.1 Additional Tables (v2)

- `tiles_state` — per-tile pin/unpin, threshold overrides
- `conversations` — persisted Tell-Claude threads for Goal→Plan and overrides
- `sync_jobs` — background job log for integrations
- `time_allocations` — Google Calendar events tagged by track

---

## 14. Visual Design Principles

1. **Glanceable.** The hero strip is readable from 6 feet away on a 27" monitor.
2. **Dense but not cluttered.** Grid layout, generous whitespace around tile groupings.
3. **Restrained color.** Status and track get color (green/yellow/red; plus a track accent). Everything else is monochrome.
4. **Typography does the hierarchy.** Big numbers, small labels, pill tags.
5. **Motion is signal, not decoration.** Sparklines animate on load; new cards slide in; actioned cards dim and move, don't vanish.
6. **No modals for common actions.** Verbs fire inline from the card. Only open a modal for multi-field edits (e.g., to-do details).
7. **The "Tell Claude" bar feels like a first-class citizen** — always visible, keyboard-accessible globally.

---

## 15. Phasing Plan

### v1 — The Daily Loop (weeks 1–4)

**Goal:** Replace Jason's morning check across tools. Deliver the hero screen + core action modules + essential monitoring.

Scope:
- Hero strip (all 4 tracks + cross-track KPIs)
- Action queue: Crunchbase Daily, Refactor Sprint pipeline, HubSpot reply triage, Job Search pipeline triage, Networking touch-ups
- Monitoring: site traffic (4 sites), meeting bookings, Instantly sequence perf, pipeline value, revenue MTD
- To-do system: manual + card-spawned (no Goal→Plan yet)
- BNA engine: basic version (ranking without elaborate "why now" reasoning)
- "Tell Claude" universal input
- Disposition logging
- Alert rules: errors + replies only

Integrations required for v1:
- HubSpot, Gmail, Google Calendar, encore-os, Stripe, Lemon Squeezy, Vercel, Instantly, Supabase

### v2 — SaaS Product Metrics + Job Search Hygiene (weeks 5–8)

**Goal:** Surface product health for gtmtools and encoreos; clean up the encore-os data quality.

Scope:
- gtmtools.io admin integration (paid subscribers, plans, per-tool usage — MRR + trials already wired via Lemon Squeezy)
- encore-os data hygiene module (dedup, backfill, status pipeline)
- New pipeline state machine (Sent → Opened → Replied → Conversation → Interview → Decision) with Gmail-signal auto-transitions
- Full BNA engine with reasoned "why now"
- Weekly self-review card
- Taplio integration
- LeadDelta integration
- Goal → Plan decomposer
- Opportunities + Deadlines alert categories

### v3 — Intelligence & Polish (weeks 9–12)

**Goal:** Make JasonOS feel like a chief of staff.

Scope:
- ICP drift suggestions (proactive personalization)
- Meeting transcript → commitment extraction → auto to-dos + Project proposals
- Interview prep auto-generation from calendar
- Time-allocation heatmap with rebalancing suggestions
- Advanced "Tell Claude" with multi-step plans ("plan the next 3 hours")
- Mobile splinter views (triage-only)
- Pattern detection: "You keep snoozing X type of cards — want to shut them off?"

---

## 16. Open Questions / Decisions to Confirm

1. **Vercel Analytics tier** — does the current plan expose referrer and per-page data via API? If not, supplement with Plausible?
2. **LeadDelta API vs. scrape** — confirm which.
3. **gtmtools.io admin API shape** — need to inspect refactorsprint.com/portal/subscribers (which hosts the gtmtools.io admin, not a Sprint subscriber view) to design the Venture tiles.
4. **Things sync mechanism** — URL scheme is fine for push, but how do we know when a Thing was completed outside JasonOS? Polling? Or accept one-way sync?
5. **Authentication model for JasonOS web app** — simplest: Clerk or Supabase Auth with email magic link, even though solo. *Currently:* no auth (single user, dashboard is the only surface).
6. **Frontend stack** — assumed Next.js + Tailwind + Shadcn for Cursor velocity. ✓ confirmed and built.
7. **Claude model for BNA + Tell Claude** — Opus 4.6 for BNA, Sonnet 4.6 for Tell Claude (cost/speed balance). Revisit.
8. **Revenue target for cost model** — BNA runs once daily = ~1 long-context request. Tell Claude = N small requests per day. Should fit well under $1/day.

---

## Appendix A — Four Properties Quick Reference

| Property | What | Primary Conversion | Memo |
|----------|------|---------------------|------|
| kupermanadvisors.com | Main advisory hub — 3 tiers: Diagnose / Lead / Equip | Book meeting (→ HubSpot → Sales) | Sprint linked at $7,500 |
| refactorsprint.com | Sprint product site | Book meeting (/book) → Sprint purchase | Also hosts /portal/subscribers for gtmtools admin |
| encoreos.co | Job-search OS | Signups + usage | Alpha tester program; backend wired via MCP |
| gtmtools.io | SaaS: 8 GTM tools on Claude | Signups + usage (Starter $49 / Pro $199 / Agency $399) | Built for Jason's own practice first. Billing on **Lemon Squeezy**. |

---

## Appendix B — Pre-Build Checklist

Before Cursor work starts:

- [x] Confirm Supabase project URL + service role key
- [ ] Confirm HubSpot private app token
- [ ] Confirm Instantly API key
- [x] Confirm Stripe secret key (read-only scope)
- [x] Confirm Lemon Squeezy API key + store ID
- [ ] Confirm Taplio + LeadDelta access methods
- [ ] Inspect refactorsprint.com/portal/subscribers admin API
- [ ] Verify Vercel Analytics tier supports needed data
- [ ] File encore-os `approved_at` schema fix
- [x] Decide: Next.js + Tailwind + Shadcn (recommended) vs. alternative
- [ ] Decide: Clerk vs. Supabase Auth (deferred to v2)
- [ ] Confirm model tier choices (Opus for BNA, Sonnet for Tell Claude)

---

**End of spec v0.1.1.** Revise as decisions land.
