-- Create payments table for purchase transactions
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  artwork_id INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  gallery_commission DECIMAL(10, 2) DEFAULT 0,
  seller_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'unpaid', -- unpaid, paid, cancelled
  payment_method VARCHAR(100),
  transaction_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  confirmed_by INTEGER REFERENCES users(id),
  confirmed_at TIMESTAMP,
  invoice_sent_at TIMESTAMP,
  invoice_number VARCHAR(100),
  UNIQUE(artwork_id, buyer_id, created_at)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_artwork_id ON payments(artwork_id);
CREATE INDEX IF NOT EXISTS idx_payments_buyer_id ON payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller_id ON payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE payments IS 'Stores payment transactions for artwork purchases';
COMMENT ON COLUMN payments.status IS 'Payment status: unpaid (awaiting payment), paid (payment confirmed by admin), cancelled';
COMMENT ON COLUMN payments.gallery_commission IS 'Gallery commission amount calculated from price';
COMMENT ON COLUMN payments.seller_amount IS 'Amount seller receives after commission';
