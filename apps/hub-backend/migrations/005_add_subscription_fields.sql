-- Add stripe_subscription_id and current_period_end to users for monthly subscription tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP;

-- Index for fast lookup by subscription ID
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Index for expiring subscriptions
CREATE INDEX IF NOT EXISTS idx_users_current_period_end ON users(current_period_end) WHERE current_period_end IS NOT NULL;
