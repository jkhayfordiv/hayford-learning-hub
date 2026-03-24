-- ============================================================================
-- PRODUCTION DATABASE MIGRATION - RUN THIS IN NEON CONSOLE
-- ============================================================================
-- This script applies all pending migrations to bring production database
-- up to date with the latest schema changes.
-- ============================================================================

-- STEP 1: Create class_enrollments table for Many-to-Many relationships
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, class_id)
);

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_enrollments_user_id_fkey'
    ) THEN
        ALTER TABLE class_enrollments
        ADD CONSTRAINT class_enrollments_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'class_enrollments_class_id_fkey'
    ) THEN
        ALTER TABLE class_enrollments
        ADD CONSTRAINT class_enrollments_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_enrollments_user_id ON class_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);

-- STEP 2: Migrate existing class_id data to class_enrollments
-- ============================================================================
-- Copy existing student class assignments to the new table
INSERT INTO class_enrollments (user_id, class_id, joined_at)
SELECT id, class_id, created_at
FROM users
WHERE class_id IS NOT NULL
  AND role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM class_enrollments ce 
    WHERE ce.user_id = users.id AND ce.class_id = users.class_id
  );

-- STEP 3: Update UNIQUE constraint for role-based login
-- ============================================================================
-- Drop old UNIQUE(email) constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_unique;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_key;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Add new UNIQUE(email, role) constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_role_unique'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_email_role_unique UNIQUE(email, role);
    END IF;
END $$;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- STEP 4: Verification queries
-- ============================================================================
-- Run these to verify the migration was successful

-- Check class_enrollments table exists and has data
SELECT 'class_enrollments table' as check_name, COUNT(*) as record_count FROM class_enrollments;

-- Check UNIQUE constraint exists
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass AND conname = 'users_email_role_unique';

-- Show sample enrollments
SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.email,
    ce.class_id,
    c.class_name,
    ce.joined_at
FROM class_enrollments ce
JOIN users u ON ce.user_id = u.id
JOIN classes c ON ce.class_id = c.id
LIMIT 5;

-- STEP 5: Add 'listening' to valid assignment types
-- ============================================================================
DO $$
BEGIN
    ALTER TABLE assigned_tasks
    DROP CONSTRAINT IF EXISTS chk_assignment_type;
    
    ALTER TABLE assigned_tasks
    ADD CONSTRAINT chk_assignment_type
    CHECK (assignment_type IN ('writing', 'vocabulary', 'grammar-practice', 'speaking', 'listening'));
END
$$;

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'chk_assignment_type';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After running this script:
-- 1. Verify the output shows no errors
-- 2. Check that class_enrollments has records
-- 3. Check that assignment_type constraint includes 'listening'
-- 4. Redeploy your Render backend (it should auto-deploy from GitHub)
-- ============================================================================
