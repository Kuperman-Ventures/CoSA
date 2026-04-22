// Mock data layer — gives the v1 UI realistic content before any
// integration is wired. Replace each export with live Supabase queries
// (or integration adapters) as modules come online.
//
// Everything here matches the types in lib/types.ts so swapping is mechanical.

import type {
  ActionCard,
  Alert,
  BestNextActionItem,
  MonitoringTile,
  Project,
  ToDo,
} from "../types";

const now = new Date();
const iso = (offsetMin = 0) =>
  new Date(now.getTime() + offsetMin * 60_000).toISOString();
const day = (offset: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

// Synthetic but believable trend series for sparklines
const series = (base: number, n = 30, vol = 0.15, trend = 0): number[] =>
  Array.from({ length: n }, (_, i) => {
    const t = trend * (i / n);
    const v = base * (1 + t + (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * vol * 0.5);
    return Math.max(0, +v.toFixed(2));
  });

// =========================================================================
// Action Cards (spec §3.1)
// =========================================================================
export const MOCK_CARDS: ActionCard[] = [
  // ---------- Advisors ----------
  {
    id: "c-adv-001",
    track: "advisors",
    module: "crunchbase_daily",
    object_type: "outreach",
    title: "Atomic.dev — Series B, $42M",
    subtitle: "ICP match · Fintech infra · Lisa Ng, CMO hired 2 weeks ago",
    body: {
      draft:
        "Hi Lisa — congrats on the Series B and on landing at Atomic. With the new round and a fresh CMO seat, the next 60 days usually decide whether the GTM motion compounds or stalls. I run a 4-week Refactor Sprint that's been the difference for two of your peers (Stitchpay, Lattice Risk). Worth a 20-minute look?",
      links: [{ label: "Crunchbase profile", href: "#" }],
    },
    priority_score: 0.93,
    state: "open",
    vip: false,
    why_now:
      "Funding announced 3 days ago; new CMO hired 14 days ago — classic 60-day window before they lock vendors.",
    verbs: ["send", "edit_send", "log_to_hubspot", "snooze", "dismiss", "tell_claude"],
    created_at: iso(-90),
    updated_at: iso(-90),
  },
  {
    id: "c-adv-002",
    track: "advisors",
    module: "hubspot_reply_triage",
    object_type: "reply",
    title: "Marcus Hale (Patternlabs) replied — wants pricing",
    subtitle: "Stage: Discovery · Last touch: 2 days ago",
    body: {
      draft:
        "Marcus — Sprint engagements are $7,500 fixed-fee, 4 weeks, with the deliverables we discussed. Two slots left this month. Want me to send the calendar?",
    },
    priority_score: 0.91,
    state: "open",
    vip: true,
    why_now: "Hot prospect, replied during business hours, deal stuck in Discovery 9 days.",
    verbs: ["send", "edit_send", "schedule", "add_todo", "tell_claude"],
    created_at: iso(-180),
    updated_at: iso(-180),
  },
  {
    id: "c-adv-003",
    track: "advisors",
    module: "active_client_console",
    object_type: "outreach",
    title: "Weekly update draft — Helio (week 3 of Sprint)",
    subtitle: "Last meeting Thu · 2 open commitments from Jason",
    body: {
      draft:
        "Team — quick update on week 3: positioning workshop landed, ICP doc is in your inbox, and the demo redesign brief is attached. Two questions for Friday: (1) which Tier-1 customer can we cite by name, (2) who owns site copy after rollout?",
    },
    priority_score: 0.74,
    state: "open",
    vip: false,
    why_now: "Standing Friday update; client expects it before noon.",
    verbs: ["send", "edit_send", "draft", "add_todo", "tell_claude"],
    created_at: iso(-360),
    updated_at: iso(-360),
  },
  {
    id: "c-adv-004",
    track: "advisors",
    module: "linkedin_engagement",
    object_type: "outreach",
    title: "Comment on Priya Shah's post (VIP)",
    subtitle: "Post about CMO+Sales tension · 4h old",
    body: {
      draft:
        "The handoff problem usually isn't a process problem — it's a definition problem. We rebuilt 'qualified' for one client last month and pipeline coverage doubled in 3 weeks. Curious what 'qualified' means to your sales lead today.",
    },
    priority_score: 0.62,
    state: "open",
    vip: true,
    why_now: "VIP poster; comment-window is closing fast.",
    verbs: ["send", "edit_send", "dismiss", "tell_claude"],
    created_at: iso(-240),
    updated_at: iso(-240),
  },

  // ---------- Venture ----------
  {
    id: "c-ven-001",
    track: "venture",
    module: "gtmtools_trial_expirations",
    object_type: "alert",
    title: "3 trials expiring in next 24h",
    subtitle: "All on Pro plan, all >5 generations",
    priority_score: 0.86,
    state: "open",
    vip: false,
    why_now: "High-engagement trials — conversion call beats nudge email.",
    verbs: ["send", "edit_send", "schedule", "snooze", "tell_claude"],
    created_at: iso(-50),
    updated_at: iso(-50),
  },
  {
    id: "c-ven-002",
    track: "venture",
    module: "site_error_monitor",
    object_type: "alert",
    title: "encoreos.co — /onboarding 500s for 18 min",
    subtitle: "Vercel deploy v142 · likely env-var mismatch",
    priority_score: 0.95,
    state: "open",
    vip: false,
    why_now: "Production error during alpha onboarding window.",
    verbs: ["open_in_cursor", "add_todo", "dismiss", "tell_claude"],
    created_at: iso(-18),
    updated_at: iso(-18),
  },
  {
    id: "c-ven-004",
    track: "venture",
    module: "gtmtools_account_activity",
    object_type: "alert",
    title: "gtmtools.io · 2 plan changes + 1 payment retry (24h)",
    subtitle: "Pro→Agency upgrade · 1 Pro→Starter downgrade · Stripe-style retry pending on Lemon Squeezy",
    body: {
      context:
        "Outside the signup / trial-expiration / churn flows. Lemon Squeezy webhook log shows: subscription_updated ×2, subscription_payment_failed ×1.",
      links: [{ label: "Lemon Squeezy dashboard", href: "https://app.lemonsqueezy.com" }],
      draft:
        "Hi {{first}} — saw the plan change come through. Want me to walk you through what unlocks at the new tier (15 min)?",
    },
    priority_score: 0.58,
    state: "open",
    vip: false,
    why_now: "Plan changes are the single best leading indicator of expansion or churn — talk to them this week.",
    verbs: ["send", "edit_send", "add_todo", "snooze", "tell_claude"],
    created_at: iso(-90),
    updated_at: iso(-90),
  },
  {
    id: "c-ven-003",
    track: "venture",
    module: "encoreos_tester_activity",
    object_type: "outreach",
    title: "5 dormant testers (≥10 days)",
    subtitle: "All previously active; suggest re-onboard nudge",
    body: {
      draft:
        "Hey {{first}} — noticed you haven't been back in encoreOS in a couple weeks. We shipped pipeline reconciliation and a much faster networking dashboard since you last logged in. Want a 15-min walkthrough?",
    },
    priority_score: 0.55,
    state: "open",
    vip: false,
    why_now: "Lifetime value of an alpha tester drops sharply after 14 dormant days.",
    verbs: ["send", "edit_send", "snooze", "dismiss", "tell_claude"],
    created_at: iso(-720),
    updated_at: iso(-720),
  },

  // ---------- Job Search ----------
  {
    id: "c-job-001",
    track: "job_search",
    module: "pipeline_triage",
    object_type: "outreach",
    title: "8 contacts stuck in 'sent' >7 days",
    subtitle: "Includes 2 VIPs (Datalog, Stripe)",
    priority_score: 0.81,
    state: "open",
    vip: true,
    why_now:
      "Two of these are VIPs and within their typical reply cadence; a follow-up now will land in their Monday triage.",
    verbs: ["send", "edit_send", "tell_claude"],
    created_at: iso(-260),
    updated_at: iso(-260),
  },
  {
    id: "c-job-002",
    track: "job_search",
    module: "interview_prep",
    object_type: "alert",
    title: "Prep doc ready — Anthropic, Wed 10am",
    subtitle: "1 round behind; recruiter Sarah Ko",
    priority_score: 0.78,
    state: "open",
    vip: true,
    why_now: "Interview in 36h; prep window closing.",
    verbs: ["generate_doc", "schedule", "add_todo", "tell_claude"],
    created_at: iso(-300),
    updated_at: iso(-300),
  },
  {
    id: "c-job-003",
    track: "job_search",
    module: "networking_touchups",
    object_type: "outreach",
    title: "Reach out: Daniel Pell (Series C CMO peer)",
    subtitle: "Last touch: 51 days · context: his recent Substack post",
    body: {
      draft:
        "Daniel — your last Substack on category-create vs. category-cleanup put words to a thing I've been wrestling with. Coffee in the next two weeks?",
    },
    priority_score: 0.49,
    state: "open",
    vip: false,
    why_now: "51 days since last touch — within your warm-network refresh cadence.",
    verbs: ["send", "edit_send", "snooze", "dismiss", "tell_claude"],
    created_at: iso(-450),
    updated_at: iso(-450),
  },

  // ---------- Personal ----------
  {
    id: "c-per-001",
    track: "personal",
    module: "finance_reminders",
    object_type: "alert",
    title: "Mercury — 4 transactions need categorizing",
    subtitle: "$2,418 total · last cleared: Tue",
    priority_score: 0.42,
    state: "open",
    vip: false,
    why_now: "Quarter-end approaching; bookkeeping window is now.",
    verbs: ["add_todo", "snooze", "tell_claude"],
    created_at: iso(-200),
    updated_at: iso(-200),
  },
  {
    id: "c-per-002",
    track: "personal",
    module: "family_relationships",
    object_type: "todo",
    title: "Mom's birthday — Saturday",
    subtitle: "Plan call + send flowers",
    priority_score: 0.7,
    state: "open",
    vip: true,
    why_now: "4 days out — order window for same-region florist closes Thursday.",
    verbs: ["add_todo", "schedule", "tell_claude"],
    created_at: iso(-1440),
    updated_at: iso(-1440),
  },
];

// =========================================================================
// Today's Must-Dos (BNA output)
// =========================================================================
export const MOCK_BNA: BestNextActionItem[] = [
  {
    rank: 1,
    card_id: "c-ven-002",
    why_now:
      "Production error on encoreOS during the alpha onboarding window — every minute costs a tester.",
    suggested_time_block: "Right now · 25 min",
  },
  {
    rank: 2,
    card_id: "c-adv-002",
    why_now:
      "Hot prospect (Marcus / Patternlabs) replied 2h ago and the deal is 9 days into Discovery — close the loop while it's fresh.",
    suggested_time_block: "Before 11am · 10 min",
  },
  {
    rank: 3,
    card_id: "c-job-002",
    why_now:
      "Anthropic interview is 36h out; prep doc is ready — block 45 min today, not tomorrow.",
    suggested_time_block: "Afternoon focus block · 45 min",
  },
  {
    rank: 4,
    card_id: "c-adv-001",
    why_now:
      "Atomic.dev's funding window peaks this week. Send the drafted note before competitors do.",
    suggested_time_block: "Late morning · 8 min",
  },
  {
    rank: 5,
    card_id: "c-ven-001",
    why_now:
      "3 high-engagement trials expire in 24h — a personal call converts ~3× a nudge email.",
    suggested_time_block: "Before EOD",
    pinned: true,
  },
];

// =========================================================================
// Monitoring tiles (spec §3.2)
// =========================================================================
export const MOCK_TILES: MonitoringTile[] = [
  // Sites & marketing
  {
    id: "t-traffic-ka",
    track: "advisors",
    group: "sites_marketing",
    label: "kupermanadvisors.com · 7d visits",
    value: "1,284",
    delta: 0.12,
    deltaLabel: "vs prev 7d",
    series: series(180, 30, 0.18, 0.2),
    cadence: "daily",
    refreshedAt: iso(-30),
    source: "Vercel Analytics",
    pinned: true,
  },
  {
    id: "t-traffic-rs",
    track: "advisors",
    group: "sites_marketing",
    label: "refactorsprint.com · 7d visits",
    value: "412",
    delta: -0.08,
    series: series(60, 30, 0.22),
    cadence: "daily",
    refreshedAt: iso(-30),
    source: "Vercel Analytics",
  },
  {
    id: "t-traffic-eos",
    track: "venture",
    group: "sites_marketing",
    label: "encoreos.co · 7d visits",
    value: "904",
    delta: 0.34,
    series: series(120, 30, 0.2, 0.5),
    cadence: "daily",
    refreshedAt: iso(-30),
    source: "Vercel Analytics",
    pinned: true,
  },
  {
    id: "t-traffic-gtm",
    track: "venture",
    group: "sites_marketing",
    label: "gtmtools.io · 7d visits",
    value: "2,118",
    delta: 0.21,
    series: series(280, 30, 0.18, 0.3),
    cadence: "daily",
    refreshedAt: iso(-30),
    source: "Vercel Analytics",
  },
  // Outbound
  {
    id: "t-instantly-reply",
    track: "advisors",
    group: "outbound_email",
    label: "Instantly · 30d reply rate",
    value: "9.4%",
    delta: -0.18,
    series: series(11, 30, 0.25, -0.3),
    cadence: "daily",
    refreshedAt: iso(-15),
    source: "Instantly",
    alert: {
      tone: "warn",
      message: "Reply rate ↓18% vs 14d median — pause Sequence 'CMO-AltStack'?",
      verb: "Pause sequence",
    },
  },
  {
    id: "t-instantly-vol",
    track: "advisors",
    group: "outbound_email",
    label: "Sends vs replies (7d)",
    value: "412 / 39",
    delta: 0.05,
    series: series(35, 30, 0.4),
    cadence: "daily",
    refreshedAt: iso(-15),
    source: "Instantly",
  },
  // Pipeline & revenue
  {
    id: "t-hubspot-pipe",
    track: "advisors",
    group: "pipeline_revenue",
    label: "Weighted pipeline (Advisors)",
    value: "$184k",
    delta: 0.09,
    series: series(150, 30, 0.1, 0.25),
    cadence: "real-time",
    refreshedAt: iso(-3),
    source: "HubSpot",
    pinned: true,
  },
  {
    id: "t-rev-mtd",
    track: "advisors",
    group: "pipeline_revenue",
    label: "Revenue MTD (Sprint + Advisors)",
    value: "$11,420",
    delta: 0.42,
    series: series(8000, 30, 0.05, 0.5),
    cadence: "daily",
    refreshedAt: iso(-60),
    source: "Stripe",
    pinned: true,
  },
  // Refactor Sprint engagements (consultancy lifecycle, not SaaS metrics)
  {
    id: "t-rs-active",
    track: "advisors",
    group: "refactor_sprint_engagements",
    label: "Active Sprints in flight",
    value: "3",
    delta: 0.5,
    deltaLabel: "vs prev 30d",
    series: series(2, 30, 0.15, 0.4),
    cadence: "real-time",
    refreshedAt: iso(-5),
    source: "HubSpot · stage=Sprint: In Progress",
    pinned: true,
  },
  {
    id: "t-rs-pipeline",
    track: "advisors",
    group: "refactor_sprint_engagements",
    label: "Prospective Sprint pipeline",
    value: "$52,500",
    delta: 0.2,
    deltaLabel: "vs prev 30d",
    series: series(40000, 30, 0.12, 0.25),
    cadence: "real-time",
    refreshedAt: iso(-5),
    source: "HubSpot · 7 deals across Discovery → Proposal",
  },
  {
    id: "t-rs-alumni",
    track: "advisors",
    group: "refactor_sprint_engagements",
    label: "Alumni dormant ≥45d",
    value: "6",
    delta: 0.2,
    series: series(5, 30, 0.2, 0.3),
    cadence: "weekly",
    refreshedAt: iso(-720),
    source: "HubSpot · last_touch_date",
    alert: {
      tone: "warn",
      message: "6 Sprint alumni haven't been touched in 45+ days — flywheel is stalling.",
      verb: "Open touch-ups",
    },
  },
  {
    id: "t-ls-mrr",
    track: "venture",
    group: "venture_health",
    label: "gtmtools.io MRR",
    value: "$3,840",
    delta: 0.18,
    series: series(3000, 30, 0.06, 0.3),
    cadence: "real-time",
    refreshedAt: iso(-2),
    source: "Lemon Squeezy",
  },
  {
    id: "t-ls-trial",
    track: "venture",
    group: "venture_health",
    label: "Trial → Paid (7d)",
    value: "27%",
    delta: 0.04,
    series: series(0.25, 30, 0.4),
    cadence: "weekly",
    refreshedAt: iso(-180),
    source: "Lemon Squeezy",
  },
  {
    id: "t-eos-testers",
    track: "venture",
    group: "venture_health",
    label: "encoreOS active testers",
    value: "23",
    delta: 0.15,
    series: series(20, 30, 0.1, 0.2),
    cadence: "real-time",
    refreshedAt: iso(-1),
    source: "encore-os",
  },
  // Job search
  {
    id: "t-job-conv",
    track: "job_search",
    group: "job_search",
    label: "Active conversations",
    value: "14",
    delta: 0.0,
    series: series(13, 30, 0.05),
    cadence: "daily",
    refreshedAt: iso(-120),
    source: "encore-os + HubSpot + LeadDelta",
    pinned: true,
  },
  {
    id: "t-job-dormant",
    track: "job_search",
    group: "job_search",
    label: "Dormant-but-warm contacts",
    value: "9",
    delta: 0.5,
    series: series(7, 30, 0.3, 0.6),
    cadence: "daily",
    refreshedAt: iso(-120),
    source: "encore-os",
    alert: {
      tone: "warn",
      message: "9 warm contacts have gone >45 days without a touch.",
      verb: "Open touch-ups",
    },
  },
  // Personal ops
  {
    id: "t-time-alloc",
    track: "personal",
    group: "personal_ops",
    label: "Time by track (7d)",
    value: "Adv 38% · Ven 30% · Job 22% · Per 10%",
    series: series(8, 7, 0.3),
    cadence: "daily",
    refreshedAt: iso(-360),
    source: "Google Calendar",
  },
];

// =========================================================================
// Alerts (spec §10)
// =========================================================================
export const MOCK_ALERTS: Alert[] = [
  {
    id: "a-001",
    category: "error",
    severity: "critical",
    source: "Vercel · encoreos.co",
    title: "/onboarding returning 500s",
    body: "Started 18 min ago after deploy v142. Likely env-var mismatch on SUPABASE_SERVICE_ROLE_KEY.",
    linked_card_id: "c-ven-002",
    state: "open",
    created_at: iso(-18),
  },
  {
    id: "a-002",
    category: "reply",
    severity: "warn",
    source: "Gmail",
    title: "Marcus Hale (Patternlabs) replied",
    body: "Wants pricing. Tracked deal: Discovery → Proposal.",
    linked_card_id: "c-adv-002",
    state: "open",
    created_at: iso(-180),
  },
  {
    id: "a-003",
    category: "opportunity",
    severity: "info",
    source: "Crunchbase",
    title: "Atomic.dev raised $42M Series B",
    linked_card_id: "c-adv-001",
    state: "open",
    created_at: iso(-300),
  },
];

// =========================================================================
// Projects + ToDos (spec §6)
// =========================================================================
export const MOCK_PROJECTS: Project[] = [
  {
    id: "p-001",
    track: "job_search",
    name: "Land CMO at $50M–$500M SaaS by Q3",
    goal_statement:
      "Secure a CMO role at a $50M–$500M SaaS company by end of Q3 2026, with at least 3 active offer conversations in flight by July.",
    success_criteria: [
      "≥40 warm conversations with target-company decision makers",
      "≥3 second-round interviews in flight by July 1",
      "Signed offer by Sep 30",
    ],
    status: "active",
    source: "claude_decomposed",
    target_date: day(150),
    created_at: iso(-2000),
    updated_at: iso(-200),
  },
  {
    id: "p-002",
    track: "venture",
    name: "Get gtmtools.io to $10K MRR",
    goal_statement: "Triple MRR via paid conversions of existing trials and one new acquisition channel.",
    success_criteria: ["MRR ≥ $10,000", "Trial→paid ≥30%", "Churn <4% monthly"],
    status: "active",
    source: "user_defined",
    target_date: day(90),
    created_at: iso(-3000),
    updated_at: iso(-100),
  },
];

export const MOCK_TODOS: ToDo[] = [
  {
    id: "td-001",
    track: "job_search",
    project_id: "p-001",
    title: "Refresh LinkedIn headline + about for CMO positioning",
    notes: "Use the Helio positioning workshop framework on yourself.",
    tags: ["linkedin", "positioning"],
    due_date: day(2),
    source_type: "plan_step",
    state: "open",
    created_at: iso(-2000),
    updated_at: iso(-2000),
  },
  {
    id: "td-002",
    track: "job_search",
    project_id: "p-001",
    title: "Send warm intro asks to 5 portfolio CEOs",
    tags: ["networking"],
    due_date: day(5),
    source_type: "plan_step",
    state: "open",
    created_at: iso(-2000),
    updated_at: iso(-2000),
  },
  {
    id: "td-003",
    track: "venture",
    project_id: "p-002",
    title: "Add Stripe checkout for Agency tier",
    tags: ["product"],
    due_date: day(7),
    source_type: "plan_step",
    state: "open",
    created_at: iso(-3000),
    updated_at: iso(-3000),
  },
  {
    id: "td-004",
    track: "personal",
    title: "Order flowers for Mom",
    tags: ["family"],
    due_date: day(3),
    source_type: "card_spawned",
    source_card_id: "c-per-002",
    state: "open",
    created_at: iso(-1440),
    updated_at: iso(-1440),
  },
  {
    id: "td-005",
    track: "advisors",
    title: "Draft Q2 case study — Helio outcomes",
    tags: ["marketing"],
    source_type: "manual",
    state: "open",
    created_at: iso(-4000),
    updated_at: iso(-4000),
  },
];
