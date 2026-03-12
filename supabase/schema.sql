-- CoSA (Chief of Staff App)
-- Phase 1 schema: Today tasks + timer sessions

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  track text not null check (track in ('advisors', 'jobSearch', 'ventures')),
  time_block text not null check (time_block in ('BD', 'Networking', 'Job Search', 'Encore OS')),
  estimate_minutes integer not null check (estimate_minutes > 0),
  completion_type text not null check (completion_type in ('Done', 'Done + Outcome')),
  requires_definition_of_done boolean not null default false,
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.today_task_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_template_id uuid references public.task_templates (id) on delete set null,
  name_snapshot text not null,
  track_snapshot text not null,
  time_block_snapshot text not null,
  estimate_minutes_snapshot integer not null check (estimate_minutes_snapshot > 0),
  completion_type_snapshot text not null,
  requires_definition_snapshot boolean not null default false,
  scheduled_for_date date not null default current_date,
  queue_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  today_task_instance_id uuid not null references public.today_task_instances (id) on delete cascade,
  timer_state text not null check (timer_state in ('Not Started', 'Running', 'Paused', 'Completed', 'Cancelled', 'Overrun')),
  estimate_seconds integer not null,
  elapsed_seconds integer not null default 0,
  pause_count integer not null default 0,
  pause_duration_seconds integer not null default 0,
  cancelled_seconds integer not null default 0,
  overrun_seconds integer not null default 0,
  time_saved_seconds integer not null default 0,
  definition_of_done text,
  actual_completed text,
  outcome_achieved boolean,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.task_templates enable row level security;
alter table public.today_task_instances enable row level security;
alter table public.timer_sessions enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "task_templates_own_all"
  on public.task_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "today_instances_own_all"
  on public.today_task_instances for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "timer_sessions_own_all"
  on public.timer_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
