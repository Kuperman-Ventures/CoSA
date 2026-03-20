-- Optional KPI credits on calendar_event_tags (same kpiMapping strings as completion log / KPI_DEFINITIONS).
ALTER TABLE public.calendar_event_tags
  ADD COLUMN IF NOT EXISTS kpi_credits text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS kpi_quantities jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.calendar_event_tags.kpi_credits IS 'KPI_DEFINITIONS.kpiMapping values credited to this tagged event';
COMMENT ON COLUMN public.calendar_event_tags.kpi_quantities IS 'Per–kpiMapping counts, e.g. {"Outreach messages sent": 2}';
