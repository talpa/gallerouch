-- Add artwork_images table for multiple images per artwork
CREATE TABLE IF NOT EXISTS artwork_images (
  id SERIAL PRIMARY KEY,
  artwork_id INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  image_url VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_artwork_images_artwork_id ON artwork_images(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_images_is_primary ON artwork_images(artwork_id, is_primary);

-- Migrate existing images from artworks table to artwork_images
INSERT INTO artwork_images (artwork_id, image_url, is_primary, display_order)
SELECT id, image_url, true, 0 FROM artworks WHERE image_url IS NOT NULL;

-- Remove image_url from artworks table (keep it for backward compatibility for now)
-- ALTER TABLE artworks DROP COLUMN image_url; -- Will do this in a future migration if needed
