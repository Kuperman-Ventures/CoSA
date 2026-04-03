-- Backfill timer_sessions rows for any quick_log_entries that never made it
-- there (historically failed due to task_instance_id NOT NULL constraint, or
-- failed for any other reason).
--
-- Covers two cases:
--   1. Quick logs WITH kpi_credits  → one timer_sessions row per KPI credit
--   2. Quick logs WITHOUT kpi_credits → one timer_sessions row for the track
--
-- The WHERE NOT EXISTS guard makes this safe to re-run (idempotent).
-- Run this in the Supabase SQL Editor.

-- ── Safety: ensure task_instance_id is nullable (idempotent) ─────────────────
ALTER TABLE public.timer_sessions
  ALTER COLUMN task_instance_id DROP NOT NULL;

-- ── Case 1: quick logs that have KPI credits ──────────────────────────────────
INSERT INTO timer_sessions (
  id, user_id, task_instance_id, task_name, track, sub_track,
  kpi_mapping, quantity, timer_state, completion_type,
  estimate_seconds, elapsed_seconds, pause_count, pause_duration_seconds,
  overrun_seconds, cancelled_seconds, outcome_achieved, definition_of_done,
  actual_completed, started_at, completed_at, updated_at, is_quick_log, notes
)
SELECT
  gen_random_uuid(),
  ql.user_id,
  NULL,
  ('Quick Log: ' || ql.activity_type || ' with ' || ql.who),
  COALESCE(ql.track, 'networking'),
  COALESCE(ql.sub_track, ''),
  kpi_credit,
  1,
  'Completed',
  'Done',
  (ql.duration_minutes * 60),
  (ql.duration_minutes * 60),
  0, 0, 0, 0, true, '', '', NULL,
  ql.logged_at,
  ql.logged_at,
  true,
  ql.note
FROM quick_log_entries ql
CROSS JOIN LATERAL unnest(ql.kpi_credits) AS kpi_credit
WHERE
  array_length(ql.kpi_credits, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM timer_sessions ts
    WHERE ts.user_id      = ql.user_id
      AND ts.is_quick_log = true
      AND ts.kpi_mapping  = kpi_credit
      AND ts.completed_at >= (ql.logged_at - INTERVAL '60 seconds')
      AND ts.completed_at <= (ql.logged_at + INTERVAL '60 seconds')
  );

-- ── Case 2: quick logs with NO kpi_credits (optional-KPI feature) ─────────────
INSERT INTO timer_sessions (
  id, user_id, task_instance_id, task_name, track, sub_track,
  kpi_mapping, quantity, timer_state, completion_type,
  estimate_seconds, elapsed_seconds, pause_count, pause_duration_seconds,
  overrun_seconds, cancelled_seconds, outcome_achieved, definition_of_done,
  actual_completed, started_at, completed_at, updated_at, is_quick_log, notes
)
SELECT
  gen_random_uuid(),
  ql.user_id,
  NULL,
  ('Quick Log: ' || ql.activity_type || ' with ' || ql.who),
  COALESCE(ql.track, 'networking'),
  COALESCE(ql.sub_track, ''),
  NULL,
  1,
  'Completed',
  'Done',
  (ql.duration_minutes * 60),
  (ql.duration_minutes * 60),
  0, 0, 0, 0, true, '', '', NULL,
  ql.logged_at,
  ql.logged_at,
  true,
  ql.note
FROM quick_log_entries ql
WHERE
  (ql.kpi_credits IS NULL OR array_length(ql.kpi_credits, 1) IS NULL OR array_length(ql.kpi_credits, 1) = 0)
  AND NOT EXISTS (
    SELECT 1 FROM timer_sessions ts
    WHERE ts.user_id      = ql.user_id
      AND ts.is_quick_log = true
      AND ts.kpi_mapping  IS NULL
      AND ts.completed_at >= (ql.logged_at - INTERVAL '60 seconds')
      AND ts.completed_at <= (ql.logged_at + INTERVAL '60 seconds')
  );
