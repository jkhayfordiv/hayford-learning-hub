-- Migration: Create user_word_bank table for Student Word Bank feature
-- Date: 2026-03-19
-- Description: Allows students to save, view, and delete their own vocabulary words

CREATE TABLE IF NOT EXISTS user_word_bank (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(255) NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_word UNIQUE(user_id, word)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_word_bank_user_id ON user_word_bank(user_id);

-- Create index for faster ordering by created_at
CREATE INDEX IF NOT EXISTS idx_user_word_bank_created_at ON user_word_bank(created_at DESC);

COMMENT ON TABLE user_word_bank IS 'Stores vocabulary words saved by students for personal study';
COMMENT ON COLUMN user_word_bank.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_word_bank.word IS 'The vocabulary word saved by the student';
COMMENT ON COLUMN user_word_bank.source IS 'How the word was added: manual, vocab_tool, etc.';
COMMENT ON COLUMN user_word_bank.created_at IS 'Timestamp when the word was added';
