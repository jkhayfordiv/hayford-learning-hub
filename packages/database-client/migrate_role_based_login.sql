-- ============================================================================
-- MIGRATION SCRIPT: Role-Based Login Gates
-- ============================================================================
-- This script enables multiple profiles per email address with different roles.
-- A user can now have both a Student profile and a Teacher profile under the
-- same email address.
--
-- IMPORTANT: Review this script before running. It will modify your database schema.
-- ============================================================================

-- Step 1: Drop the existing UNIQUE(email) constraint
DO $$
BEGIN
    -- Drop the constraint if it exists (constraint name may vary)
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_unique;
        RAISE NOTICE 'Dropped constraint: users_email_unique';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_key;
        RAISE NOTICE 'Dropped constraint: users_email_key';
    END IF;
END
$$;

-- Step 2: Create the new composite UNIQUE(email, role) constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_role_unique'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_email_role_unique UNIQUE(email, role);
        RAISE NOTICE 'Created constraint: users_email_role_unique';
    END IF;
END
$$;

-- Step 3: Create an index for faster email lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to confirm success)
-- ============================================================================
-- Check the new constraint exists:
-- SELECT conname, contype, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'users'::regclass AND conname = 'users_email_role_unique';

-- Test: Try to find users with same email but different roles
-- SELECT email, role, first_name, last_name 
-- FROM users 
-- WHERE email IN (
--   SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
-- )
-- ORDER BY email, role;
