// Initiative Dashboard — typed seed data.
// IDs are stable so editing task text doesn't wipe localStorage completion state.
// Source-of-truth count: 4 themes · 11 initiatives · 117 tasks (2026-04-19).
// (Note: an earlier draft header said 104; that was a stale count.)

import type { Track } from "@/lib/types";

export interface Task {
  id: string;
  text: string;
}

export interface TaskGroup {
  label: string; // empty string => render no sub-heading
  tasks: Task[];
}

export interface Initiative {
  id: string;
  title: string;
  groups: TaskGroup[];
}

export interface Theme {
  id: string;
  title: string;
  track: Track;
  initiatives: Initiative[];
}

export const INITIATIVES: Theme[] = [
  {
    id: "vibe-coding-tools",
    title: "Vibe Coding Tools",
    track: "venture",
    initiatives: [
      {
        id: "gtmtools-outbound",
        title: "gtmtools.io — outbound marketing",
        groups: [
          {
            label: "Foundation",
            tasks: [
              { id: "gtm-o-f-1", text: "Define ICP (fractional CMOs, GTM leaders, early-stage founders, RevOps)" },
              { id: "gtm-o-f-2", text: "Sharpen value prop and one-line positioning" },
              { id: "gtm-o-f-3", text: "Set up tracking: UTMs, analytics, conversion events" },
              { id: "gtm-o-f-4", text: "Build target prospect list (Apollo, Clay, Sales Nav)" },
            ],
          },
          {
            label: "Infrastructure",
            tasks: [
              { id: "gtm-o-i-1", text: "Secondary sending domains + inbox warmup" },
              { id: "gtm-o-i-2", text: "CRM / sequencer setup" },
              { id: "gtm-o-i-3", text: "Landing page optimized for cold traffic" },
              { id: "gtm-o-i-4", text: "Creative assets: demo video, proof points" },
            ],
          },
          {
            label: "Launch",
            tasks: [
              { id: "gtm-o-l-1", text: "Cold email sequences (3-4 touches by persona)" },
              { id: "gtm-o-l-2", text: "LinkedIn outbound: connect + value-first DM" },
              { id: "gtm-o-l-3", text: "Founder-led posting to warm the audience" },
              { id: "gtm-o-l-4", text: "Partner/affiliate outreach to adjacent tools" },
            ],
          },
          {
            label: "Optimize & scale",
            tasks: [
              { id: "gtm-o-s-1", text: "Weekly review: reply rate, CTR, signup rate" },
              { id: "gtm-o-s-2", text: "Kill losers, double down on winners" },
              { id: "gtm-o-s-3", text: "Retargeting for site visitors who didn't convert" },
              { id: "gtm-o-s-4", text: "Referral / word-of-mouth loop for activated users" },
            ],
          },
        ],
      },
      {
        id: "gtmtools-stickiness",
        title: "gtmtools.io — stickiness & repeat usage",
        groups: [
          {
            label: "Understand current behavior",
            tasks: [
              { id: "gtm-s-u-1", text: "Instrument product: actions, cohorts, drop-off" },
              { id: "gtm-s-u-2", text: "Identify 1-2 power-user behaviors that predict retention" },
              { id: "gtm-s-u-3", text: "Talk to 5 repeat users about what brought them back" },
              { id: "gtm-s-u-4", text: "Map current activation to habit loop (or confirm none)" },
            ],
          },
          {
            label: "Build the habit loop",
            tasks: [
              { id: "gtm-s-h-1", text: "Define the weekly/daily job the tool gets hired for" },
              { id: "gtm-s-h-2", text: "Add triggers: saved searches, digests, reminders" },
              { id: "gtm-s-h-3", text: "Streaks/status/progress indicators if they fit" },
              { id: "gtm-s-h-4", text: "Build a \"home\" view that gives a reason to return" },
            ],
          },
          {
            label: "Deepen repeat-visit value",
            tasks: [
              { id: "gtm-s-d-1", text: "History/memory: return to and iterate on past work" },
              { id: "gtm-s-d-2", text: "Personalization based on past usage" },
              { id: "gtm-s-d-3", text: "Fresh net-new content/data between visits" },
              { id: "gtm-s-d-4", text: "Collaboration or sharing hooks that pull teammates in" },
            ],
          },
          {
            label: "Lifecycle & win-back",
            tasks: [
              { id: "gtm-s-w-1", text: "Lifecycle emails triggered by usage signals" },
              { id: "gtm-s-w-2", text: "Re-engagement campaigns with specific hooks" },
              { id: "gtm-s-w-3", text: "Exit interviews for churned users" },
              { id: "gtm-s-w-4", text: "Metrics: DAU/WAU, cohort retention, time-to-second-session" },
            ],
          },
        ],
      },
      {
        id: "encoreos-next-steps",
        title: "encoreos.co — next steps",
        groups: [
          {
            label: "Product clarity",
            tasks: [
              { id: "eos-n-p-1", text: "Lock the core JTBD in one sentence" },
              { id: "eos-n-p-2", text: "Audit features against JTBD; cut or defer off-thesis" },
              { id: "eos-n-p-3", text: "Define the aha moment for a new user's first session" },
            ],
          },
          {
            label: "Alpha tester momentum",
            tasks: [
              { id: "eos-n-a-1", text: "Review tester engagement (active, cold, why)" },
              { id: "eos-n-a-2", text: "Re-engage dormant testers with a specific ask" },
              { id: "eos-n-a-3", text: "3-5 structured feedback calls with active users" },
              { id: "eos-n-a-4", text: "Ship 1-2 high-signal improvements, loudly" },
            ],
          },
          {
            label: "Narrative & surface",
            tasks: [
              { id: "eos-n-s-1", text: "Tighten landing page: headline, proof, single CTA" },
              { id: "eos-n-s-2", text: "Short Loom/demo showing pipeline + networking loop" },
              { id: "eos-n-s-3", text: "Decide positioning: exec job search OS vs broader career OS" },
            ],
          },
          {
            label: "Controlled growth",
            tasks: [
              { id: "eos-n-g-1", text: "Open waitlist or invite tier beyond current alpha" },
              { id: "eos-n-g-2", text: "Seed in 2-3 communities where exec job seekers gather" },
              { id: "eos-n-g-3", text: "Founder posts on what works in exec search" },
              { id: "eos-n-g-4", text: "Instrument activation and weekly-active metrics" },
            ],
          },
        ],
      },
      {
        id: "encoreos-value-add",
        title: "encoreos.co — value-add features (resume, interview prep)",
        groups: [
          {
            label: "Prioritize what ships first",
            tasks: [
              { id: "eos-v-p-1", text: "List candidate features: resume per role, interview prep, outreach drafts" },
              { id: "eos-v-p-2", text: "Score each: demand × feasibility × strategic fit" },
              { id: "eos-v-p-3", text: "Pick 1-2 to ship first; park rest on visible roadmap" },
              { id: "eos-v-p-4", text: "Validate top pick with 3-5 alpha users before building" },
            ],
          },
          {
            label: "Resume per target role",
            tasks: [
              { id: "eos-v-r-1", text: "JD parsing: extract required skills and language" },
              { id: "eos-v-r-2", text: "Match against user's existing resume content" },
              { id: "eos-v-r-3", text: "Generate targeted rewrites with rationale (not overwrites)" },
              { id: "eos-v-r-4", text: "Version control: keep role-specific variants side-by-side" },
            ],
          },
          {
            label: "Interview prep",
            tasks: [
              { id: "eos-v-i-1", text: "Role-specific question banks (behavioral, functional, exec case)" },
              { id: "eos-v-i-2", text: "Mock interview flow (text and/or voice) with feedback" },
              { id: "eos-v-i-3", text: "Per-interview prep sheet: company, interviewer, likely Qs, STAR stories" },
              { id: "eos-v-i-4", text: "Post-interview debrief capture that feeds the next round" },
            ],
          },
          {
            label: "Integrate into core loop",
            tasks: [
              { id: "eos-v-c-1", text: "Surface features at the right pipeline stage" },
              { id: "eos-v-c-2", text: "Connect to networking log: \"prep for call with X\" pulls prior touches" },
              { id: "eos-v-c-3", text: "Weekly metric: prepped vs unprepped interviews" },
              { id: "eos-v-c-4", text: "Outcome feedback loop: results inform future suggestions" },
            ],
          },
        ],
      },
      {
        id: "narrativeos",
        title: "NarrativeOS (LinkedIn posting helper)",
        groups: [
          {
            label: "Start posting now (don't wait for product)",
            tasks: [
              { id: "nos-s-1", text: "Pick 3-4 content pillars (exec journey, fractional CMO, building in public, AI tools)" },
              { id: "nos-s-2", text: "Commit to a cadence you can hold (2x/week beats 5x/week abandoned)" },
              { id: "nos-s-3", text: "Draft 5 posts this week; ship at least 2" },
              { id: "nos-s-4", text: "Block recurring 30-min writing slot on the calendar" },
            ],
          },
          {
            label: "Sharpen the wedge (JTBD known: own-use LI posting helper)",
            tasks: [
              { id: "nos-w-1", text: "Log every friction point while posting — that's the real spec" },
              { id: "nos-w-2", text: "Identify THE specific friction to solve first (capture, drafting, scheduling, voice, analytics)" },
              { id: "nos-w-3", text: "Validate with 2-3 other regular LinkedIn posters" },
            ],
          },
          {
            label: "Build MVP from your own usage",
            tasks: [
              { id: "nos-m-1", text: "Ship the smallest thing that removes your biggest friction" },
              { id: "nos-m-2", text: "Use it yourself for 2 weeks before showing anyone" },
              { id: "nos-m-3", text: "Keep logging what it fixes vs what's still painful" },
            ],
          },
          {
            label: "Decide if it extends beyond you",
            tasks: [
              { id: "nos-e-1", text: "Soft alpha with 2-3 trusted posters for honest feedback" },
              { id: "nos-e-2", text: "Decide: just-for-me vs external product (both legit)" },
              { id: "nos-e-3", text: "If external: build-in-public posts double as demand gen" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "executive-job-search",
    title: "Executive Job Search",
    track: "job_search",
    initiatives: [
      {
        id: "reorganize-job-search",
        title: "Reorganize full-time job search (4th attempt)",
        groups: [
          {
            label: "Diagnose",
            tasks: [
              { id: "js-d-1", text: "List 6-month actuals: applications, conversations, interviews, offers, ghostings" },
              { id: "js-d-2", text: "Identify the real bottleneck: top, middle, or end of funnel" },
              { id: "js-d-3", text: "Name what keeps breaking the rhythm" },
              { id: "js-d-4", text: "Decide non-negotiables: role(s), comp floor, what to say no to" },
            ],
          },
          {
            label: "MVP system (use encore-os)",
            tasks: [
              { id: "js-m-1", text: "One pipeline view, one networking log, one weekly metric" },
              { id: "js-m-2", text: "Daily cadence: 30-60 min same time, non-negotiable" },
              { id: "js-m-3", text: "Weekly cadence: 60 min Friday review" },
              { id: "js-m-4", text: "Kill every tracker/doc/spreadsheet outside the core three" },
            ],
          },
          {
            label: "Rebuild top of funnel",
            tasks: [
              { id: "js-t-1", text: "Target list: 30-50 companies where the role actually exists" },
              { id: "js-t-2", text: "Warm path: 1st/2nd degree connections at each" },
              { id: "js-t-3", text: "Cold path: hiring managers and peers, not recruiters" },
              { id: "js-t-4", text: "Volume target: X conversations/week, not X applications/week" },
            ],
          },
          {
            label: "Sharpen the pitch",
            tasks: [
              { id: "js-p-1", text: "Rewrite 30-sec intro for the one role, not the range" },
              { id: "js-p-2", text: "2-3 stories that prove you can do that specific role" },
              { id: "js-p-3", text: "Run them live with 2-3 trusted people for honest feedback" },
              { id: "js-p-4", text: "Update resume/LinkedIn to match, then stop editing them" },
            ],
          },
          {
            label: "Protect the rhythm",
            tasks: [
              { id: "js-r-1", text: "Separate search time from fractional/building with hard blocks" },
              { id: "js-r-2", text: "One accountability partner or weekly check-in" },
              { id: "js-r-3", text: "Permission to have bad weeks without rebuilding the system" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "personal-admin",
    title: "Personal / Admin",
    track: "personal",
    initiatives: [
      {
        id: "open-tasks",
        title: "Open tasks",
        groups: [
          {
            label: "",
            tasks: [
              { id: "adm-1", text: "Move last money out of Merrill account" },
              { id: "adm-2", text: "Finish signing Wyatt up for payroll for umpiring" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fractional-cmo",
    title: "Fractional CMO (Kuperman Advisors)",
    track: "advisors",
    initiatives: [
      {
        id: "ship-positioning",
        title: "Ship the positioning (5-day plan from v1)",
        groups: [
          {
            label: "Day 1-2",
            tasks: [
              { id: "ka-d12-1", text: "Update LinkedIn headline (paste from v1)" },
              { id: "ka-d12-2", text: "Update LinkedIn About section (paste from v1)" },
            ],
          },
          {
            label: "Day 2-3",
            tasks: [
              { id: "ka-d23-1", text: "Pick homepage headline (recommended: Option A)" },
              { id: "ka-d23-2", text: "Update kupermanadvisors.com hero + sub-hero only" },
            ],
          },
          {
            label: "Day 3-4",
            tasks: [
              { id: "ka-d34-1", text: "Convert Narrative-Reality Audit one-pager into a PDF" },
            ],
          },
          {
            label: "Day 4-5",
            tasks: [
              { id: "ka-d45-1", text: "Build target list: 50 B2B SaaS companies raised in last 90 days" },
              { id: "ka-d45-2", text: "Send 10 cold emails using v1 template" },
              { id: "ka-d45-3", text: "Send 10 LinkedIn DMs using v1 template" },
              { id: "ka-d45-4", text: "Track reply rate (not opens)" },
            ],
          },
          {
            label: "Day 5",
            tasks: [
              { id: "ka-d5-1", text: "Tell every referral partner the packaged diagnostic exists" },
            ],
          },
        ],
      },
      {
        id: "update-ka-resume",
        title: "Update KA section of resume",
        groups: [
          {
            label: "Rewrite",
            tasks: [
              { id: "ka-r-1", text: "Headline using v1 positioning (fractional CMO for B2B SaaS founders mid-raise)" },
              { id: "ka-r-2", text: "Bullets: mechanism (narrative-pipeline-execution drift) + outcome" },
              { id: "ka-r-3", text: "Match site copy so resume + site reinforce each other" },
              { id: "ka-r-4", text: "Tighten to 4-6 lines — signal of focus" },
            ],
          },
        ],
      },
      {
        id: "vocabulary-discipline",
        title: "Vocabulary discipline",
        groups: [
          {
            label: "Scrub and commit",
            tasks: [
              { id: "ka-v-1", text: "Scrub LinkedIn/site/signatures of \"stop saying\" list (Engine, Revenue Architect, 25 years, confidence)" },
              { id: "ka-v-2", text: "Commit: no \"I think\", \"only 6 months\", \"probably\" in external copy" },
            ],
          },
        ],
      },
      {
        id: "eo-insurance",
        title: "Business infrastructure (E&O insurance)",
        groups: [
          {
            label: "Pre-engagement prep (do now)",
            tasks: [
              { id: "ka-eo-p-1", text: "Research 2-3 E&O providers for fractional execs (Hiscox, Thimble, Embroker)" },
              { id: "ka-eo-p-2", text: "Confirm typical coverage limits for fractional CMO scope" },
              { id: "ka-eo-p-3", text: "Ask 2-3 other fractional execs what they use and pay" },
            ],
          },
          {
            label: "On first engagement signed",
            tasks: [
              { id: "ka-eo-s-1", text: "Purchase E&O policy before work begins" },
              { id: "ka-eo-s-2", text: "Verify policy in force and matches engagement letter indemnification" },
            ],
          },
        ],
      },
    ],
  },
];

function countTasks(theme: Theme): number {
  return theme.initiatives.reduce(
    (acc, ini) => acc + ini.groups.reduce((a, g) => a + g.tasks.length, 0),
    0
  );
}

function countInitiatives(theme: Theme): number {
  return theme.initiatives.length;
}

export const INITIATIVE_STATS = {
  themes: INITIATIVES.length,
  initiatives: INITIATIVES.reduce((a, t) => a + countInitiatives(t), 0),
  tasks: INITIATIVES.reduce((a, t) => a + countTasks(t), 0),
  lastUpdated: "2026-04-19",
} as const;

export function getAllTaskIds(): string[] {
  const ids: string[] = [];
  for (const theme of INITIATIVES) {
    for (const ini of theme.initiatives) {
      for (const g of ini.groups) {
        for (const t of g.tasks) {
          ids.push(t.id);
        }
      }
    }
  }
  return ids;
}

export function countThemeTasks(theme: Theme): number {
  return countTasks(theme);
}

export function countInitiativeTasks(initiative: Initiative): number {
  return initiative.groups.reduce((a, g) => a + g.tasks.length, 0);
}

export const STORAGE_KEY = "jasonos:initiatives:v1";
