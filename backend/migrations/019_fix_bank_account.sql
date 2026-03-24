-- Migration: Fix bank account number with valid modulo-11 checksum
-- Updates gallery_bank_account to a valid Czech account number that passes modulo-11 validation

-- FIO Bank (kód 2010) account number that passes modulo-11 checksum
-- Account: 2500068581/2010 (valid test account)
UPDATE settings 
SET value = '2500068581/2010'
WHERE key = 'gallery_bank_account';
