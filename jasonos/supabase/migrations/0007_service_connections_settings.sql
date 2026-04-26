-- 0007 — Settings integration management
-- Stores per-user connection state and editable Settings preferences.

create table if not exists public.service_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  status text not null default 'not_configured'
    check (status in ('connected', 'not_configured', 'error', 'expired')),
  connection_type text not null default 'env_var'
    check (connection_type in ('env_var', 'oauth', 'api_key', 'mcp', 'webhook')),
  config jsonb default '{}'::jsonb,
  api_key_masked text,
  connected_at timestamptz,
  last_health_check timestamptz,
  health_status text check (health_status in ('healthy', 'degraded', 'down', 'unknown')),
  health_details text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, service_name)
);

create index if not exists idx_service_connections_user_status
  on public.service_connections(user_id, status);

alter table public.service_connections enable row level security;

drop policy if exists "Users manage own connections" on public.service_connections;
create policy "Users manage own connections" on public.service_connections
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on public.service_connections to anon, authenticated, service_role;

alter table public.user_preferences
  add column if not exists alert_thresholds jsonb default '{
    "site_uptime_check_interval_minutes": 30,
    "email_reply_rate_drop_pct": 20,
    "email_open_rate_drop_pct": 15,
    "site_traffic_drop_pct": 25,
    "trial_to_paid_drop_pct": 10,
    "deal_stage_aging_days": 14,
    "pipeline_reply_wait_days": 7
  }'::jsonb;

alter table public.user_preferences
  add column if not exists model_preferences jsonb default '{
    "best_next_action": "anthropic/claude-opus-4-7",
    "tell_claude_goal_plan": "anthropic/claude-sonnet-4-6"
  }'::jsonb;
