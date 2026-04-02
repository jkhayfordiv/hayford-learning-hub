-- ============================================================================
-- PHASE 11: GRANULAR DASHBOARD APP VISIBILITY CONTROL
-- ============================================================================
-- Separates institution-level app licensing (has_*) from student-facing
-- dashboard visibility (show_*_on_dashboard).
-- Admins/Teachers can hide apps from free browsing while still assigning them.
-- ============================================================================

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS show_writing_on_dashboard      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_speaking_on_dashboard     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_grammar_world_on_dashboard BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_vocab_on_dashboard        BOOLEAN NOT NULL DEFAULT TRUE;

-- Verify
SELECT id, name,
  show_writing_on_dashboard,
  show_speaking_on_dashboard,
  show_grammar_world_on_dashboard,
  show_vocab_on_dashboard
FROM institutions
ORDER BY id;
