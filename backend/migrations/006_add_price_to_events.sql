-- Add price column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);

-- Add index for approved_at for sorting
CREATE INDEX IF NOT EXISTS idx_events_approved_at ON events(approved_at DESC NULLS LAST);

-- Update artworks table to mark price as deprecated (comment only, no structural change needed)
-- Future: price will come from events table instead of artworks table
