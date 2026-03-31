-- ============================================================================
-- VOCAB LAB - Global Dictionary + SRS Architecture
-- ============================================================================
-- Phase 1: Core Schema for EAP Vocabulary Learning Engine
-- ============================================================================

-- ============================================================================
-- GLOBAL_WORDS - The Master Dictionary (Shared Across All Users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sense_id VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'analyze_verb_1'
    word VARCHAR(100) NOT NULL,              -- e.g., 'analyze'
    part_of_speech VARCHAR(50) NOT NULL,     -- e.g., 'verb', 'noun', 'adjective'
    primary_definition TEXT NOT NULL,
    collocations JSONB DEFAULT '[]'::jsonb,  -- Array of collocation strings
    word_family JSONB DEFAULT '{}'::jsonb,   -- Object with related forms {noun: "analysis", verb: "analyze", ...}
    context_sentence TEXT,
    is_separable BOOLEAN DEFAULT false,      -- For phrasal verbs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast word lookups
CREATE INDEX IF NOT EXISTS idx_global_words_word ON global_words(word);
CREATE INDEX IF NOT EXISTS idx_global_words_sense_id ON global_words(sense_id);

-- ============================================================================
-- USER_VOCABULARY - SRS Tracker (Per-Student Progress)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    global_word_id UUID NOT NULL REFERENCES global_words(id) ON DELETE CASCADE,
    srs_level INTEGER DEFAULT 0,             -- 0 = new, 1-5 = mastery levels
    next_review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_starred BOOLEAN DEFAULT false,        -- User bookmarked this word
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_reviewed_at TIMESTAMP,
    UNIQUE(user_id, global_word_id)          -- Prevent duplicate entries
);

-- Indexes for efficient SRS queries
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_user_id ON user_vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_next_review ON user_vocabulary(next_review_date);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_srs_level ON user_vocabulary(srs_level);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
