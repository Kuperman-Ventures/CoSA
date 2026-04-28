-- Pin-to-today support. pinned_at is a timestamp; queries filter to TODAY in
-- the user's local time. Setting to NULL unpins.
ALTER TABLE jasonos.cards
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS cards_pinned_at_idx ON jasonos.cards (pinned_at)
  WHERE pinned_at IS NOT NULL;

COMMENT ON COLUMN jasonos.cards.pinned_at IS
  'Timestamp when card was pinned to "today". Cards remain pinned across days but UI filters to pinned_at::date = current_date for the home Pinned Today section. NULL = not pinned.';
