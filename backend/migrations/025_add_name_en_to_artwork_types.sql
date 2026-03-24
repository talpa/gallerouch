-- Migration 025: Add name_en to artwork_types table

-- Add name_en column for English translations
ALTER TABLE artwork_types 
ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);

-- Update existing types with English translations
UPDATE artwork_types SET name_en = 'Painting' WHERE name = 'Obraz';
UPDATE artwork_types SET name_en = 'Sculpture' WHERE name = 'Socha';
UPDATE artwork_types SET name_en = 'Ceramics' WHERE name = 'Keramika';
UPDATE artwork_types SET name_en = 'Graphic' WHERE name = 'Grafika';
UPDATE artwork_types SET name_en = 'Photography' WHERE name = 'Fotografie';
UPDATE artwork_types SET name_en = 'Installation' WHERE name = 'Instalace';
UPDATE artwork_types SET name_en = 'Video' WHERE name = 'Video';
UPDATE artwork_types SET name_en = 'Animation' WHERE name = 'Animace';
UPDATE artwork_types SET name_en = 'Design' WHERE name = 'Design';
UPDATE artwork_types SET name_en = 'Textile' WHERE name = 'Textil';
UPDATE artwork_types SET name_en = 'Glass' WHERE name = 'Sklo';
UPDATE artwork_types SET name_en = 'Metalwork' WHERE name = 'Kovářství';
UPDATE artwork_types SET name_en = 'Other' WHERE name = 'Jiné';
