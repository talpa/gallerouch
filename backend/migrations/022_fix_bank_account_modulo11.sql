-- Migration 022: Fix bank account to pass modulo 11 validation
-- Old account: 2500068581/2010 (invalid modulo 11)
-- New account: 2400068580/2010 (valid modulo 11)
-- IBAN: CZ6520100000002400068580

UPDATE settings 
SET value = 'CZ6520100000002400068580',
    description = 'Číslo účtu galerie pro příjem plateb (IBAN format, validní modulo 11)',
    updated_at = NOW()
WHERE key = 'gallery_bank_account';

-- Verification:
-- Account number: 2400068580
-- Modulo 11 check:
-- Weights: 6,3,7,9,10,5,8,4,2,1
-- 2*6 + 4*3 + 0*7 + 0*9 + 0*10 + 6*5 + 8*8 + 5*4 + 8*2 + 0*1
-- = 12 + 12 + 0 + 0 + 0 + 30 + 64 + 20 + 16 + 0
-- = 154
-- 154 % 11 = 0 ✓ (valid)
