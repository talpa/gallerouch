-- Migration 031: track unread offer status updates for buyers
-- Allows buyer-side notification bubble when offer is accepted/rejected

ALTER TABLE price_offers
ADD COLUMN IF NOT EXISTS buyer_read_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_price_offers_buyer_read_status
ON price_offers(buyer_id, status, buyer_read_at);
