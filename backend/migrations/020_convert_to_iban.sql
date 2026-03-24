-- Migration: Convert bank account to IBAN format
-- Updates gallery_bank_account to valid IBAN format for FIO bank
-- Czech IBAN format: CZ + 2 check digits + 4-digit bank code + 6-digit prefix + 10-digit account number

UPDATE settings 
SET value = 'CZ6520100002500068581'
WHERE key = 'gallery_bank_account';
