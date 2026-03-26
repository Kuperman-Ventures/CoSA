-- ============================================================
-- APPLY ALL PENDING MIGRATIONS IN ORDER
-- Run this entire script in Supabase SQL Editor.
-- Every statement uses IF NOT EXISTS / IF EXISTS / DROP CONSTRAINT IF EXISTS
-- so it is safe to run even if some migrations were already applied.
-- ============================================================

-- ── 1. timer_sessions: add missing columns ───────────────────────────────────

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS kpi_values JSONB;

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS is_quick_log boolean NOT NULL DEFAULT false;

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS source_calendar_id text;

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS sub_track text NOT NULL DEFAULT '';

-- ── 2. timer_sessions: make task_instance_id nullable (quick log fix) ────────

ALTER TABLE public.timer_sessions
  ALTER COLUMN task_instance_id DROP NOT NULL;

-- ── 3. task_templates: restore subtasks column ───────────────────────────────

ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 4. task_templates + today_task_instances: expand track check constraints ─

ALTER TABLE public.task_templates
  DROP CONSTRAINT IF EXISTS task_templates_track_check;

ALTER TABLE public.task_templates
  ADD CONSTRAINT task_templates_track_check
  CHECK (track IN (
    'advisors', 'jobSearch', 'ventures',
    'networking', 'development', 'cosaAdmin'
  ));

ALTER TABLE public.today_task_instances
  DROP CONSTRAINT IF EXISTS today_task_instances_track_snapshot_check;

ALTER TABLE public.today_task_instances
  ADD CONSTRAINT today_task_instances_track_snapshot_check
  CHECK (track_snapshot IN (
    'advisors', 'jobSearch', 'ventures',
    'networking', 'development', 'cosaAdmin'
  ));

-- ── 5. calendar_event_tags: add kpi_credits and kpi_quantities ───────────────

ALTER TABLE public.calendar_event_tags
  ADD COLUMN IF NOT EXISTS kpi_credits text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS kpi_quantities jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── 6. user_preferences: add dismissed_calendar_keys and allocations ─────────

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS dismissed_calendar_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS allocations jsonb;

-- ── 7. quick_log_entries: add track and sub_track ────────────────────────────

ALTER TABLE public.quick_log_entries
  ADD COLUMN IF NOT EXISTS track text;

ALTER TABLE public.quick_log_entries
  ADD COLUMN IF NOT EXISTS sub_track text;

-- ── 8. BACKFILL: create timer_sessions rows from orphaned quick_log_entries ──
--
-- Every Quick Log wrote to quick_log_entries successfully but its
-- timer_sessions insert failed (task_instance_id NOT NULL violation).
-- This recreates those rows so Weekly Review time bars and KPI totals
-- reflect all historical Quick Log activity.
--
-- One timer_sessions row is created per KPI credit per quick_log_entry.
-- The WHERE NOT EXISTS guard makes this idempotent.

INSERT INTO timer_sessions (
  id,
  user_id,
  task_instance_id,
  task_name,
  track,
  sub_track,
  kpi_mapping,
  quantity,
  timer_state,
  completion_type,
  estimate_seconds,
  elapsed_seconds,
  pause_count,
  pause_duration_seconds,
  overrun_seconds,
  cancelled_seconds,
  outcome_achieved,
  definition_of_done,
  actual_completed,
  started_at,
  completed_at,
  updated_at,
  is_quick_log,
  notes
)
SELECT
  gen_random_uuid()                                          AS id,
  ql.user_id,
  NULL                                                       AS task_instance_id,
  ('Quick Log: ' || ql.activity_type || ' with ' || ql.who) AS task_name,
  COALESCE(ql.track, 'networking')                           AS track,
  COALESCE(ql.sub_track, '')                                 AS sub_track,
  kpi_credit                                                 AS kpi_mapping,
  1                                                          AS quantity,
  'Completed'                                                AS timer_state,
  'Done'                                                     AS completion_type,
  (ql.duration_minutes * 60)                                 AS estimate_seconds,
  (ql.duration_minutes * 60)                                 AS elapsed_seconds,
  0                                                          AS pause_count,
  0                                                          AS pause_duration_seconds,
  0                                                          AS overrun_seconds,
  0                                                          AS cancelled_seconds,
  true                                                       AS outcome_achieved,
  ''                                                         AS definition_of_done,
  ''                                                         AS actual_completed,
  NULL                                                       AS started_at,
  ql.logged_at                                               AS completed_at,
  ql.logged_at                                               AS updated_at,
  true                                                       AS is_quick_log,
  ql.note                                                    AS notes

FROM quick_log_entries ql
CROSS JOIN LATERAL unnest(ql.kpi_credits) AS kpi_credit

WHERE NOT EXISTS (
  SELECT 1
  FROM timer_sessions ts
  WHERE ts.user_id     = ql.user_id
    AND ts.is_quick_log = true
    AND ts.kpi_mapping  = kpi_credit
    AND ts.completed_at >= (ql.logged_at - INTERVAL '60 seconds')
    AND ts.completed_at <= (ql.logged_at + INTERVAL '60 seconds')
);
