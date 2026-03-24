-- ============================================================================
-- IELTS SPEAKING PARTS EXPANSION - DATABASE MIGRATION
-- ============================================================================
-- Add support for multi-part speaking assignments (Parts 1, 2, and 3)
-- ============================================================================

-- Add speaking_parts column to assigned_tasks table
-- This will store a JSON array like ["1"], ["1","2","3"], or ["2","3"]
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS speaking_parts JSONB DEFAULT '["1"]'::jsonb;

-- Update existing speaking assignments to have Part 1 by default
UPDATE assigned_tasks
SET speaking_parts = '["1"]'::jsonb
WHERE assignment_type = 'speaking' AND speaking_parts IS NULL;

-- Create index for faster queries on speaking_parts
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_speaking_parts 
ON assigned_tasks USING GIN (speaking_parts);

-- Verification query
SELECT 
    id,
    assignment_type,
    speaking_task_part,
    speaking_parts,
    instructions
FROM assigned_tasks
WHERE assignment_type = 'speaking'
LIMIT 5;
