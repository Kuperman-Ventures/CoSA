-- Expand allowed track values to match App.jsx TRACKS (cosaAdmin, development).
-- Without this, upsertTaskTemplates fails silently in the browser console when
-- users pick Administration or Development — then the next loadTaskTemplates
-- overwrites local edits with the previous track from the database.

ALTER TABLE public.task_templates
  DROP CONSTRAINT IF EXISTS task_templates_track_check;

ALTER TABLE public.task_templates
  ADD CONSTRAINT task_templates_track_check
  CHECK (track IN (
    'advisors',
    'jobSearch',
    'ventures',
    'networking',
    'development',
    'cosaAdmin'
  ));

ALTER TABLE public.today_task_instances
  DROP CONSTRAINT IF EXISTS today_task_instances_track_snapshot_check;

ALTER TABLE public.today_task_instances
  ADD CONSTRAINT today_task_instances_track_snapshot_check
  CHECK (track_snapshot IN (
    'advisors',
    'jobSearch',
    'ventures',
    'networking',
    'development',
    'cosaAdmin'
  ));
