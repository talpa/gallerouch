-- Remove price column from artworks table
-- Price is now exclusively managed through events table

ALTER TABLE artworks DROP COLUMN IF EXISTS price;
