-- Store dismissed calendar item keys in user_preferences so they sync
-- across devices. Without this column the dismissal list lived only in
-- localStorage and was lost on sign-in from a new machine.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS dismissed_calendar_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_preferences.dismissed_calendar_keys IS
  'Array of "dayLabel|normTitle" keys for calendar items the user has permanently dismissed in the Weekly Review reconcile modal.';
