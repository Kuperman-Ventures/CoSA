-- Quick Log timer_sessions were silently failing to insert because
-- task_instance_id had a NOT NULL constraint (quick logs have no associated
-- task instance). The fix (make_task_instance_id_nullable) corrects future
-- inserts, but all historical Quick Log activity exists only in
-- quick_log_entries. This migration backfills the missing timer_sessions rows
-- so that Weekly Review time bars and KPI totals reflect all past Quick Logs.
--
-- Run AFTER 20260324_make_task_instance_id_nullable.sql has been applied.
--
-- Safety: the WHERE NOT EXISTS clause prevents duplicates — it only creates a
-- timer_session for a given (user, kpi_mapping, logged_at±60s) combination if
-- one does not already exist, so re-running this script is idempotent.

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
  gen_random_uuid()                                      AS id,
  ql.user_id                                             AS user_id,
  NULL                                                   AS task_instance_id,
  ('Quick Log: ' || ql.activity_type || ' with ' || ql.who) AS task_name,
  COALESCE(ql.track, 'networking')                       AS track,
  ql.sub_track                                           AS sub_track,
  kpi_credit                                             AS kpi_mapping,
  1                                                      AS quantity,
  'Completed'                                            AS timer_state,
  'Done'                                                 AS completion_type,
  (ql.duration_minutes * 60)                             AS estimate_seconds,
  (ql.duration_minutes * 60)                             AS elapsed_seconds,
  0                                                      AS pause_count,
  0                                                      AS pause_duration_seconds,
  0                                                      AS overrun_seconds,
  0                                                      AS cancelled_seconds,
  true                                                   AS outcome_achieved,
  ''                                                     AS definition_of_done,
  ''                                                     AS actual_completed,
  NULL                                                   AS started_at,
  ql.logged_at                                           AS completed_at,
  ql.logged_at                                           AS updated_at,
  true                                                   AS is_quick_log,
  ql.note                                                AS notes

FROM quick_log_entries ql
CROSS JOIN LATERAL unnest(ql.kpi_credits) AS kpi_credit

WHERE
  -- Per-KPI safety check: only insert if this exact (user, kpi, timestamp) combo
  -- is not already in timer_sessions (idempotent re-runs, post-migration entries).
  NOT EXISTS (
    SELECT 1
    FROM timer_sessions ts
    WHERE ts.user_id    = ql.user_id
      AND ts.is_quick_log = true
      AND ts.kpi_mapping  = kpi_credit
      AND ts.completed_at >= (ql.logged_at - INTERVAL '60 seconds')
      AND ts.completed_at <= (ql.logged_at + INTERVAL '60 seconds')
  );
