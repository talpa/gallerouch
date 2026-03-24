-- Přidání konfiguračního klíče pro provizi galerie
INSERT INTO settings (key, value, description) VALUES
  ('gallery_commission_percent', '20', 'Procento provize galerie z ceny prodaného uměleckého díla')
ON CONFLICT (key) DO NOTHING;
