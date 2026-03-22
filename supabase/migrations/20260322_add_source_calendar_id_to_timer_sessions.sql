-- Reconciled calendar entries (Weekly Review → completion log) need a
-- source_calendar_id so they can be identified on reload and not treated
-- as plain timer sessions. Without this column the entries were only
-- stored in localStorage and lost when signing in on a new machine.

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS source_calendar_id text;

COMMENT ON COLUMN timer_sessions.source_calendar_id IS
  'Google Calendar event ID for entries created via the Weekly Review calendar reconcile flow.';
