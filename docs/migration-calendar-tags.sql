-- Migration: calendar_event_tags table
-- Run this in the Supabase SQL Editor before using the personal calendar
-- track/sub-track assignment feature.
--
-- This table stores user-assigned Track and Sub-track for personal Google
-- Calendar events so that allocations persist across sessions.

CREATE TABLE IF NOT EXISTS public.calendar_event_tags (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gcal_event_id   text NOT NULL,
  track           text NOT NULL,
  sub_track       text,
  event_title     text,
  duration_min    integer,
  event_date      date,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE (user_id, gcal_event_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS calendar_event_tags_user_id_idx
  ON public.calendar_event_tags (user_id);

-- Row-Level Security: users can only see and modify their own rows
ALTER TABLE public.calendar_event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own calendar event tags"
  ON public.calendar_event_tags
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional: KPI credits when tagging (see also [20260321_calendar_event_tags_kpi_credits.sql](../supabase/migrations/20260321_calendar_event_tags_kpi_credits.sql))
-- ALTER TABLE public.calendar_event_tags ADD COLUMN kpi_credits text[] NOT NULL DEFAULT ARRAY[]::text[];
-- ALTER TABLE public.calendar_event_tags ADD COLUMN kpi_quantities jsonb NOT NULL DEFAULT '{}'::jsonb;
