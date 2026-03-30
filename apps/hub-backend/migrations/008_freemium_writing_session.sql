-- ============================================================================
-- FREEMIUM WRITING SESSION TRACKING
-- ============================================================================
-- Adds writing_session_id to student_scores so that a Task 1 + Task 2
-- submission pair from the same session counts as one monthly "test".
-- Also ensures Hayford Academy (id=1) has allow_b2c_payments enabled.
-- ============================================================================

-- Track session grouping for writing submissions
ALTER TABLE student_scores
ADD COLUMN IF NOT EXISTS writing_session_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_student_scores_writing_session
  ON student_scores (student_id, writing_session_id);

-- Ensure Hayford Academy B2C payments flag is enabled (idempotent)
UPDATE institutions
SET allow_b2c_payments = true
WHERE id = 1;
