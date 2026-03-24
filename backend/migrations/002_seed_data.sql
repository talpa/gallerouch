-- Seed data for artworks table
INSERT INTO artworks (title, description, image_url, price, status) VALUES
  ('Západ slunce nad mořem', 'Krásný obraz západu slunce s teplými barvami', 'https://picsum.photos/400/300?seed=1', 15000, 'vystaveno'),
  ('Lesní cesta', 'Zelený les s cestou vedoucí do dálky', 'https://picsum.photos/400/300?seed=2', 12000, 'vystaveno'),
  ('Horská krajina', 'Malebné hory s jezery', 'https://picsum.photos/400/300?seed=3', 18000, 'vystaveno'),
  ('Tichá řeka', 'Klidná řeka v ranním světle', 'https://picsum.photos/400/300?seed=4', 9500, 'vystaveno'),
  ('Městská krajina', 'Večerní panorama města', 'https://picsum.photos/400/300?seed=5', 22000, 'zrušeno'),
  ('Podzimní park', 'Park plný barevného listí', 'https://picsum.photos/400/300?seed=6', 11000, 'vystaveno'),
  ('Mořská bouře', 'Dramatické vlny a obloha', 'https://picsum.photos/400/300?seed=7', 16500, 'vystaveno'),
  ('Jarní louka', 'Pole plné květin', 'https://picsum.photos/400/300?seed=8', 8000, 'vystaveno'),
  ('Zimní krajina', 'Zasněžené pole a stromy', 'https://picsum.photos/400/300?seed=9', 13500, 'vystaveno'),
  ('Rybářská loď', 'Stará loď v přístavu', 'https://picsum.photos/400/300?seed=10', 10500, 'vystaveno');

-- Seed data for artwork_events table
INSERT INTO artwork_events (artwork_id, type, date, user_name, status, artwork_name) VALUES
  (1, 'Added', NOW() - INTERVAL '30 days', 'Admin', 'vystaveno', 'Západ slunce nad mořem'),
  (2, 'Added', NOW() - INTERVAL '25 days', 'Admin', 'vystaveno', 'Lesní cesta'),
  (2, 'Exhibited', NOW() - INTERVAL '5 days', 'Jana Nováková', 'vystaveno', 'Lesní cesta'),
  (3, 'Added', NOW() - INTERVAL '20 days', 'Admin', 'vystaveno', 'Horská krajina'),
  (4, 'Added', NOW() - INTERVAL '18 days', 'Admin', 'vystaveno', 'Tichá řeka'),
  (5, 'Added', NOW() - INTERVAL '15 days', 'Admin', 'vystaveno', 'Městská krajina'),
  (5, 'Cancelled', NOW() - INTERVAL '3 days', 'Admin', 'zrušeno', 'Městská krajina'),
  (6, 'Added', NOW() - INTERVAL '12 days', 'Admin', 'vystaveno', 'Podzimní park'),
  (6, 'Exhibited', NOW() - INTERVAL '2 days', 'Petr Svoboda', 'vystaveno', 'Podzimní park'),
  (7, 'Added', NOW() - INTERVAL '10 days', 'Admin', 'vystaveno', 'Mořská bouře'),
  (8, 'Added', NOW() - INTERVAL '8 days', 'Admin', 'vystaveno', 'Jarní louka'),
  (9, 'Added', NOW() - INTERVAL '7 days', 'Admin', 'vystaveno', 'Zimní krajina'),
  (9, 'Exhibited', NOW() - INTERVAL '1 day', 'Marie Dvořáková', 'vystaveno', 'Zimní krajina'),
  (10, 'Added', NOW() - INTERVAL '5 days', 'Admin', 'vystaveno', 'Rybářská loď');
