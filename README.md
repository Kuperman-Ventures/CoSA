# CoSA (Chief of Staff App)

Single-user productivity web app built in phases using:

- React + Tailwind CSS
- Supabase (database + auth)
- Vercel (deployment)

## Current Status

Phase 1 is implemented:

- Today screen
- One active task at a time
- Six timer states: Not Started / Running / Paused / Completed / Cancelled / Overrun
- Overrun prompt
- Completion type handling (`Done` and `Done + Outcome`)
- Kuperman Ventures hard "definition of done" gate (minimum 10 words)

## Local Development

1. Copy env file:
   - `cp .env.example .env.local`
2. Add your Supabase values to `.env.local`.
3. Install deps:
   - `npm install`
4. Run app:
   - `npm run dev`

## Supabase Schema

Run SQL from:

- `supabase/schema.sql`

This creates initial Phase 1 tables, RLS policies, and ownership rules.

## Setup Guide

See:

- `docs/platform-setup-checklist.md`

for step-by-step GitHub, Supabase, and Vercel setup.
