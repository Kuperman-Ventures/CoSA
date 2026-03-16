-- Archive All Non-Spreadsheet Tasks from Task Library
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times — only rows not already Archived are affected.
--
-- Tasks KEPT (31 lib-v2 + 2 marc temp + 4 friday = 37 total):
--   Kuperman Advisors  : lib-v2-advisors-1 through lib-v2-advisors-13
--   Job Search         : lib-v2-jobsearch-1 through lib-v2-jobsearch-11
--   Kuperman Ventures  : lib-v2-ventures-1 through lib-v2-ventures-7
--   Marc Whitman (temp): lib-ventures-marc-prep-20260315, lib-ventures-marc-debrief-20260315
--   Friday Review      : lib-friday-1 through lib-friday-4
--
-- Everything else (old lib-advisors, lib-networking, lib-jobsearch, lib-ventures)
-- is set to Archived.

UPDATE task_templates
SET status = 'Archived'
WHERE id NOT IN (
  -- Kuperman Advisors v2
  'lib-v2-advisors-1','lib-v2-advisors-2','lib-v2-advisors-3',
  'lib-v2-advisors-4','lib-v2-advisors-5','lib-v2-advisors-6',
  'lib-v2-advisors-7','lib-v2-advisors-8','lib-v2-advisors-9',
  'lib-v2-advisors-10','lib-v2-advisors-11','lib-v2-advisors-12',
  'lib-v2-advisors-13',
  -- Job Search v2
  'lib-v2-jobsearch-1','lib-v2-jobsearch-2','lib-v2-jobsearch-3',
  'lib-v2-jobsearch-4','lib-v2-jobsearch-5','lib-v2-jobsearch-6',
  'lib-v2-jobsearch-7','lib-v2-jobsearch-8','lib-v2-jobsearch-9',
  'lib-v2-jobsearch-10','lib-v2-jobsearch-11',
  -- Kuperman Ventures v2
  'lib-v2-ventures-1','lib-v2-ventures-2','lib-v2-ventures-3',
  'lib-v2-ventures-4','lib-v2-ventures-5','lib-v2-ventures-6',
  'lib-v2-ventures-7',
  -- Marc Whitman temporary tasks
  'lib-ventures-marc-prep-20260315',
  'lib-ventures-marc-debrief-20260315',
  -- Friday Review
  'lib-friday-1','lib-friday-2','lib-friday-3','lib-friday-4'
);

-- Verify the result — expected output:
--   Active/Paused rows : 37
--   Archived rows      : all others (old lib-advisors-*, lib-networking-*, lib-jobsearch-*, lib-ventures-1 through lib-ventures-4)
SELECT status, count(*) FROM task_templates GROUP BY status ORDER BY status;

-- Also ensure the two Paused advisors are correctly set:
UPDATE task_templates SET status = 'Paused'
  WHERE id IN ('lib-v2-advisors-11','lib-v2-advisors-12')
    AND status != 'Archived';
