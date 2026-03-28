-- Store subtask checkbox state in user_preferences so it syncs across devices.
-- Structure: { [todayTaskId]: { [checkKey]: boolean } }
-- checkKey is either a subtaskId (plain subtask) or "subtaskId:itemId" (nested item).

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS subtask_checks JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_preferences.subtask_checks IS
  'Subtask and nested-item checkbox state per today-task instance. Keys are taskId → { subtaskId: bool } or { "subtaskId:itemId": bool }.';
