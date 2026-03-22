-- Store weekly allocation targets in user_preferences so they sync
-- across devices. Previously only in localStorage, so targets set on
-- one machine were lost when signing in from another.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS allocations jsonb;

COMMENT ON COLUMN user_preferences.allocations IS
  'Weekly allocation targets per track (minutes) and sub-track (% splits). Mirrors WeekPlanner DEFAULT_ALLOCATIONS shape.';
