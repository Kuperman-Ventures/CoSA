-- Quick Log entries are inserted directly into timer_sessions without an
-- associated today_task_instance (task_instance_id is null for quick logs).
-- The original schema declared this column NOT NULL, which causes every
-- Quick Log timer_session insert to fail silently — the quick_log_entries
-- row saves fine (so the entry appears in the panel) but the timer_sessions
-- row never lands, so KPIs and time totals never count the activity.
--
-- Fix: allow task_instance_id to be NULL so quick log rows can be inserted.

ALTER TABLE public.timer_sessions
  ALTER COLUMN task_instance_id DROP NOT NULL;
