import { type VercelConfig } from "@vercel/config/v1";

// JasonOS — Vercel project config (typed replacement for vercel.json).
// Lives at the repo root of the deployed project. Because JasonOS is a
// subfolder of the CoSA repo, the Vercel project's "Root Directory" must
// be set to `jasonos/` in the dashboard.
export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",
  // BNA engine can take its time once we feed it real state.
  functions: {
    "app/api/bna/route.ts": { maxDuration: 300 },
    "app/api/tell-claude/route.ts": { maxDuration: 60 },
  },
  // Daily 8am ET BNA run (placeholder — wire when /api/bna is implemented).
  crons: [
    { path: "/api/bna?source=cron", schedule: "0 12 * * *" },
  ],
};
