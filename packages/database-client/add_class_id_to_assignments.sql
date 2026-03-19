-- Migration: Add class_id column to assigned_tasks table
-- Date: 2026-03-19
-- Description: Links assignments to classes for class-based assignment management

-- Add class_id column if it doesn't exist (nullable to preserve existing data)
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS class_id INTEGER;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'assigned_tasks_class_id_fkey' 
        AND table_name = 'assigned_tasks'
    ) THEN
        ALTER TABLE assigned_tasks
        ADD CONSTRAINT assigned_tasks_class_id_fkey 
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for faster class-based queries
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_class_id ON assigned_tasks(class_id);

COMMENT ON COLUMN assigned_tasks.class_id IS 'Foreign key to classes table - links assignment to a specific class';
