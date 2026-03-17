-- Phase 4: Simplify Task Library
-- Drops deprecated columns from task_templates and today_task_instances,
-- and removes the weekly_plans and reschedule_queue tables.
--
-- Run this against your Supabase project via the SQL editor or CLI.
-- Review RLS policies after applying if any referenced dropped columns.

BEGIN;

-- ─── task_templates ───────────────────────────────────────────────────────────
ALTER TABLE task_templates
  DROP COLUMN IF EXISTS frequency,
  DROP COLUMN IF EXISTS days_of_week,
  DROP COLUMN IF EXISTS completion_type,
  DROP COLUMN IF EXISTS requires_definition_of_done,
  DROP COLUMN IF EXISTS subtasks,
  DROP COLUMN IF EXISTS outcome_prompt,
  DROP COLUMN IF EXISTS time_block;

-- ─── today_task_instances ─────────────────────────────────────────────────────
ALTER TABLE today_task_instances
  DROP COLUMN IF EXISTS frequency_snapshot,
  DROP COLUMN IF EXISTS completion_type_snapshot,
  DROP COLUMN IF EXISTS requires_definition_of_done,
  DROP COLUMN IF EXISTS subtasks_snapshot,
  DROP COLUMN IF EXISTS outcome_prompt_snapshot,
  DROP COLUMN IF EXISTS time_block_snapshot;

-- ─── Drop legacy tables ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS weekly_plans CASCADE;
DROP TABLE IF EXISTS reschedule_queue CASCADE;

COMMIT;
