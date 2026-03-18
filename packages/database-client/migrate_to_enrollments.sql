-- ============================================================================
-- MIGRATION SCRIPT: Single class_id to Many-to-Many class_enrollments
-- ============================================================================
-- This script migrates existing user.class_id data to the new class_enrollments table
-- and then removes the class_id column from the users table.
--
-- IMPORTANT: Review this script before running. It will modify your database schema.
-- ============================================================================

-- Step 1: Migrate existing class_id data to class_enrollments
-- Only insert records where class_id is NOT NULL
INSERT INTO class_enrollments (user_id, class_id, joined_at)
SELECT id, class_id, created_at
FROM users
WHERE class_id IS NOT NULL
ON CONFLICT (user_id, class_id) DO NOTHING;

-- Step 2: Verify migration (optional - comment out if running as script)
-- SELECT COUNT(*) as migrated_enrollments FROM class_enrollments;
-- SELECT COUNT(*) as users_with_class FROM users WHERE class_id IS NOT NULL;

-- Step 3: Drop the foreign key constraint on users.class_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_class'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT fk_users_class;
    END IF;
END
$$;

-- Step 4: Drop the class_id column from users table
-- WARNING: This is a destructive operation. Ensure data is migrated first.
-- Uncomment the line below when you're ready to execute:
-- ALTER TABLE users DROP COLUMN IF EXISTS class_id;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to confirm success)
-- ============================================================================
-- Check enrollments were created:
-- SELECT u.email, c.class_name, ce.joined_at 
-- FROM class_enrollments ce
-- JOIN users u ON ce.user_id = u.id
-- JOIN classes c ON ce.class_id = c.id
-- ORDER BY ce.joined_at DESC
-- LIMIT 20;

-- Check for any orphaned data:
-- SELECT id, email, first_name, last_name FROM users WHERE class_id IS NOT NULL;
