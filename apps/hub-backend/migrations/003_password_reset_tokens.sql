-- ============================================================================
-- PASSWORD RESET TOKEN SUPPORT
-- ============================================================================
-- This migration adds columns to support secure password reset functionality
-- ============================================================================

-- Add password reset token columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token) WHERE reset_password_token IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('reset_password_token', 'reset_password_expires');
