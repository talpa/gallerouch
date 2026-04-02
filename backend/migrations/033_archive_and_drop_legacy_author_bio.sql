-- Migration 033: Archive and drop legacy author_bio table
-- Legacy author profile data has been moved to users.bio/users.bio_en + approval fields.

DO $$
BEGIN
  IF to_regclass('public.author_bio') IS NOT NULL THEN
    -- Preserve legacy rows before dropping the obsolete table.
    EXECUTE 'CREATE TABLE IF NOT EXISTS author_bio_legacy_archive AS TABLE author_bio WITH NO DATA';
    EXECUTE 'INSERT INTO author_bio_legacy_archive SELECT * FROM author_bio';
    EXECUTE 'DROP TABLE author_bio';
  END IF;
END $$;
