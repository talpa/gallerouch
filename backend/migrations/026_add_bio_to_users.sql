-- Migration 026: Add bio and bio_approved columns to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_approved BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_approved_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
