-- ============================================================
-- Vyčistit DB – ponechat jen admina (id=1) a číselníky
-- Číselníky: settings, artwork_types
-- ============================================================

BEGIN;

-- 1. Artworks – CASCADE odstraní:
--    events, artwork_events, artwork_images, payments, price_offers
DELETE FROM artworks;

-- 2. Author bio – smazat i adminův profil (není číselník)
DELETE FROM author_bio;

-- 3. Smazat uživatele kromě admina
--    CASCADE odstraní user_artwork_types pro ně
DELETE FROM users WHERE id != 1;

-- 4. Obnovit schválené typy děl pro admina (gallery owner)
DELETE FROM user_artwork_types WHERE user_id = 1;
INSERT INTO user_artwork_types (user_id, artwork_type_id, approved, approved_by, approved_at)
SELECT 1, id, true, 1, NOW() FROM artwork_types;

-- 5. Resetovat sekvence
ALTER SEQUENCE artworks_id_seq RESTART WITH 1;
ALTER SEQUENCE artwork_events_id_seq RESTART WITH 1;
ALTER SEQUENCE events_id_seq RESTART WITH 1;
ALTER SEQUENCE artwork_images_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_id_seq RESTART WITH 1;
ALTER SEQUENCE price_offers_id_seq RESTART WITH 1;
ALTER SEQUENCE author_bio_id_seq RESTART WITH 1;
ALTER SEQUENCE user_artwork_types_id_seq RESTART WITH 1;

-- users: admin je id=1, další uživatelé začínají od 2
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));

COMMIT;

-- Ověření výsledku
SELECT 'users' AS tabulka, COUNT(*) AS pocet FROM users
UNION ALL
SELECT 'artworks', COUNT(*) FROM artworks
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'artwork_events', COUNT(*) FROM artwork_events
UNION ALL
SELECT 'artwork_images', COUNT(*) FROM artwork_images
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'price_offers', COUNT(*) FROM price_offers
UNION ALL
SELECT 'author_bio', COUNT(*) FROM author_bio
UNION ALL
SELECT 'user_artwork_types (admin)', COUNT(*) FROM user_artwork_types WHERE user_id = 1
UNION ALL
SELECT 'artwork_types (číselník)', COUNT(*) FROM artwork_types
UNION ALL
SELECT 'settings (číselník)', COUNT(*) FROM settings
ORDER BY tabulka;
