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
      ct.personal_goal  AS current_goal
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

CREATE OR REPLACE FUNCTION jasonos.untriaged_reconnect_counts_by_track()
RETURNS TABLE(track jasonos.track, untriaged_count int)
LANGUAGE sql STABLE
AS $$
  SELECT c.track, COUNT(*)::int
  FROM jasonos.cards c
  JOIN jasonos.contacts ct ON ct.id::text = c.linked_object_ids->>'contact_id'
  WHERE c.module = 'reconnect'
    AND c.state = 'open'
    AND ct.intent IS NULL
  GROUP BY c.track;
$$;
