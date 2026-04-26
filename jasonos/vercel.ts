import { type VercelConfig } from "@vercel/config/v1";

// JasonOS — Vercel project config (typed replacement for vercel.json).
// Lives at the repo root of the deployed project. Because JasonOS is a
// subfolder of the CoSA repo, the Vercel project's "Root Directory" is
// set to `jasonos/` (configured via API on 2026-04-22).
export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",
  // Skip the build if the commit didn't touch the jasonos/ subfolder.
  // Runs from the project's Root Directory (jasonos/), so we cd up to the
  // repo root before checking the path. Exit 0 = skip, exit 1 = build.
  ignoreCommand:
    'cd "$(git rev-parse --show-toplevel)" && git diff --quiet HEAD^ HEAD -- jasonos',
  functions: {
    // BNA engine can take its time once we feed it real state.
    "app/api/bna/route.ts": { maxDuration: 300 },
    "app/api/tell-claude/route.ts": { maxDuration: 60 },
    // Product Health probes 9 targets in parallel with a 10s timeout each;
    // give the function some slack so a single slow site doesn't trip the
    // function timeout.
    "app/api/monitoring/health-check/route.ts": { maxDuration: 60 },
  },
  crons: [
    // Daily 8am ET BNA run (placeholder — wire when /api/bna is implemented).
    { path: "/api/bna?source=cron", schedule: "0 12 * * *" },
    // Product Health — every 2 minutes. Requires Vercel Pro (per-minute
    // crons). The route is gated by CRON_SECRET when that env var is set.
    {
      path: "/api/monitoring/health-check?source=cron",
      schedule: "*/2 * * * *",
    },
  ],
};
