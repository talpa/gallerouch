-- Migration 004: Add provider column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'manual';

-- Ensure existing rows have a provider
UPDATE users SET provider = COALESCE(provider, 'manual');
