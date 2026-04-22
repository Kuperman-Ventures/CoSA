-- JasonOS v1 schema
-- All JasonOS objects live under the `jasonos` Postgres schema so they are
-- cleanly isolated from CoSA. Auth users (auth.users) remain shared across
-- both apps; JasonOS rows that need a user owner reference auth.users(id).
--
-- IMPORTANT: After applying this migration, add `jasonos` to the
-- "Exposed schemas" list in Supabase Dashboard → Project Settings → API,
-- otherwise supabase-js cannot read these tables over PostgREST.

create schema if not exists jasonos;

-- Make sure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

-- =========================================================================
-- Enums
-- =========================================================================
do $$ begin
  create type jasonos.track as enum ('venture', 'advisors', 'job_search', 'personal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type jasonos.card_state as enum ('open', 'actioned', 'dismissed', 'snoozed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type jasonos.todo_state as enum ('open', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type jasonos.project_status as enum ('active', 'paused', 'completed', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type jasonos.alert_category as enum ('error', 'reply', 'opportunity', 'deadline');
exception when duplicate_object then null; end $$;

do $$ begin
  create type jasonos.alert_severity as enum ('info', 'warn', 'critical');
exception when duplicate_object then null; end $$;

-- =========================================================================
-- Companies
-- =========================================================================
create table if not exists jasonos.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  hubspot_id text,
  vip boolean not null default false,
  tracks jasonos.track[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- Contacts
-- =========================================================================
create table if not exists jasonos.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emails text[] not null default '{}',
  linkedin_url text,
  title text,
  company_id uuid references jasonos.companies(id) on delete set null,
  vip boolean not null default false,
  tracks jasonos.track[] not null default '{}',
  source_ids jsonb not null default '{}'::jsonb,
  last_touch_date date,
  last_touch_channel text,
  objective_result text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_contacts_vip on jasonos.contacts (vip) where vip = true;
create index if not exists idx_contacts_last_touch on jasonos.contacts (last_touch_date);

-- =========================================================================
-- Projects (initiatives)
-- =========================================================================
create table if not exists jasonos.projects (
  id uuid primary key default gen_random_uuid(),
  track jasonos.track not null,
  name text not null,
  goal_statement text,
  success_criteria text[] not null default '{}',
  status jasonos.project_status not null default 'active',
  source text,
  conversation_id uuid,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_projects_track_status on jasonos.projects (track, status);

-- =========================================================================
-- To-Dos
-- =========================================================================
create table if not exists jasonos.todos (
  id uuid primary key default gen_random_uuid(),
  track jasonos.track not null,
  project_id uuid references jasonos.projects(id) on delete set null,
  title text not null,
  notes text,
  tags text[] not null default '{}',
  due_date date,
  source_card_id uuid,
  source_type text,
  state jasonos.todo_state not null default 'open',
  completion_note text,
  external_push jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_todos_track_state on jasonos.todos (track, state);
create index if not exists idx_todos_project on jasonos.todos (project_id);
create index if not exists idx_todos_due on jasonos.todos (due_date) where state = 'open';

-- =========================================================================
-- Cards
-- =========================================================================
create table if not exists jasonos.cards (
  id uuid primary key default gen_random_uuid(),
  track jasonos.track not null,
  module text not null,
  object_type text not null,
  title text not null,
  subtitle text,
  body jsonb,
  linked_object_ids jsonb not null default '{}'::jsonb,
  priority_score real,
  state jasonos.card_state not null default 'open',
  vip boolean not null default false,
  why_now text,
  verbs text[] not null default '{}',
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  actioned_at timestamptz
);
create index if not exists idx_cards_track_state on jasonos.cards (track, state);
create index if not exists idx_cards_priority_open on jasonos.cards (priority_score desc) where state = 'open';
create index if not exists idx_cards_snoozed on jasonos.cards (snoozed_until) where state = 'snoozed';

create table if not exists jasonos.card_state_history (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references jasonos.cards(id) on delete cascade,
  state jasonos.card_state not null,
  reason text,
  "timestamp" timestamptz not null default now()
);
create index if not exists idx_card_state_history_card on jasonos.card_state_history (card_id);

-- =========================================================================
-- Dispositions (training data for personalization)
-- =========================================================================
create table if not exists jasonos.dispositions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid,
  todo_id uuid,
  contact_id uuid,
  action text not null,
  reason_code text,
  reason_note text,
  "timestamp" timestamptz not null default now()
);
create index if not exists idx_dispositions_ts on jasonos.dispositions ("timestamp" desc);

-- =========================================================================
-- Alerts
-- =========================================================================
create table if not exists jasonos.alerts (
  id uuid primary key default gen_random_uuid(),
  category jasonos.alert_category not null,
  severity jasonos.alert_severity not null default 'info',
  source text,
  title text not null,
  body text,
  linked_card_id uuid references jasonos.cards(id) on delete set null,
  state text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_alerts_state_severity on jasonos.alerts (state, severity);

-- =========================================================================
-- Best Next Action runs
-- =========================================================================
create table if not exists jasonos.bna_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  items jsonb,
  user_edits jsonb not null default '{}'::jsonb,
  model_used text,
  input_snapshot jsonb
);
create index if not exists idx_bna_runs_at on jasonos.bna_runs (run_at desc);

-- =========================================================================
-- Weekly self-review
-- =========================================================================
create table if not exists jasonos.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  content jsonb,
  user_reflection text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- updated_at triggers
-- =========================================================================
create or replace function jasonos.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in select unnest(array['companies','contacts','projects','todos','cards']) loop
    execute format(
      'drop trigger if exists set_updated_at on jasonos.%I;
       create trigger set_updated_at before update on jasonos.%I
         for each row execute function jasonos.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- =========================================================================
-- Row Level Security (placeholders for v1 single-user; tighten in v2)
-- =========================================================================
alter table jasonos.companies          enable row level security;
alter table jasonos.contacts           enable row level security;
alter table jasonos.projects           enable row level security;
alter table jasonos.todos              enable row level security;
alter table jasonos.cards              enable row level security;
alter table jasonos.card_state_history enable row level security;
alter table jasonos.dispositions       enable row level security;
alter table jasonos.alerts             enable row level security;
alter table jasonos.bna_runs           enable row level security;
alter table jasonos.weekly_reviews     enable row level security;

-- v1 single-user policy: any authenticated user OR the service role can read/write.
-- Replace with per-user policies once auth is added.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'companies','contacts','projects','todos','cards','card_state_history',
    'dispositions','alerts','bna_runs','weekly_reviews'
  ]) loop
    execute format(
      'drop policy if exists "v1 allow all to authenticated" on jasonos.%I;
       create policy "v1 allow all to authenticated" on jasonos.%I
         for all to authenticated
         using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- =========================================================================
-- Grants for PostgREST roles (anon / authenticated / service_role)
-- =========================================================================
grant usage on schema jasonos to anon, authenticated, service_role;
grant all on all tables    in schema jasonos to anon, authenticated, service_role;
grant all on all sequences in schema jasonos to anon, authenticated, service_role;
grant all on all functions in schema jasonos to anon, authenticated, service_role;

alter default privileges in schema jasonos
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema jasonos
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema jasonos
  grant all on functions to anon, authenticated, service_role;
