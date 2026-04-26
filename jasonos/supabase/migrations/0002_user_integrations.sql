-- 0002 — User OAuth integrations + metric snapshots
-- Adds storage for refresh tokens (Google first) and a generic table for
-- daily metric snapshots so we can render real sparklines for sources that
-- don't expose history (Lemon Squeezy, Instantly, etc.).

create table if not exists jasonos.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,                   -- 'google', 'hubspot', 'instantly', ...
  scopes text[] not null default '{}',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists idx_user_integrations_provider
  on jasonos.user_integrations (provider);

drop trigger if exists set_updated_at on jasonos.user_integrations;
create trigger set_updated_at before update on jasonos.user_integrations
  for each row execute function jasonos.set_updated_at();

alter table jasonos.user_integrations enable row level security;
drop policy if exists "v1 owner read/write" on jasonos.user_integrations;
create policy "v1 owner read/write" on jasonos.user_integrations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists jasonos.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,                 -- e.g. 'instantly.reply_rate', 'lemonsqueezy.mrr'
  value double precision not null,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_metric_snapshots_key_ts
  on jasonos.metric_snapshots (metric_key, captured_at desc);

alter table jasonos.metric_snapshots enable row level security;
drop policy if exists "v1 allow all to authenticated" on jasonos.metric_snapshots;
create policy "v1 allow all to authenticated" on jasonos.metric_snapshots
  for all to authenticated
  using (true) with check (true);

grant all on jasonos.user_integrations to anon, authenticated, service_role;
grant all on jasonos.metric_snapshots  to anon, authenticated, service_role;
