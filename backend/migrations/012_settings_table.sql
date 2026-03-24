-- Tabulka pro konfigurační parametry aplikace
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Základní konfigurační hodnoty
INSERT INTO settings (key, value, description) VALUES
  ('gallery_bank_account', '123456789/0100', 'Číslo bankovního účtu galerie pro platby za umělecká díla'),
  ('gallery_name', 'Gallerouch', 'Název galerie'),
  ('gallery_email', 'info@gallerouch.cz', 'Kontaktní email galerie'),
  ('gallery_phone', '+420 123 456 789', 'Kontaktní telefon galerie'),
  ('vat_rate', '21', 'Sazba DPH v procentech'),
  ('currency', 'CZK', 'Měna používaná v galerii'),
  ('min_order_amount', '0', 'Minimální částka objednávky'),
  ('shipping_enabled', 'true', 'Povolit dopravu objednávek'),
  ('payment_gateway_enabled', 'false', 'Povolit platební bránu'),
  ('registration_enabled', 'true', 'Povolit registraci nových uživatelů')
ON CONFLICT (key) DO NOTHING;

-- Trigger pro automatickou aktualizaci updated_at
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at_trigger
BEFORE UPDATE ON settings
FOR EACH ROW
EXECUTE FUNCTION update_settings_updated_at();
