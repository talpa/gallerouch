-- Create artworks table
CREATE TABLE IF NOT EXISTS artworks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  imageUrl VARCHAR(512),
  price INTEGER,
  status VARCHAR(50),
  eventDate DATE
);

-- Create artwork_events table
CREATE TABLE IF NOT EXISTS artwork_events (
  id SERIAL PRIMARY KEY,
  artworkId INTEGER REFERENCES artworks(id) ON DELETE CASCADE,
  status VARCHAR(50),
  eventDate DATE
);
