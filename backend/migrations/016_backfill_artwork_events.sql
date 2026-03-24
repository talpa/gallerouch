-- Migration: Backfill events for existing artworks
-- This migration creates 'created' events for all artworks that don't have any events yet

-- Insert 'created' events for artworks without events
-- Use admin user (id=1) as creator and approver
INSERT INTO events (artwork_id, type, status, details, created_by, price, approved_at, approved_by, created_at)
SELECT 
  a.id as artwork_id,
  'created' as type,
  'approved' as status,
  json_build_object(
    'title', a.title,
    'description', a.description,
    'status', 'Skryto'
  )::text as details,
  COALESCE(a.user_id, 1) as created_by,
  0 as price,
  NOW() as approved_at,
  1 as approved_by,
  NOW() as created_at
FROM artworks a
WHERE NOT EXISTS (
  SELECT 1 FROM events e WHERE e.artwork_id = a.id
);

-- Output the number of events created
DO $$
DECLARE
  event_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO event_count 
  FROM events 
  WHERE created_at >= NOW() - INTERVAL '1 second';
  
  RAISE NOTICE 'Created % events for existing artworks', event_count;
END $$;
