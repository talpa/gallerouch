-- Migration 032: Add English bio to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_en TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_en_approved BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_en_approved_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_en_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
