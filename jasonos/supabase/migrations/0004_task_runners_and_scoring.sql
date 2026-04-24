-- =============================================================================
-- 0004_task_runners_and_scoring.sql
--
-- Adds schema for the Task Runner pattern + contact scoring.
--
-- Target path in repo:  jasonos/supabase/migrations/0004_task_runners_and_scoring.sql
-- Apply via:            Supabase Dashboard → SQL Editor (paste this file, run)
-- Drift note:           0002 and 0003 are already applied to the live DB but
--                       still uncommitted in the working tree as of 2026-04-24.
--                       This file is 0004 because those slots are claimed.
--
-- Conforms to existing jasonos-schema conventions:
--   * Single-user RLS: "v1 allow all to authenticated" (true / true)
--   * updated_at trigger via jasonos.set_updated_at()
--   * UUID PKs with gen_random_uuid()
--   * timestamptz everywhere
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. jasonos.contact_scores
--
-- Per-contact Recency / Seniority / Fit scoring. Separated from jasonos.contacts
-- so re-scoring doesn't mutate the contact record and so scores can be
-- re-derived by AI without touching the underlying contact.
--
-- One score row per contact (unique constraint on contact_id). If we ever want
-- score history, introduce a contact_score_history audit table — do not remove
-- the unique constraint here.
-- -----------------------------------------------------------------------------

create table if not exists jasonos.contact_scores (
  id          uuid        primary key default gen_random_uuid(),
  contact_id  uuid        not null unique references jasonos.contacts(id) on delete cascade,
  recency     smallint    not null check (recency between 1 and 5),
  seniority   smallint    not null check (seniority between 1 and 5),
  fit         smallint    not null check (fit between 1 and 5),
  scored_by   text        not null default 'user' check (scored_by in ('user', 'ai')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contact_scores_contact_id_idx
  on jasonos.contact_scores(contact_id);

alter table jasonos.contact_scores enable row level security;

create policy "v1 allow all to authenticated"
  on jasonos.contact_scores
  for all
  to authenticated
  using (true)
  with check (true);

create trigger set_updated_at
  before update on jasonos.contact_scores
  for each row execute function jasonos.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. jasonos.runner_state
--
-- Per-runner UI state bag (weights, filter chips, sort order, search term,
-- whatever a specific runner wants to remember between sessions).
--
-- Keyed uniquely on (runner_id, task_id). Debounced writes from the client
-- every time state changes. If a runner needs to represent multiple concurrent
-- sessions for the same task, drop the unique constraint — we don't need that
-- in Phase 1.
-- -----------------------------------------------------------------------------

create table if not exists jasonos.runner_state (
  id          uuid        primary key default gen_random_uuid(),
  runner_id   text        not null,
  task_id     text        not null,
  state       jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (runner_id, task_id)
);

create index if not exists runner_state_task_id_idx
  on jasonos.runner_state(task_id);

alter table jasonos.runner_state enable row level security;

create policy "v1 allow all to authenticated"
  on jasonos.runner_state
  for all
  to authenticated
  using (true)
  with check (true);

create trigger set_updated_at
  before update on jasonos.runner_state
  for each row execute function jasonos.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. jasonos.runner_artifacts
--
-- Outputs emitted by a runner on Finish. Chained to the next runner via
-- task_id. Artifacts are append-only — the next runner reads the most-recent
-- artifact (highest created_at) for a given task_id. Multiple artifacts per
-- task are allowed so you can see Ranker iteration history without blowing
-- away prior runs.
-- -----------------------------------------------------------------------------

create table if not exists jasonos.runner_artifacts (
  id              uuid        primary key default gen_random_uuid(),
  runner_id       text        not null,
  task_id         text        not null,
  schema_version  text        not null default 'v1',
  payload         jsonb       not null,
  created_at      timestamptz not null default now()
);

create index if not exists runner_artifacts_task_id_created_at_idx
  on jasonos.runner_artifacts(task_id, created_at desc);

alter table jasonos.runner_artifacts enable row level security;

create policy "v1 allow all to authenticated"
  on jasonos.runner_artifacts
  for all
  to authenticated
  using (true)
  with check (true);

-- No updated_at trigger — artifacts are immutable.


-- =============================================================================
-- CONVENTION NOTES
--
-- No schema changes below — these are documentation of how existing tables
-- are used by the Task Runner system. Keep this block in the migration file
-- so future readers see the whole contract in one place.
-- =============================================================================
--
-- Tier-1 reconnect picks (adv-t-tier1 runner output) are stored as rows in
-- jasonos.cards with this shape:
--
--   track              = 'advisors'
--   module             = 'reconnect'
--   object_type        = 'tier1_contact'
--   title              = contact name
--   subtitle           = contact role + company
--   linked_object_ids  = {"contact_id": "<uuid>"}
--   priority_score     = computed score (recency*W_r + seniority*W_s + fit*W_f)
--   why_now            = human-readable rationale from the Ranker
--   verbs              = ['message', 'reconnect']
--   state              = 'open' when first ranked
--
-- This means tier-1 reconnects automatically feed into ActionQueue, MustDos,
-- and any other consumer of the cards table. Card state transitions (dismiss,
-- snooze, action) are handled by the existing cards infrastructure; this
-- migration does not duplicate any of that.
--
-- Career clusters (TBWA / Agency.com / Omnicom / Videri / OUTFRONT / etc.)
-- live in jasonos.contacts.tags using the prefix convention:
--
--   'alumni:tbwa', 'alumni:agency', 'alumni:omnicom', 'alumni:videri',
--   'alumni:outfront', 'alumni:industry', 'alumni:other'
--
-- Same tags array is used for other classifications:
--   'conference:cannes-2024', 'intro_source:<slug>', 'vip:<list>', etc.
--
-- No new tables or enums for clusters. If tags grow unwieldy, revisit.
--
-- 90-day plan task completion (plan90.ts) continues to live in localStorage
-- at key 'jasonos:plan90:v1' for now. This migration does NOT touch it.
-- Runners are responsible for flipping the source task in localStorage when
-- onFinish fires AND recording their artifact in jasonos.runner_artifacts.
-- If plan completion ever moves to Supabase, it will be a separate migration.
-- =============================================================================
