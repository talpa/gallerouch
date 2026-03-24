-- Add variable symbol for payment matching
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS variable_symbol VARCHAR(10) UNIQUE;

-- Add index for faster lookups by variable symbol
CREATE INDEX IF NOT EXISTS idx_payments_variable_symbol ON payments(variable_symbol);

-- Add Fio transaction tracking columns
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS fio_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS fio_matched_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS fio_amount_matched DECIMAL(10, 2);

-- Add index for Fio matching
CREATE INDEX IF NOT EXISTS idx_payments_fio_transaction_id ON payments(fio_transaction_id);

-- Comment for documentation
COMMENT ON COLUMN payments.variable_symbol IS 'Unique variable symbol for bank transfer matching (1-10 digits)';
COMMENT ON COLUMN payments.fio_transaction_id IS 'Fio Bank API transaction ID when matched';
COMMENT ON COLUMN payments.fio_matched_at IS 'Timestamp when payment was matched via Fio API';
COMMENT ON COLUMN payments.fio_amount_matched IS 'Actual amount received from Fio Bank';
