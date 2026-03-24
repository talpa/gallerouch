-- Ensure only one primary image per artwork
-- First fix any existing duplicates (already done manually, but this ensures it on fresh install)
WITH ranked_images AS (
  SELECT id, artwork_id, is_primary, 
         ROW_NUMBER() OVER (PARTITION BY artwork_id ORDER BY id) as rn 
  FROM artwork_images 
  WHERE is_primary = true
)
UPDATE artwork_images 
SET is_primary = false 
WHERE id IN (SELECT id FROM ranked_images WHERE rn > 1);

-- Create a unique partial index to prevent multiple primary images per artwork
CREATE UNIQUE INDEX IF NOT EXISTS idx_artwork_images_unique_primary 
ON artwork_images (artwork_id) 
WHERE is_primary = true;
