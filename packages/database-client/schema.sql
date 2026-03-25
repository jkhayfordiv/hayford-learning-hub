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

-- Drop the expression-based unique index (causes issues with ON CONFLICT)
-- Duplicate prevention is handled in application code via try/catch
DROP INDEX IF EXISTS idx_assigned_tasks_dedup;

-- ============================================================================
-- GRAMMAR PROGRESS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grammar_progress (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    error_category VARCHAR(100) NOT NULL CHECK(error_category IN (
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
    )),
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_weaknesses_user_id ON user_weaknesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weaknesses_error_count ON user_weaknesses(error_count DESC);

-- Add constraint to ensure only valid categories
DO $$
BEGIN
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
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END
$$;

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
    CHECK (assignment_type IN ('writing', 'vocabulary', 'grammar-practice', 'speaking', 'listening'));
END
$$;
