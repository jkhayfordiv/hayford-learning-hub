-- ============================================================================
-- USER-LEVEL SUBSCRIPTION COLUMNS
-- ============================================================================
-- This migration adds subscription columns to the users table for B2C payments
-- Individual users can now have premium status independent of their institution
-- ============================================================================

-- Add user-level subscription columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Create index for faster Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('subscription_tier', 'stripe_customer_id')
ORDER BY column_name;
