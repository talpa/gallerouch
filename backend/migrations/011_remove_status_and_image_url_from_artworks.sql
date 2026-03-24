-- Remove status and image_url columns from artworks table
-- Status is now computed from events table
-- Image URL is now stored in artwork_images table
ALTER TABLE artworks 
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS image_url;
