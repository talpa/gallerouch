-- Seed data for user_artwork_types (assign artwork types to users as authors)
-- This creates author-type associations with approvals

-- Clear existing data
TRUNCATE user_artwork_types RESTART IDENTITY;

-- Admin (user_id=1) - approve all types as gallery owner
INSERT INTO user_artwork_types (user_id, artwork_type_id, approved, approved_by, approved_at) 
SELECT 1, id, true, 1, NOW() FROM artwork_types;

-- Petr (user_id=3) - artist specializing in paintings and photography
INSERT INTO user_artwork_types (user_id, artwork_type_id, approved, approved_by, approved_at) VALUES
  (3, 1, true, 1, NOW()),   -- Obraz
  (3, 5, true, 1, NOW()),   -- Fotografie
  (3, 4, true, 1, NOW()),   -- Grafika
  (3, 7, true, 1, NOW()),   -- Video
  (3, 8, true, 1, NOW()),   -- Animace
  (3, 2, false, NULL, NULL), -- Socha (pending approval)
  (3, 6, false, NULL, NULL); -- Instalace (pending approval)

-- Jana (user_id=2) - if exists, artist specializing in design and textile
INSERT INTO user_artwork_types (user_id, artwork_type_id, approved, approved_by, approved_at) 
SELECT 2, 9, true, 1, NOW() WHERE EXISTS (SELECT 1 FROM users WHERE id = 2);  -- Design

INSERT INTO user_artwork_types (user_id, artwork_type_id, approved, approved_by, approved_at) 
SELECT 2, 10, true, 1, NOW() WHERE EXISTS (SELECT 1 FROM users WHERE id = 2);  -- Textil
