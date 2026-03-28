-- ============================================================================
-- MULTI-TENANT SAAS ARCHITECTURE MIGRATION
-- ============================================================================
-- This migration adds institution-level feature flags, academic terms,
-- and enhanced user compliance fields for a B2B/B2C SaaS platform
-- ============================================================================

-- ============================================================================
-- 1. ALTER INSTITUTIONS TABLE - Add SaaS Feature Flags
-- ============================================================================
ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Tokyo',
ADD COLUMN IF NOT EXISTS has_grammar_world BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS has_ielts_speaking BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';

-- Ensure default institution exists with proper values
INSERT INTO institutions (id, name, subdomain, timezone, has_grammar_world, has_ielts_speaking)
VALUES (1, 'Hayford Academy', 'app', 'Asia/Tokyo', true, true)
ON CONFLICT (id) DO UPDATE SET
  subdomain = EXCLUDED.subdomain,
  timezone = EXCLUDED.timezone,
  has_grammar_world = EXCLUDED.has_grammar_world,
  has_ielts_speaking = EXCLUDED.has_ielts_speaking;

-- ============================================================================
-- 2. CREATE TERMS TABLE - Academic Scheduling
-- ============================================================================
CREATE TABLE IF NOT EXISTS terms (
    id SERIAL PRIMARY KEY,
    institution_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_terms_institution_id ON terms(institution_id);
CREATE INDEX IF NOT EXISTS idx_terms_is_active ON terms(is_active);

-- ============================================================================
-- 3. ALTER CLASSES TABLE - Link to Terms
-- ============================================================================
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS term_id INTEGER,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_classes_term'
    ) THEN
        ALTER TABLE classes
        ADD CONSTRAINT fk_classes_term
        FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- ============================================================================
-- 4. ALTER USERS TABLE - Add Compliance & Multi-Tenancy Fields
-- ============================================================================

-- Add new columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS student_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Remove deprecated column
ALTER TABLE users
DROP COLUMN IF EXISTS target_score;

-- Set default institution_id for existing users (prevents breaking changes)
UPDATE users SET institution_id = 1 WHERE institution_id IS NULL;

-- Create composite unique constraint for student_id scoped to institution
-- This allows the same student_id across different institutions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_institution_student_id_unique'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_institution_student_id_unique 
        UNIQUE(institution_id, student_id);
    END IF;
END
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Update backend auth.js to inject institution data into JWT
-- 2. Create requireFeature.js middleware for feature flag enforcement
-- 3. Update admin analytics routes with tenant isolation
-- 4. Update frontend Dashboard.jsx with feature flag conditionals
-- ============================================================================
