CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    class_code VARCHAR(10) UNIQUE,
    teacher_id INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS end_date DATE;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'admin')),
    target_score DECIMAL(3,1) DEFAULT NULL,
    class_id INTEGER DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, role)
);

CREATE TABLE IF NOT EXISTS learning_modules (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(100) NOT NULL,
    module_type VARCHAR(50) NOT NULL,
    description TEXT
);

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

ALTER TABLE student_scores
ADD COLUMN IF NOT EXISTS diagnostic_data JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS assigned_tasks (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER DEFAULT NULL,
    class_id INTEGER DEFAULT NULL,
    module_id INTEGER NOT NULL,
    assignment_type VARCHAR(50) DEFAULT 'writing' CHECK(assignment_type IN ('writing', 'vocabulary', 'grammar-practice')),
    grammar_topic_id VARCHAR(100),
    instructions TEXT,
    due_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE,
    CONSTRAINT chk_student_or_class CHECK ((student_id IS NOT NULL AND class_id IS NULL) OR (student_id IS NULL AND class_id IS NOT NULL))
);

ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS class_id INTEGER DEFAULT NULL REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE assigned_tasks
ADD COLUMN IF NOT EXISTS writing_task_type VARCHAR(10) DEFAULT NULL;

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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_or_class'
    ) THEN
        ALTER TABLE assigned_tasks
        ADD CONSTRAINT chk_student_or_class
        CHECK ((student_id IS NOT NULL AND class_id IS NULL) OR (student_id IS NULL AND class_id IS NOT NULL));
    END IF;
END
$$;
