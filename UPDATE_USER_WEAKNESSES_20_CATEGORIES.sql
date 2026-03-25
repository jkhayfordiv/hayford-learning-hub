-- ============================================================================
-- UPDATE USER WEAKNESSES TABLE TO SUPPORT 20 DRA ERROR CATEGORIES
-- ============================================================================
-- This migration updates the user_weaknesses table constraint to accept
-- all 20 DRA error categories instead of the original 8.
-- Run this in Neon Console for production database.
-- ============================================================================

-- Drop the old constraint
ALTER TABLE user_weaknesses
DROP CONSTRAINT IF EXISTS chk_valid_category;

-- Add new constraint with all 20 DRA error categories
ALTER TABLE user_weaknesses
ADD CONSTRAINT chk_valid_category
CHECK (category IN (
    'Article Usage',
    'Countability & Plurals',
    'Pronoun Reference',
    'Prepositional Accuracy',
    'Word Forms',
    'Subject-Verb Agreement',
    'Tense Consistency',
    'Present Perfect vs. Past Simple',
    'Gerunds vs. Infinitives',
    'Passive Voice Construction',
    'Sentence Boundaries (Fragments/Comma Splices)',
    'Relative Clauses',
    'Subordination',
    'Word Order',
    'Parallel Structure',
    'Transitional Devices',
    'Collocations',
    'Academic Register',
    'Nominalization',
    'Hedging'
));

-- Verification: Check existing data
SELECT category, COUNT(*) as count
FROM user_weaknesses
GROUP BY category
ORDER BY count DESC;

-- Note: If you have existing data with old category names, you may need to migrate them:
-- UPDATE user_weaknesses SET category = 'Article Usage' WHERE category = 'Articles';
-- UPDATE user_weaknesses SET category = 'Prepositional Accuracy' WHERE category = 'Prepositions';
-- UPDATE user_weaknesses SET category = 'Tense Consistency' WHERE category = 'Verb Tense';
-- etc.
