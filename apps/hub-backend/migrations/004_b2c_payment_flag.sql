-- ============================================================================
-- B2C PAYMENT FEATURE FLAG
-- ============================================================================
-- This migration adds a flag to control which institutions can use B2C payments
-- Enterprise clients (B2B) will have this disabled and pay via invoice
-- ============================================================================

-- Add allow_b2c_payments column to institutions table
ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS allow_b2c_payments BOOLEAN DEFAULT false;

-- Enable B2C payments for Hayford Academy (our direct consumer brand)
UPDATE institutions 
SET allow_b2c_payments = true 
WHERE id = 1;

-- Verify the update
SELECT id, name, allow_b2c_payments, subscription_tier 
FROM institutions 
WHERE id IN (1, 4)
ORDER BY id;
