-- ============================================================================
-- USER WEAKNESSES TRACKING - DATABASE MIGRATION
-- ============================================================================
-- Track student errors across Speaking and Writing tasks for targeted feedback
-- ============================================================================

-- Create user_weaknesses table
CREATE TABLE IF NOT EXISTS user_weaknesses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    error_count INTEGER DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, category)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_weaknesses_user_id ON user_weaknesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weaknesses_error_count ON user_weaknesses(error_count DESC);

-- Add constraint to ensure only valid categories
ALTER TABLE user_weaknesses
DROP CONSTRAINT IF EXISTS chk_valid_category;

ALTER TABLE user_weaknesses
ADD CONSTRAINT chk_valid_category
CHECK (category IN (
    'Subject-Verb Agreement',
    'Verb Tense',
    'Prepositions',
    'Articles',
    'Vocabulary/Word Choice',
    'Pronunciation/Clarity',
    'Sentence Structure',
    'Cohesion/Linking Words'
));

-- Verification query
SELECT 
    u.first_name,
    u.last_name,
    uw.category,
    uw.error_count,
    uw.last_updated
FROM user_weaknesses uw
JOIN users u ON uw.user_id = u.id
ORDER BY uw.error_count DESC
LIMIT 10;
