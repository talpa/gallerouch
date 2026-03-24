-- Migration 017: Price offers table
-- Allows buyers to make price offers on artworks with status 'vystaveno'

CREATE TABLE IF NOT EXISTS price_offers (
  id SERIAL PRIMARY KEY,
  artwork_id INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_price DECIMAL(10, 2) NOT NULL,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT price_offers_positive_price CHECK (offered_price > 0)
);

CREATE INDEX idx_price_offers_owner ON price_offers(owner_id);
CREATE INDEX idx_price_offers_buyer ON price_offers(buyer_id);
CREATE INDEX idx_price_offers_artwork ON price_offers(artwork_id);
CREATE INDEX idx_price_offers_status ON price_offers(status);
