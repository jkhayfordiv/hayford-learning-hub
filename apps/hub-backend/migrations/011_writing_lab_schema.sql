-- ============================================================================
-- PHASE 1: WRITING LAB SCHEMA
-- ============================================================================
-- Creates the writing_lab_submissions table, adds dashboard visibility flag
-- to institutions, and adds writing_lab_config JSONB to assigned_tasks.
-- ============================================================================

-- Writing Lab Submissions Table
CREATE TABLE IF NOT EXISTS writing_lab_submissions (
  id                        SERIAL PRIMARY KEY,
  student_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id             INTEGER REFERENCES assigned_tasks(id) ON DELETE SET NULL,
  configuration             JSONB NOT NULL DEFAULT '{}',
  planning_data             JSONB NOT NULL DEFAULT '{}',
  draft_1_text              TEXT,
  ai_hints                  JSONB,
  draft_2_text              TEXT,
  final_score               JSONB,
  teacher_feedback          TEXT,
  grammar_weaknesses_flagged JSONB,
  status                    VARCHAR(20) NOT NULL DEFAULT 'configuring'
                              CHECK (status IN ('configuring','planning','drafting','revising','submitted','graded')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_writing_lab_student   ON writing_lab_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_writing_lab_assignment ON writing_lab_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_writing_lab_status     ON writing_lab_submissions(status);

-- Dashboard visibility flag (Phase 11 pattern)
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS show_writing_lab_on_dashboard BOOLEAN NOT NULL DEFAULT TRUE;

-- Writing Lab config column for assigned_tasks
ALTER TABLE assigned_tasks
  ADD COLUMN IF NOT EXISTS writing_lab_config JSONB;

-- Verify
SELECT 'writing_lab_submissions created' AS step;
SELECT id, name, show_writing_lab_on_dashboard FROM institutions ORDER BY id;
