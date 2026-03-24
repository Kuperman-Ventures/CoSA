-- Add track and sub_track to quick_log_entries so Quick Logs carry full
-- track attribution for display in the Weekly Review and Reconcile Log.

ALTER TABLE public.quick_log_entries
  ADD COLUMN IF NOT EXISTS track text;

ALTER TABLE public.quick_log_entries
  ADD COLUMN IF NOT EXISTS sub_track text;
