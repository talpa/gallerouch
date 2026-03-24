-- Migration: Add payment settings for QR code generation
-- Adds settings as key-value pairs for dynamic payment descriptions and QR code generation

INSERT INTO settings (key, value, description) VALUES
  ('payment_description_template', '%s zakoupen v %s', 'Template for payment description. Use %s for placeholders. Example: "%s zakoupen v %s" where first %s = artwork.title, second %s = gallery_name'),
  ('allow_payment_text_edit', 'true', 'Allow admin to edit payment description template'),
  ('payment_variability_symbol_format', 'artwork_id', 'Format for variable symbol: artwork_id, order_id, etc.')
ON CONFLICT (key) DO NOTHING;
