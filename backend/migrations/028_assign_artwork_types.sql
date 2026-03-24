-- Assign artwork types to existing artworks
-- This ensures artworks have associated types for author lookup

-- Assign random artwork types to artworks (for seed data)
-- If artwork has no type, assign based on title pattern
UPDATE artworks SET artwork_type_id = 1 WHERE title ILIKE '%obraz%' AND artwork_type_id IS NULL;
UPDATE artworks SET artwork_type_id = 2 WHERE title ILIKE '%socha%' AND artwork_type_id IS NULL;
UPDATE artworks SET artwork_type_id = 5 WHERE title ILIKE '%foto%' AND artwork_type_id IS NULL;
UPDATE artworks SET artwork_type_id = 4 WHERE title ILIKE '%grafika%' AND artwork_type_id IS NULL;

-- For remaining artworks without a type, assign type 1 (Obraz) as default
UPDATE artworks SET artwork_type_id = 1 WHERE artwork_type_id IS NULL;
