-- Migration 024: Author profile with bio and artwork types

-- Create artwork_types table
CREATE TABLE IF NOT EXISTS artwork_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create user_artwork_types junction table (many-to-many)
CREATE TABLE IF NOT EXISTS user_artwork_types (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artwork_type_id INTEGER NOT NULL REFERENCES artwork_types(id) ON DELETE CASCADE,
    approved BOOLEAN DEFAULT false,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, artwork_type_id)
);

-- Create author_bio table (user profile information)
CREATE TABLE IF NOT EXISTS author_bio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio_html TEXT,
    bio_text TEXT,
    approved BOOLEAN DEFAULT false,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add artwork_type_id to artworks table
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS artwork_type_id INTEGER REFERENCES artwork_types(id) ON DELETE SET NULL;

-- Insert default artwork types
INSERT INTO artwork_types (name, description) VALUES
    ('Obraz', 'Nástěnné malby a obrazy'),
    ('Socha', 'Plastiky a sochařská díla'),
    ('Keramika', 'Keramické předměty a hrnčířské práce'),
    ('Grafika', 'Tisk, kresby, grafické dílo'),
    ('Fotografie', 'Fotografická díla'),
    ('Instalace', 'Instalační umělecká díla'),
    ('Video', 'Video a mediální umění'),
    ('Animace', 'Animované díla'),
    ('Design', 'Průmyslový a produktový design'),
    ('Textil', 'Textilní umělecká díla'),
    ('Sklo', 'Sklářské a skleněné práce'),
    ('Kovářství', 'Kovářská a metalurgická díla'),
    ('Jiné', 'Ostatní druhy uměleckých děl')
ON CONFLICT (name) DO NOTHING;
