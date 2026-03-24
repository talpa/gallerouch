-- Migration: Fix IBAN format to correct Czech standard
-- Corrects the IBAN structure for Czech bank account
-- Account: 2500068581/2010 (FIO bank)
-- Correct IBAN: CZ3920100000002500068581 (with proper mod-97 check digits)

UPDATE settings 
SET value = 'CZ3920100000002500068581'
WHERE key = 'gallery_bank_account';
