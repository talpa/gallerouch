-- Migration: Fix non-JSON event details
-- This migration converts plain text event details to proper JSON format

-- Update events with plain text status details to JSON format
UPDATE events 
SET details = json_build_object('status', details)::text
WHERE details NOT LIKE '{%' 
  AND details IS NOT NULL 
  AND details != '';

-- Log the number of updated records
DO $$
DECLARE
  update_count INTEGER;
BEGIN
  GET DIAGNOSTICS update_count = ROW_COUNT;
  RAISE NOTICE 'Updated % events with non-JSON details to JSON format', update_count;
END $$;
