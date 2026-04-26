-- 0003 — Product Health uptime checks
-- Append-only log of HTTP probes for the Product Health tile cluster.
-- One row per (target, run). Cron prunes rows older than 30 days.

create table if not exists jasonos.health_checks (
  id uuid primary key default gen_random_uuid(),
  target_id text not null,                  -- stable id from lib/monitoring/targets.ts
  url text not null,
  status_code int,                          -- null on network error / timeout
  response_time_ms int,
  ok boolean not null,                      -- 200-class AND under timeout
  error_message text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_health_checks_target_ts
  on jasonos.health_checks (target_id, checked_at desc);
create index if not exists idx_health_checks_ts
  on jasonos.health_checks (checked_at desc);

alter table jasonos.health_checks enable row level security;
drop policy if exists "v1 allow all to authenticated" on jasonos.health_checks;
create policy "v1 allow all to authenticated" on jasonos.health_checks
  for all to authenticated
  using (true) with check (true);

grant all on jasonos.health_checks to anon, authenticated, service_role;

-- Helper view: latest check per target (used by /api/monitoring/health-summary).
create or replace view jasonos.health_checks_latest as
  select distinct on (target_id) *
  from jasonos.health_checks
  order by target_id, checked_at desc;

grant select on jasonos.health_checks_latest to anon, authenticated, service_role;
