-- Add sub_track to timer_sessions so completion log entries carry the full
-- track + sub-track attribution needed for Weekly Review sub-track breakdowns
-- and for driving the WeekPlanner HealthBars from actual worked time.

ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS sub_track text NOT NULL DEFAULT '';

COMMENT ON COLUMN timer_sessions.sub_track IS
  'Sub-track key (e.g. "Networking & BD", "Alpha") matching the event''s cosaSubTrack. Empty string when not set.';
