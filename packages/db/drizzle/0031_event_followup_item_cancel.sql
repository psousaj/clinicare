ALTER TABLE followup_items ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
