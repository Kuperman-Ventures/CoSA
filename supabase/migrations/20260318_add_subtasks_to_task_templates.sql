-- Re-add subtasks JSONB column to task_templates.
-- This column was dropped in the Phase 4 simplification migration but the
-- subtask feature was kept in the UI, causing subtasks to be silently lost
-- on every Supabase sync. Default to an empty array for existing rows.

ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;
