-- 0011_rr_touches_sync_dedup.sql
-- Allow rr_touches to be safely re-synced from Gmail/HubSpot without duplicates.
-- Apply via Supabase Dashboard → SQL Editor. Do not use supabase db push.

ALTER TABLE public.rr_touches
  ADD COLUMN IF NOT EXISTS source            text,           -- 'gmail' | 'hubspot' | 'manual'
  ADD COLUMN IF NOT EXISTS external_id       text,           -- Gmail message ID or HubSpot engagement ID
  ADD COLUMN IF NOT EXISTS subject           text,           -- email subject for outbound sync rows
  ADD COLUMN IF NOT EXISTS thread_url        text;           -- launch-in-client URL

CREATE UNIQUE INDEX IF NOT EXISTS rr_touches_source_external_id_uniq
  ON public.rr_touches (source, external_id)
  WHERE source IS NOT NULL AND external_id IS NOT NULL;
