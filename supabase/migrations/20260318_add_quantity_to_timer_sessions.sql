-- Add quantity column to timer_sessions so multi-unit KPI completions
-- (e.g. "5 warm reconnects in one session") persist accurately.
-- Default is 1 to maintain backward compatibility with existing rows.

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN timer_sessions.quantity IS
  'Number of KPI units completed in this session (e.g. 5 outreach messages). Defaults to 1.';
