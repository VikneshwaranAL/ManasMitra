-- ==============================================================================
-- ManasMitra Database Schema (MySQL 8.0+ / PostgreSQL / SQLite Compatible)
-- Project: ManasMitra - Elderly-First Cognitive & Routine Wellness Platform
-- ==============================================================================

-- Drop tables if re-initializing (in reverse order of dependencies)
DROP TABLE IF EXISTS ai_insights;
DROP TABLE IF EXISTS memory_book;
DROP TABLE IF EXISTS family_members;
DROP TABLE IF EXISTS reminder_logs;
DROP TABLE IF EXISTS reminders;
DROP TABLE IF EXISTS game_scores;
DROP TABLE IF EXISTS cognitive_games;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS patients;

-- ------------------------------------------------------------------------------
-- 1. PATIENTS / USERS
-- Core profile of the elderly patient and their primary trusted caregiver
-- ------------------------------------------------------------------------------
CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 5 AND age <= 89),
    caregiver_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(25) NOT NULL,
    preferred_language VARCHAR(50) NOT NULL DEFAULT 'English',
    pin VARCHAR(10) NOT NULL,
    avatar VARCHAR(50) DEFAULT '👵',
    current_stage VARCHAR(20) DEFAULT 'Stage I',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_phone ON patients(phone_number);

-- ------------------------------------------------------------------------------
-- 2. ASSESSMENTS
-- Records weekly cognitive screening assessments and stage assignments
-- ------------------------------------------------------------------------------
CREATE TABLE assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    assessment_date DATE NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 6),
    stage VARCHAR(20) NOT NULL CHECK (stage IN ('Stage I', 'Stage II', 'Stage III')),
    details_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessments_patient ON assessments(patient_id);
CREATE INDEX idx_assessments_date ON assessments(assessment_date);

-- ------------------------------------------------------------------------------
-- 3. COGNITIVE GAMES
-- Master catalog of the 14 interactive cognitive activities
-- ------------------------------------------------------------------------------
CREATE TABLE cognitive_games (
    id VARCHAR(50) PRIMARY KEY,
    stage VARCHAR(20) NOT NULL CHECK (stage IN ('Stage I', 'Stage II', 'Stage III')),
    title VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    icon VARCHAR(20) DEFAULT '🎮',
    instructions TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. GAME SCORES
-- Tracks cognitive game attempts, performance percentages, and continuity
-- ------------------------------------------------------------------------------
CREATE TABLE game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    game_id VARCHAR(50) NOT NULL,
    game_name VARCHAR(100) NOT NULL,
    stage VARCHAR(20) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    duration_seconds INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES cognitive_games(id) ON DELETE CASCADE
);

CREATE INDEX idx_scores_patient ON game_scores(patient_id);
CREATE INDEX idx_scores_played_at ON game_scores(played_at);

-- ------------------------------------------------------------------------------
-- 5. REMINDERS
-- Configured daily routine tasks (medication, hydration, walk, meals)
-- ------------------------------------------------------------------------------
CREATE TABLE reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    scheduled_time VARCHAR(10) NOT NULL, -- Format: HH:MM (24-hour)
    repeat_type VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (repeat_type IN ('daily', 'once')),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_reminders_patient ON reminders(patient_id);
CREATE INDEX idx_reminders_time ON reminders(scheduled_time);

-- ------------------------------------------------------------------------------
-- 6. REMINDER LOGS & SNOOZE STATE
-- Enforces deterministic non-looping reminder flow (Popup -> 5-min Snooze -> Final Popup -> Rest)
-- ------------------------------------------------------------------------------
CREATE TABLE reminder_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_id INTEGER NOT NULL,
    log_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed_once', 'skipped_today')),
    snooze_count INTEGER NOT NULL DEFAULT 0 CHECK (snooze_count <= 2),
    snooze_until TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE,
    UNIQUE(reminder_id, log_date)
);

CREATE INDEX idx_reminder_logs_date ON reminder_logs(log_date);

-- ------------------------------------------------------------------------------
-- 7. MEMORY BOOK
-- Cherished photos, life events, and nostalgic descriptions for reminiscing
-- ------------------------------------------------------------------------------
CREATE TABLE memory_book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    memory_date VARCHAR(100) NOT NULL,
    preset_icon VARCHAR(50) DEFAULT 'family',
    image_data TEXT, -- Base64 data URL or external asset URI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_memory_patient ON memory_book(patient_id);

-- ------------------------------------------------------------------------------
-- 8. FAMILY MEMBERS & CAREGIVER CIRCLE
-- Loved ones, healthcare workers, and caregivers with speech synthesis support
-- ------------------------------------------------------------------------------
CREATE TABLE family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    email VARCHAR(100),
    city VARCHAR(100),
    support_role VARCHAR(50) NOT NULL DEFAULT 'Family' CHECK (support_role IN ('Family', 'Caregiver', 'Doctor', 'Community Health Worker', 'Trusted Person')),
    notes TEXT,
    is_primary INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_family_patient ON family_members(patient_id);

-- ------------------------------------------------------------------------------
-- 9. AI INSIGHTS & ACTIVITY ANALYTICS
-- Locally computed non-medical activity patterns and recommendations
-- ------------------------------------------------------------------------------
CREATE TABLE ai_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    games_count INTEGER NOT NULL DEFAULT 0,
    avg_accuracy DECIMAL(5,2) DEFAULT 0.00,
    task_completion_pct DECIMAL(5,2) DEFAULT 0.00,
    recommended_stage VARCHAR(20) DEFAULT 'Stage I',
    recommendations_json TEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_insights_patient ON ai_insights(patient_id);
