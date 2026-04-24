-- =============================================================================
-- 0005_contacts_tags_and_finalize_tier1.sql
--
-- 1. Adds `tags text[]` to jasonos.contacts so cluster-style classifications
--    ('alumni:tbwa', 'conference:cannes-2024', etc.) have a place to live.
--    Mirrors the existing jasonos.companies.tags column shape exactly.
--
-- 2. Adds jasonos.finalize_tier1(p_picks jsonb) — atomic-ish RPC that the
--    /contacts Tier 1 Ranker calls on Finish. Doing this server-side as a
--    single RPC gives us the transactional guarantees that supabase-js
--    can't expose from the client.
--
-- Apply via: Supabase Dashboard → SQL Editor (or Supabase MCP). Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. contacts.tags column
-- -----------------------------------------------------------------------------

alter table jasonos.contacts
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists contacts_tags_gin_idx
  on jasonos.contacts using gin (tags);


-- -----------------------------------------------------------------------------
-- 2. finalize_tier1(p_picks jsonb) RPC
--
-- Input shape (jsonb array):
--   [
--     {
--       "contact_id": "<uuid>",
--       "rank": 1,
--       "priority_score": 41,
--       "why_now": "TBWA · last touch 412d ago · fit 5/5",
--       "title": "Jane Doe",
--       "subtitle": "VP Brand · TBWA"
--     },
--     ...
--   ]
--
-- Behavior, in one transaction:
--   a) Insert/update jasonos.cards rows for every pick (matched by
--      module='reconnect' AND object_type='tier1_contact' AND
--      linked_object_ids->>'contact_id' = pick.contact_id).
--   b) For any open tier-1 card whose contact_id is NOT in the new picks,
--      flip state to 'dismissed' and append a row to card_state_history
--      with reason 'removed from tier 1 on re-rank'.
--   c) Append one immutable row to jasonos.runner_artifacts capturing the
--      full payload (runner_id='tier1-ranker', task_id='adv-t-tier1',
--      schema_version='v1').
--
-- Returns the count of cards upserted + the count of cards dismissed +
-- the artifact id, so the caller can show a confirmation toast.
-- -----------------------------------------------------------------------------

create or replace function jasonos.finalize_tier1(p_picks jsonb)
returns table (upserted_count int, dismissed_count int, artifact_id uuid)
language plpgsql
security definer
set search_path = jasonos, public
as $$
declare
  v_pick jsonb;
  v_contact_id uuid;
  v_existing_card_id uuid;
  v_pick_contact_ids uuid[] := array(
    select (elem ->> 'contact_id')::uuid
    from jsonb_array_elements(p_picks) elem
  );
  v_upserted int := 0;
  v_dismissed int := 0;
  v_artifact_id uuid;
begin
  -- (a) upsert one card per pick, matched by linked_object_ids->>'contact_id'
  for v_pick in select * from jsonb_array_elements(p_picks)
  loop
    v_contact_id := (v_pick ->> 'contact_id')::uuid;

    select id into v_existing_card_id
    from jasonos.cards
    where module = 'reconnect'
      and object_type = 'tier1_contact'
      and (linked_object_ids ->> 'contact_id')::uuid = v_contact_id
    limit 1;

    if v_existing_card_id is null then
      insert into jasonos.cards (
        track, module, object_type, title, subtitle, body,
        linked_object_ids, priority_score, state, why_now, verbs
      )
      values (
        'advisors',
        'reconnect',
        'tier1_contact',
        coalesce(v_pick ->> 'title', 'Tier 1 contact'),
        v_pick ->> 'subtitle',
        jsonb_build_object(
          'rank', (v_pick ->> 'rank')::int,
          'contact_id', v_contact_id,
          'priority_score', (v_pick ->> 'priority_score')::numeric
        ),
        jsonb_build_object('contact_id', v_contact_id::text),
        (v_pick ->> 'priority_score')::real,
        'open',
        v_pick ->> 'why_now',
        array['message', 'reconnect']
      );
    else
      update jasonos.cards
      set
        priority_score = (v_pick ->> 'priority_score')::real,
        why_now        = v_pick ->> 'why_now',
        title          = coalesce(v_pick ->> 'title', title),
        subtitle       = v_pick ->> 'subtitle',
        body           = jsonb_build_object(
                           'rank', (v_pick ->> 'rank')::int,
                           'contact_id', v_contact_id,
                           'priority_score', (v_pick ->> 'priority_score')::numeric
                         ),
        state          = 'open',
        updated_at     = now(),
        actioned_at    = null
      where id = v_existing_card_id;
    end if;

    v_upserted := v_upserted + 1;
  end loop;

  -- (b) dismiss any open tier-1 cards that fell off this run
  with dropped as (
    update jasonos.cards
    set state = 'dismissed', updated_at = now()
    where module = 'reconnect'
      and object_type = 'tier1_contact'
      and state = 'open'
      and not ((linked_object_ids ->> 'contact_id')::uuid = any(v_pick_contact_ids))
    returning id
  ),
  history as (
    insert into jasonos.card_state_history (card_id, state, reason)
    select d.id, 'dismissed', 'removed from tier 1 on re-rank'
    from dropped d
    returning 1
  )
  select count(*) into v_dismissed from dropped;

  -- (c) append the immutable artifact
  insert into jasonos.runner_artifacts (runner_id, task_id, schema_version, payload)
  values (
    'tier1-ranker',
    'adv-t-tier1',
    'v1',
    jsonb_build_object(
      'generated_at', now(),
      'target_size',  30,
      'actual_size',  jsonb_array_length(p_picks),
      'picks',        p_picks
    )
  )
  returning id into v_artifact_id;

  return query select v_upserted, v_dismissed, v_artifact_id;
end;
$$;

comment on function jasonos.finalize_tier1(jsonb) is
  'Atomically reconciles jasonos.cards with the Tier 1 Reconnect Ranker output and writes a runner_artifacts row. Called by /contacts page server action.';

-- Allow both anon and authenticated to call (single-user RLS convention).
grant execute on function jasonos.finalize_tier1(jsonb) to anon, authenticated, service_role;
