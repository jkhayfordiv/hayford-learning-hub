-- Migration: Add viewed_at column to student_scores table
-- This tracks when a teacher/admin views a submission, allowing the notification badge to decrease

ALTER TABLE student_scores 
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP DEFAULT NULL;

-- Create index for faster queries on unviewed submissions
CREATE INDEX IF NOT EXISTS idx_student_scores_viewed_at ON student_scores(viewed_at) WHERE viewed_at IS NULL;
