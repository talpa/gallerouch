-- Migration 023: Add author_id to artworks table
-- Separates author (who created) from owner (who currently owns)

-- Add author_id column, defaulting to current user_id
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Backfill author_id with current user_id for all existing artworks
UPDATE artworks SET author_id = user_id WHERE author_id IS NULL;

-- Make author_id non-null after backfill
ALTER TABLE artworks ALTER COLUMN author_id SET NOT NULL;

-- Add comment explaining the difference
COMMENT ON COLUMN artworks.author_id IS 'ID of the user who created the artwork (never changes)';
COMMENT ON COLUMN artworks.user_id IS 'ID of the current owner of the artwork (changes on sale)';
