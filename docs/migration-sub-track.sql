-- Week Planner Refactor: add sub_track column to task_templates
-- Run this in the Supabase SQL editor BEFORE deploying the Week Planner update.

-- 1. Add the column (safe to run multiple times)
ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS sub_track text;

-- 2. Populate sub_track for all active lib-v2 tasks

-- Advisors
UPDATE task_templates SET sub_track = 'Business Development'
  WHERE id IN (
    'lib-v2-advisors-1','lib-v2-advisors-2','lib-v2-advisors-3',
    'lib-v2-advisors-4','lib-v2-advisors-5','lib-v2-advisors-10',
    'lib-v2-advisors-11','lib-v2-advisors-12','lib-v2-advisors-13'
  );
UPDATE task_templates SET sub_track = 'Materials'  WHERE id = 'lib-v2-advisors-6';
UPDATE task_templates SET sub_track = 'Content'    WHERE id = 'lib-v2-advisors-7';
UPDATE task_templates SET sub_track = 'Meetings'   WHERE id IN ('lib-v2-advisors-8','lib-v2-advisors-9');

-- Job Search
UPDATE task_templates SET sub_track = 'Networking'
  WHERE id IN ('lib-v2-jobsearch-1','lib-v2-jobsearch-2','lib-v2-jobsearch-3','lib-v2-jobsearch-9');
UPDATE task_templates SET sub_track = 'L&D'          WHERE id = 'lib-v2-jobsearch-4';
UPDATE task_templates SET sub_track = 'Searching'    WHERE id IN ('lib-v2-jobsearch-5','lib-v2-jobsearch-6');
UPDATE task_templates SET sub_track = 'Applications' WHERE id IN ('lib-v2-jobsearch-7','lib-v2-jobsearch-10');
UPDATE task_templates SET sub_track = 'Admin'        WHERE id = 'lib-v2-jobsearch-8';
UPDATE task_templates SET sub_track = 'Boards'       WHERE id = 'lib-v2-jobsearch-11';

-- Ventures
UPDATE task_templates SET sub_track = 'Alpha'        WHERE id = 'lib-v2-ventures-1';
UPDATE task_templates SET sub_track = 'Growth'       WHERE id IN ('lib-v2-ventures-2','lib-v2-ventures-7');
UPDATE task_templates SET sub_track = 'Product'      WHERE id = 'lib-v2-ventures-3';
UPDATE task_templates SET sub_track = 'Research'     WHERE id = 'lib-v2-ventures-4';
UPDATE task_templates SET sub_track = 'Subscription' WHERE id = 'lib-v2-ventures-5';
UPDATE task_templates SET sub_track = 'Build'        WHERE id = 'lib-v2-ventures-6';
