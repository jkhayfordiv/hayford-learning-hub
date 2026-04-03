-- ============================================================================
-- HAYFORD GLOBAL LEARNING HUB - MULTI-TENANT SAAS DATABASE SCHEMA
-- ============================================================================
-- Architecture: Platform Admin > Institution Admin > Teacher > Student
-- Strict data silos enforced via institution_id foreign keys
-- ============================================================================

-- ============================================================================
-- PHASE 1: INSTITUTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS institutions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    address TEXT,
    contact_email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add address and contact_email columns if they don't exist
ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(100);

-- ============================================================================
-- BRANDING COLUMNS - Phase 4: Dynamic White-Labeling
-- ============================================================================
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#800020';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#F7E7CE';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) DEFAULT '/logos/default-logo.png';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500) DEFAULT '/favicon.ico';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS welcome_text VARCHAR(200) DEFAULT 'Welcome to Hayford Hub';

-- Set NIC College branding (runs idempotently on every boot)
UPDATE institutions SET
  primary_color   = '#110b65',
  secondary_color = '#1a1575',
  logo_url        = '/logos/nic-logo.png',
  welcome_text    = 'Welcome to the NIC Student Portal'
WHERE subdomain = 'nic';

-- Fallback: also target NIC by ID in case subdomain is not yet set
UPDATE institutions SET
  primary_color   = '#110b65',
  secondary_color = '#1a1575',
  logo_url        = '/logos/nic-logo.png',
  welcome_text    = 'Welcome to the NIC Student Portal'
WHERE id = 4 AND (primary_color IS NULL OR primary_color = '#800020');

-- Ensure Hayford default institution has explicit branding set
UPDATE institutions SET
  primary_color   = '#800020',
  secondary_color = '#F7E7CE',
  logo_url        = '/logos/default-logo.png',
  welcome_text    = 'Welcome to Hayford Hub'
WHERE id = 1 AND primary_color = '#800020';

-- ============================================================================
-- USERS TABLE - Multi-Tenant with Institution Hierarchy
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student' CHECK(role IN ('super_admin', 'admin', 'teacher', 'student')),
    institution_id INTEGER DEFAULT NULL,
    target_score DECIMAL(3,1) DEFAULT NULL,
    class_id INTEGER DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add institution_id column if it doesn't exist (for existing databases)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS institution_id INTEGER;

-- Drop old unique constraint that included role
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_email_role_key;

-- Drop old role check constraint and recreate with new roles
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK(role IN ('super_admin', 'admin', 'teacher', 'student'));

-- Drop old UNIQUE(email) constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_unique;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_key;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END
$$;

-- Ensure email + role combination is unique (allows same email for different roles)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_role_unique'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_email_role_unique UNIQUE(email, role);
    END IF;
END
$$;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- GOOGLE SSO MIGRATION: Passwordless / OAuth accounts
-- These are idempotent and run safely on every server boot.
-- ============================================================================

-- Allow Google users who have no password hash
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Google OAuth identity columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Unique constraint on google_id (multiple NULLs are allowed in PostgreSQL UNIQUE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_google_id_key UNIQUE(google_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END
$$;

-- Partial index: fast lookup by google_id, ignores NULL rows
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- B2C freemium: user-level subscription tier and Stripe customer ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Monthly subscription tracking: subscription ID and period end date
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_current_period_end ON users(current_period_end) WHERE current_period_end IS NOT NULL;

-- ============================================================================
-- CLASSES TABLE - Institution-Scoped
-- ============================================================================
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    class_code VARCHAR(6) UNIQUE NOT NULL,
    teacher_id INTEGER NOT NULL,
    institution_id INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add institution_id column if it doesn't exist
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS institution_id INTEGER;

-- Add start_date and end_date if they don't exist
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Ensure class_code is 6 characters and NOT NULL
DO $$
BEGIN
    -- Change class_code to VARCHAR(6)
    ALTER TABLE classes ALTER COLUMN class_code TYPE VARCHAR(6);
    
    -- Make class_code NOT NULL (only if all existing rows have values)
    IF NOT EXISTS (
        SELECT 1 FROM classes WHERE class_code IS NULL
    ) THEN
        ALTER TABLE classes ALTER COLUMN class_code SET NOT NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If error occurs, just continue
        NULL;
END
$$;

-- ============================================================================
-- CLASS ENROLLMENTS TABLE - Many-to-Many relationship between Users and Classes
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE(user_id, class_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_class_enrollments_user_id ON class_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);

-- ============================================================================
-- LEARNING MODULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_modules (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(100) NOT NULL,
    module_type VARCHAR(50) NOT NULL,
    description TEXT
);

-- ============================================================================
-- STUDENT SCORES TABLE - Cascades from Users
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_scores (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    module_id INTEGER NOT NULL,
    submitted_text TEXT,
    word_count INTEGER DEFAULT 0,
    overall_score DECIMAL(3,1),
    ai_feedback JSON,
    diagnostic_data JSONB DEFAULT '[]'::jsonb,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE
);

-- Add diagnostic_data column if it doesn't exist
ALTER TABLE student_scores
ADD COLUMN IF NOT EXISTS diagnostic_data JSONB DEFAULT '[]'::jsonb;

-- Freemium: session tracking for monthly writing limit
ALTER TABLE student_scores
ADD COLUMN IF NOT EXISTS writing_session_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_student_scores_writing_session
  ON student_scores (student_id, writing_session_id);

-- Ensure Hayford Academy B2C payments flag is enabled (freemium system)
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS allow_b2c_payments BOOLEAN DEFAULT false;
UPDATE institutions SET allow_b2c_payments = true WHERE id = 1;

-- ============================================================================
-- ASSIGNED TASKS TABLE - Institution-Scoped via Class/Student
-- ============================================================================
CREATE TABLE IF NOT EXISTS assigned_tasks (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER DEFAULT NULL,
    class_id INTEGER DEFAULT NULL,
    module_id INTEGER NOT NULL,
    assignment_type VARCHAR(50) DEFAULT 'writing',
    grammar_topic_id VARCHAR(100),
    writing_task_type VARCHAR(10) DEFAULT NULL,
    speaking_task_part VARCHAR(10) DEFAULT NULL,
    instructions TEXT,
    due_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE
);

-- Add class_id column if it doesn't exist
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS class_id INTEGER;

-- Add writing_task_type column if it doesn't exist
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS writing_task_type VARCHAR(10) DEFAULT NULL;

-- Add speaking_task_part column if it doesn't exist
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS speaking_task_part VARCHAR(10) DEFAULT NULL;

-- Add speaking_parts column for multi-part speaking assignments
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS speaking_parts JSONB DEFAULT '["1"]'::jsonb;

-- Add level_range for grammar level-based assignments
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS level_range VARCHAR(10) DEFAULT NULL;

-- Add vocab_words for vocabulary assignment target lists
ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS vocab_words TEXT;

-- Drop the expression-based unique index (causes issues with ON CONFLICT)
-- Duplicate prevention is handled in application code via try/catch
DROP INDEX IF EXISTS idx_assigned_tasks_dedup;

-- ============================================================================
-- GRAMMAR PROGRESS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grammar_progress (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    error_category VARCHAR(100) NOT NULL,
    current_level INTEGER NOT NULL DEFAULT 1 CHECK(current_level BETWEEN 1 AND 4),
    exercises_completed INTEGER NOT NULL DEFAULT 0 CHECK(exercises_completed >= 0),
    passed_levels JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(student_id, error_category)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Classes -> Teacher (User)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_classes_teacher'
    ) THEN
        ALTER TABLE classes
        ADD CONSTRAINT fk_classes_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- Classes -> Institution
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_classes_institution'
    ) THEN
        ALTER TABLE classes
        ADD CONSTRAINT fk_classes_institution
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- Users -> Institution
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_institution'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_institution
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- Users -> Class
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_class'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_class
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- Assigned Tasks -> Class
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_assigned_tasks_class'
    ) THEN
        ALTER TABLE assigned_tasks
        ADD CONSTRAINT fk_assigned_tasks_class
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- ============================================================================
-- USER WEAKNESSES TABLE - Global Error Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_weaknesses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    error_count INTEGER DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, category)
);

-- Ensure legacy schemas match current column names
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_weaknesses' AND column_name = 'error_tag'
    ) THEN
        ALTER TABLE user_weaknesses RENAME COLUMN error_tag TO category;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_weaknesses' AND column_name = 'last_failed_at'
    ) THEN
        ALTER TABLE user_weaknesses RENAME COLUMN last_failed_at TO last_updated;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_weaknesses' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_weaknesses DROP COLUMN updated_at;
    END IF;
END
$$;

ALTER TABLE user_weaknesses
    ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL;

ALTER TABLE user_weaknesses
    ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_weaknesses_user_id ON user_weaknesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weaknesses_error_count ON user_weaknesses(error_count DESC);

-- Drop any restrictive category constraints from the old IELTS-era schema
-- This runs on every startup to ensure production databases are fixed.
ALTER TABLE user_weaknesses DROP CONSTRAINT IF EXISTS chk_valid_category;


-- ============================================================================
-- GRAMMAR WORLD MAP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS grammar_nodes (
    node_id VARCHAR(100) PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    tier VARCHAR(20) CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Diagnostic')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_json JSONB NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grammar_nodes_region ON grammar_nodes(region);
CREATE INDEX IF NOT EXISTS idx_grammar_nodes_tier ON grammar_nodes(tier);

-- Widen node_id for long pathway node IDs (idempotent)
ALTER TABLE grammar_nodes ALTER COLUMN node_id TYPE VARCHAR(100);

CREATE TABLE IF NOT EXISTS user_grammar_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL REFERENCES grammar_nodes(node_id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('locked', 'unlocked', 'in_progress', 'completed')) DEFAULT 'locked',
    attempts INTEGER DEFAULT 0,
    last_score INTEGER,
    last_attempt_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_user ON user_grammar_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_status ON user_grammar_progress(user_id, status);

CREATE TABLE IF NOT EXISTS user_mastery_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region VARCHAR(100) NOT NULL,
    nodes_completed INTEGER DEFAULT 0,
    total_nodes INTEGER DEFAULT 0,
    mastery_points INTEGER DEFAULT 0,
    bronze_medals INTEGER DEFAULT 0,
    silver_medals INTEGER DEFAULT 0,
    gold_medals INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    last_activity_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, region)
);

CREATE INDEX IF NOT EXISTS idx_user_mastery_stats_user ON user_mastery_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mastery_stats_region ON user_mastery_stats(user_id, region);

CREATE TABLE IF NOT EXISTS grammar_activity_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id VARCHAR(50) NOT NULL REFERENCES grammar_nodes(node_id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    user_response JSONB NOT NULL,
    ai_feedback JSONB,
    score INTEGER,
    passed BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grammar_submissions_user_node ON grammar_activity_submissions(user_id, node_id);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- Assigned Tasks: Must have either student_id OR class_id (at least one)
DO $$
BEGIN
    ALTER TABLE assigned_tasks
    DROP CONSTRAINT IF EXISTS chk_student_or_class;
    
    ALTER TABLE assigned_tasks
    ADD CONSTRAINT chk_student_or_class
    CHECK (student_id IS NOT NULL OR class_id IS NOT NULL);

    -- Assigned Tasks: Valid assignment types
    -- Drop BOTH possible constraint names (auto-generated and manual)
    ALTER TABLE assigned_tasks
    DROP CONSTRAINT IF EXISTS assigned_tasks_assignment_type_check;

    ALTER TABLE assigned_tasks
    DROP CONSTRAINT IF EXISTS chk_assignment_type;
    
    ALTER TABLE assigned_tasks
    ADD CONSTRAINT chk_assignment_type
    CHECK (assignment_type IN ('writing', 'vocabulary', 'grammar-practice', 'speaking', 'listening', 'writing_lab'));
END
$$;

-- ============================================================================
-- PHASE 11: GRANULAR DASHBOARD APP VISIBILITY (Migration 010)
-- ============================================================================
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS show_writing_on_dashboard       BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS show_speaking_on_dashboard      BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS show_grammar_world_on_dashboard BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS show_vocab_on_dashboard         BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================================
-- WRITING LAB SCHEMA (Migration 011)
-- ============================================================================
CREATE TABLE IF NOT EXISTS writing_lab_submissions (
  id                         SERIAL PRIMARY KEY,
  student_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id              INTEGER REFERENCES assigned_tasks(id) ON DELETE SET NULL,
  configuration              JSONB NOT NULL DEFAULT '{}',
  planning_data              JSONB NOT NULL DEFAULT '{}',
  draft_1_text               TEXT,
  ai_hints                   JSONB,
  draft_2_text               TEXT,
  final_score                JSONB,
  teacher_feedback           TEXT,
  grammar_weaknesses_flagged JSONB,
  status                     VARCHAR(20) NOT NULL DEFAULT 'configuring'
                               CHECK (status IN ('configuring','planning','drafting','revising','submitted','graded')),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_writing_lab_student    ON writing_lab_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_writing_lab_assignment ON writing_lab_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_writing_lab_status     ON writing_lab_submissions(status);

ALTER TABLE institutions   ADD COLUMN IF NOT EXISTS show_writing_lab_on_dashboard BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE assigned_tasks ADD COLUMN IF NOT EXISTS writing_lab_config JSONB;
