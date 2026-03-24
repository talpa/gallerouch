-- Migration 009: Add personal data fields and approval system
-- Add personal identification and permanent address
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_number VARCHAR(11);
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_address VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_city VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_postal_code VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Česká republika';

-- Add profile approval system
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_approved_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_approved_by INTEGER REFERENCES users(id);

-- Add index for searching non-approved profiles
CREATE INDEX IF NOT EXISTS idx_users_profile_approved ON users(profile_approved);
