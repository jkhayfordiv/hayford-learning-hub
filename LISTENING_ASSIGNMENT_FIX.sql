-- ============================================================================
-- LISTENING ASSIGNMENT TYPE FIX - DATABASE MIGRATION
-- ============================================================================
-- Add 'listening' to valid assignment types constraint
-- ============================================================================

-- Drop and recreate the constraint to include 'listening'
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
