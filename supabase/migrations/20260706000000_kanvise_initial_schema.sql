-- Kanvise Initial PostgreSQL Database Schema
-- Canonical ERD Schema Mapping (Document 04)
-- Migration: 20260706000000_kanvise_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------
-- 1. TENANT LAYER: schools
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    address TEXT,
    logo_url TEXT,
    banner_url TEXT,
    video_intro_url TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    website_url TEXT,
    instagram_url TEXT,
    twitter_url TEXT,
    facebook_url TEXT,
    whatsapp_number TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    paystack_subaccount_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);
CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active);

-- --------------------------------------------------------
-- 2. USER LAYER: user_profiles & sequences
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    supabase_auth_id UUID NOT NULL UNIQUE,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'tutor', 'student')),
    kanvise_user_id TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    profile_photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_school_id ON user_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Human-Readable ID Sequence Table
CREATE TABLE IF NOT EXISTS kanvise_id_sequences (
    role_prefix TEXT PRIMARY KEY,
    current_val INTEGER NOT NULL DEFAULT 0
);

INSERT INTO kanvise_id_sequences (role_prefix, current_val) VALUES
('ACA-ADM', 0),
('ACA-TUT', 0),
('ACA-STU', 0),
('ACA-SUP', 0)
ON CONFLICT (role_prefix) DO NOTHING;

-- RPC for incrementing and formatting ID sequences
CREATE OR REPLACE FUNCTION increment_user_sequence(p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    next_val INTEGER;
    formatted_id TEXT;
BEGIN
    UPDATE kanvise_id_sequences
    SET current_val = current_val + 1
    WHERE role_prefix = p_prefix
    RETURNING current_val INTO next_val;

    IF next_val IS NULL THEN
        INSERT INTO kanvise_id_sequences (role_prefix, current_val)
        VALUES (p_prefix, 1)
        RETURNING 1 INTO next_val;
    END IF;

    formatted_id := p_prefix || '-' || LPAD(next_val::TEXT, 5, '0');
    RETURN formatted_id;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 3. AVATAR LAYER: avatar_configs
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS avatar_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    skin_tone TEXT NOT NULL,
    face_shape TEXT NOT NULL,
    hair_style TEXT NOT NULL,
    hair_colour TEXT NOT NULL,
    outfit_colour TEXT NOT NULL,
    accessory TEXT,
    headwear TEXT
);

CREATE INDEX IF NOT EXISTS idx_avatar_configs_school_id ON avatar_configs(school_id);

-- --------------------------------------------------------
-- 4. SUBSCRIPTIONS & SUBACCOUNTS LAYER
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanvise_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    paystack_reference TEXT NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'expired', 'failed')),
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kanvise_subscriptions_school_id ON kanvise_subscriptions(school_id);

CREATE TABLE IF NOT EXISTS paystack_subaccounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
    subaccount_code TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    bank_code TEXT NOT NULL,
    account_number TEXT NOT NULL,
    percentage_charge NUMERIC(5,2) NOT NULL DEFAULT 5.00
);

-- --------------------------------------------------------
-- 5. CURRICULUM LAYER: programmes, sub_programmes, courses
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'NGN',
    thumbnail_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    UNIQUE(school_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_programmes_school_id ON programmes(school_id);
CREATE INDEX IF NOT EXISTS idx_programmes_is_published ON programmes(is_published);

CREATE TABLE IF NOT EXISTS sub_programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'NGN',
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    UNIQUE(school_id, programme_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_sub_programmes_school_id ON sub_programmes(school_id);
CREATE INDEX IF NOT EXISTS idx_sub_programmes_programme_id ON sub_programmes(programme_id);

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    programme_id UUID REFERENCES programmes(id) ON DELETE CASCADE,
    sub_programme_id UUID REFERENCES sub_programmes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'NGN',
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    UNIQUE(school_id, slug),
    CONSTRAINT chk_course_parent CHECK (NOT (programme_id IS NOT NULL AND sub_programme_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_courses_school_id ON courses(school_id);
CREATE INDEX IF NOT EXISTS idx_courses_programme_id ON courses(programme_id);
CREATE INDEX IF NOT EXISTS idx_courses_sub_programme_id ON courses(sub_programme_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_published ON courses(is_published);

CREATE TABLE IF NOT EXISTS tutor_course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES user_profiles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tutor_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_assignments_school_id ON tutor_course_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_tutor_assignments_course_id ON tutor_course_assignments(course_id);

-- --------------------------------------------------------
-- 6. FINANCE & ENROLMENT LAYER: payments, enrolments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    programme_id UUID REFERENCES programmes(id) ON DELETE SET NULL,
    sub_programme_id UUID REFERENCES sub_programmes(id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    kanvise_fee NUMERIC(12,2) NOT NULL,
    centre_amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    paystack_reference TEXT NOT NULL UNIQUE,
    paystack_transaction_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_school_id ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS enrolments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    programme_id UUID REFERENCES programmes(id) ON DELETE CASCADE,
    sub_programme_id UUID REFERENCES sub_programmes(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_enrolment_exclusivity CHECK (
        (programme_id IS NOT NULL AND sub_programme_id IS NULL AND course_id IS NULL) OR
        (programme_id IS NULL AND sub_programme_id IS NOT NULL AND course_id IS NULL) OR
        (programme_id IS NULL AND sub_programme_id IS NULL AND course_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_enrolments_school_id ON enrolments(school_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_student_id ON enrolments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_programme_id ON enrolments(programme_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_course_id ON enrolments(course_id);

-- --------------------------------------------------------
-- 7. LIVE CLASSES & ATTENDANCE LAYER
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
    livekit_room_name TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_live_classes_school_status_time ON live_classes(school_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_classes_course_id ON live_classes(course_id);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    live_class_id UUID NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_student ON attendance_records(live_class_id, student_id);

-- --------------------------------------------------------
-- 8. ACADEMICS LAYER: notes, assignments, submissions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'pptx', 'jpg', 'png')),
    file_size_bytes INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_course_id ON notes(course_id);

CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    deadline_at TIMESTAMPTZ NOT NULL,
    attachment_file_key TEXT,
    attachment_file_name TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline_at);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_late BOOLEAN NOT NULL DEFAULT false,
    score NUMERIC(5,2),
    feedback TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES user_profiles(id),
    UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);

-- --------------------------------------------------------
-- 9. CBT ENGINE LAYER: mock_exams to mock_answers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS mock_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    publish_at TIMESTAMPTZ,
    time_limit_minutes INTEGER,
    total_mcq_questions INTEGER NOT NULL DEFAULT 0,
    total_theory_questions INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mock_exams_course_id ON mock_exams(course_id);
CREATE INDEX IF NOT EXISTS idx_mock_exams_status_time ON mock_exams(school_id, status, publish_at);

CREATE TABLE IF NOT EXISTS mock_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    mock_exam_id UUID NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'theory')),
    question_text TEXT NOT NULL,
    marks NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    order_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mock_questions_exam_order ON mock_questions(mock_exam_id, order_index);

CREATE TABLE IF NOT EXISTS mock_question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES mock_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mock_options_question_order ON mock_question_options(question_id, order_index);

CREATE TABLE IF NOT EXISTS mock_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    mock_exam_id UUID NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'timed_out', 'fully_graded')),
    mcq_score NUMERIC(8,2),
    total_mcq_questions INTEGER,
    correct_mcq_answers INTEGER,
    UNIQUE(mock_exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_mock_attempts_exam_student ON mock_attempts(mock_exam_id, student_id);

CREATE TABLE IF NOT EXISTS mock_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES mock_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES mock_questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES mock_question_options(id) ON DELETE SET NULL,
    theory_answer_text TEXT,
    is_correct BOOLEAN,
    tutor_score NUMERIC(5,2),
    tutor_feedback TEXT,
    UNIQUE(attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mock_answers_attempt_id ON mock_answers(attempt_id);

-- --------------------------------------------------------
-- 10. MARKETING & ENGAGEMENT: promos, reviews, notifications
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    image_key TEXT NOT NULL,
    link_type TEXT NOT NULL CHECK (link_type IN ('programme', 'sub_programme', 'course')),
    link_id UUID NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_school_promos_active_order ON school_promos(school_id, is_active, order_index);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    programme_id UUID REFERENCES programmes(id) ON DELETE CASCADE,
    sub_programme_id UUID REFERENCES sub_programmes(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    is_published BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_reviews_school_id ON reviews(school_id);
CREATE INDEX IF NOT EXISTS idx_reviews_student_id ON reviews(student_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('live_class_reminder', 'assignment_deadline', 'mock_published', 'payment_confirmed', 'enrolment_confirmed')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    related_entity_type TEXT,
    related_entity_id UUID
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
