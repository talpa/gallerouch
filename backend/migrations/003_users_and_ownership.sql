-- Migration 003: Add users table and artwork ownership
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin' or 'user'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add user_id to artworks table
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create default admin user (password: admin123)
-- Hash vygenerován pomocí: bcrypt.hash('admin123', 10)
INSERT INTO users (username, email, password_hash, role) VALUES
  ('admin', 'admin@gallerouch.cz', '$2b$10$k/eqSWwCTPeVnBb2GpqoRO6dCvQ9Z50acy1l6R3Kh7uv1Vmi.f06W', 'admin'),
  ('jana', 'jana@example.cz', '$2b$10$k/eqSWwCTPeVnBb2GpqoRO6dCvQ9Z50acy1l6R3Kh7uv1Vmi.f06W', 'user'),
  ('petr', 'petr@example.cz', '$2b$10$k/eqSWwCTPeVnBb2GpqoRO6dCvQ9Z50acy1l6R3Kh7uv1Vmi.f06W', 'user')
ON CONFLICT (username) DO NOTHING;

-- Update existing artworks with default user_id (admin)
UPDATE artworks SET user_id = 1 WHERE user_id IS NULL;
