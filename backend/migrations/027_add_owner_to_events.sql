-- Migration 027: Add owner_id to events table to track artwork ownership at time of event

ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Backfill existing events with current artwork owner
UPDATE events e
SET owner_id = a.user_id
FROM artworks a
WHERE e.artwork_id = a.id AND e.owner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_owner_id ON events(owner_id);
