-- 0006 — Dispatch async bridge
-- Public bridge table intentionally lives outside the jasonos schema so the
-- external Dispatch worker can poll and write responses with a service role.

create table if not exists public.dispatch_requests (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  request_type text not null,
  context jsonb not null default '{}'::jsonb,
  response text,
  response_metadata jsonb,
  source_page text,
  created_at timestamptz default now(),
  completed_at timestamptz,
  viewed_at timestamptz
);

create index if not exists idx_dispatch_requests_owner_status
  on public.dispatch_requests(owner_id, status);
create index if not exists idx_dispatch_requests_created
  on public.dispatch_requests(created_at desc);

alter table public.dispatch_requests enable row level security;

drop policy if exists "Users can view own" on public.dispatch_requests;
create policy "Users can view own" on public.dispatch_requests
  for select using (auth.uid() = owner_id);

drop policy if exists "Users can create own" on public.dispatch_requests;
create policy "Users can create own" on public.dispatch_requests
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update own" on public.dispatch_requests;
create policy "Users can update own" on public.dispatch_requests
  for update using (auth.uid() = owner_id);

grant all on public.dispatch_requests to anon, authenticated, service_role;
