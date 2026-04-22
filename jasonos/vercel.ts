import { type VercelConfig } from "@vercel/config/v1";

// JasonOS — Vercel project config (typed replacement for vercel.json).
// Lives at the repo root of the deployed project. Because JasonOS is a
// subfolder of the CoSA repo, the Vercel project's "Root Directory" is
// set to `jasonos/` (configured via API on 2026-04-22).
export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",
  // Skip the build if the commit didn't touch the jasonos/ subfolder.
  // (CoSA's root vercel.json mirrors this in reverse.)
  ignoreCommand: "git diff --quiet HEAD^ HEAD -- jasonos",
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
