-- Add is_quick_log and notes columns to timer_sessions.
-- Quick Log entries are inserted directly into timer_sessions via App.jsx (handleQuickLogSubmit).
-- Without these columns the insert includes unknown fields which Supabase silently rejects
-- or errors on depending on PostgREST strict mode.

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS is_quick_log boolean NOT NULL DEFAULT false;

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS notes text;
