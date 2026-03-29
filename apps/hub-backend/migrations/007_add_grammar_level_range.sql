-- Migration: Add level_range column to assigned_tasks for Grammar Lab assignments
-- This allows teachers to assign specific level ranges (e.g., "1", "1-2", "1-3", "1-4")
-- and track completion based on whether students have passed those specific levels

-- Add level_range column to assigned_tasks table
ALTER TABLE assigned_tasks 
ADD COLUMN IF NOT EXISTS level_range VARCHAR(10) DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN assigned_tasks.level_range IS 'For grammar-practice assignments: specifies which levels must be completed (e.g., "1", "1-2", "1-3", "1-4")';

-- Verify the column was added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'assigned_tasks' AND column_name = 'level_range';
