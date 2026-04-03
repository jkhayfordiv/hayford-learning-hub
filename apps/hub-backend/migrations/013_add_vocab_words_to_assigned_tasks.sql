-- Migration: ensure vocabulary assignment payload can persist target word lists
-- Used by assignment import and visibility/debugging in Vocab Lab flows.

ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS vocab_words TEXT;
