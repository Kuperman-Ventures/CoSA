-- Enrich existing reconnect/recruiter card bodies with full source data.
-- Idempotent: re-running refreshes the body fields from public.rr_recruiters.

UPDATE jasonos.cards c
SET body = jsonb_strip_nulls(
  COALESCE(c.body, '{}'::jsonb) || jsonb_build_object(
    'firm',                          rr.firm,
    'firm_normalized',               rr.firm_normalized,
    'specialty',                     rr.specialty,
    'last_contact_date',             rr.last_contact_date,
    'prior_communication',           rr.prior_communication,
    'linkedin_url',                  rr.linkedin_url,
    'hubspot_url',                   rr.hubspot_url,
    'strategic_score',               rr.strategic_score,
    'firm_fit_score',                rr.firm_fit_score,
    'practice_match_score',          rr.practice_match_score,
    'recency_score',                 rr.recency_score,
    'signal_score',                  rr.signal_score,
    'strategic_priority',            rr.strategic_priority,
    'outlook_history',               rr.outlook_history,
    'other_contacts_at_firm',        rr.other_contacts_at_firm,
    'source',                        rr.source
  )
)
FROM public.rr_recruiters rr
WHERE c.module = 'reconnect'
  AND c.object_type = 'recruiter'
  AND c.linked_object_ids->>'recruiter_pipeline_id' = rr.id::text;

CREATE OR REPLACE FUNCTION jasonos.next_untriaged_reconnect_card(
  track_filter jasonos.track DEFAULT NULL
)
RETURNS TABLE(
  card_id uuid,
  contact_id uuid,
  title text,
  subtitle text,
  body jsonb,
  priority_score real,
  contact_name text,
  contact_title text,
  contact_tags text[],
  contact_track jasonos.track,
  current_intent text,
  current_goal text,
  days_since_contact int,
  remaining_count int
)
LANGUAGE sql STABLE
AS $$
  WITH untriaged AS (
    SELECT
      c.id              AS card_id,
      ct.id             AS contact_id,
      c.title,
      c.subtitle,
      c.body,
      c.priority_score,
      ct.name           AS contact_name,
      ct.title          AS contact_title,
      ct.tags           AS contact_tags,
      c.track           AS contact_track,
      ct.intent         AS current_intent,
      ct.personal_goal  AS current_goal,
      CASE
        WHEN ct.last_touch_date IS NULL THEN NULL
        ELSE (CURRENT_DATE - ct.last_touch_date)::int
      END               AS days_since_contact
    FROM jasonos.cards c
    JOIN jasonos.contacts ct
      ON ct.id::text = c.linked_object_ids->>'contact_id'
    WHERE c.module = 'reconnect'
      AND c.state = 'open'
      AND ct.intent IS NULL
      AND (track_filter IS NULL OR c.track = track_filter)
  )
  SELECT
    u.*,
    (SELECT COUNT(*) FROM untriaged)::int AS remaining_count
  FROM untriaged u
  ORDER BY u.priority_score DESC NULLS LAST, u.contact_name ASC
  LIMIT 1;
$$;
