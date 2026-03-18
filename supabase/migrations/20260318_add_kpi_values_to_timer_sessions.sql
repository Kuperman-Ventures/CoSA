-- Add kpi_values column to timer_sessions to store structured per-session KPI data.
-- This replaces the free-text kpi_mapping approach for new sessions while
-- remaining backward-compatible (kpi_mapping is preserved for legacy rows).
ALTER TABLE timer_sessions
  ADD COLUMN IF NOT EXISTS kpi_values JSONB;
