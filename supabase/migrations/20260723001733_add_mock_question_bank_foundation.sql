-- Versioned question-bank foundation for the Kanvise mock engine.
-- This migration is intentionally additive: existing mock tables and results remain valid.

CREATE TABLE question_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    description TEXT,
    visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'centre'))
);

CREATE INDEX idx_question_banks_school_visibility
    ON question_banks(school_id, visibility) WHERE archived_at IS NULL;
CREATE INDEX idx_question_banks_owner
    ON question_banks(owner_id) WHERE archived_at IS NULL;

CREATE TABLE question_stimuli (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    title TEXT,
    plain_text TEXT NOT NULL DEFAULT '',
    content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(content_blocks) = 'array')
);

CREATE INDEX idx_question_stimuli_school ON question_stimuli(school_id);

CREATE TABLE question_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    storage_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),
    checksum TEXT NOT NULL,
    alt_text TEXT,
    processing_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'ready', 'failed')),
    UNIQUE (school_id, storage_key)
);

CREATE INDEX idx_question_media_school_status
    ON question_media(school_id, processing_status);

CREATE TABLE bank_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    subject_name TEXT,
    topic TEXT,
    subtopic TEXT,
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'theory')),
    current_version_id UUID,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

CREATE INDEX idx_bank_questions_bank_status ON bank_questions(bank_id, status);
CREATE INDEX idx_bank_questions_school_subject_topic
    ON bank_questions(school_id, lower(subject_name), lower(topic))
    WHERE archived_at IS NULL;
CREATE INDEX idx_bank_questions_course ON bank_questions(course_id)
    WHERE course_id IS NOT NULL AND archived_at IS NULL;

CREATE TABLE bank_question_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES bank_questions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    stimulus_id UUID REFERENCES question_stimuli(id) ON DELETE SET NULL,
    plain_text TEXT NOT NULL DEFAULT '',
    content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(content_blocks) = 'array'),
    explanation_blocks JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(explanation_blocks) = 'array'),
    grading_rubric_blocks JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(grading_rubric_blocks) = 'array'),
    marks NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (marks > 0),
    UNIQUE (question_id, version_number),
    UNIQUE (id, question_id)
);

ALTER TABLE bank_questions
    ADD CONSTRAINT bank_questions_current_version_fkey
    FOREIGN KEY (current_version_id, id)
    REFERENCES bank_question_versions(id, question_id);

CREATE INDEX idx_bank_question_versions_question
    ON bank_question_versions(question_id, version_number DESC);

CREATE TABLE bank_question_option_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    question_version_id UUID NOT NULL REFERENCES bank_question_versions(id) ON DELETE CASCADE,
    plain_text TEXT NOT NULL DEFAULT '',
    content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(content_blocks) = 'array'),
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL CHECK (order_index >= 0),
    UNIQUE (question_version_id, order_index),
    UNIQUE (id, question_version_id)
);

CREATE INDEX idx_bank_question_options_version
    ON bank_question_option_versions(question_version_id, order_index);

CREATE TABLE bank_question_version_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    question_version_id UUID NOT NULL REFERENCES bank_question_versions(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES question_media(id) ON DELETE RESTRICT,
    usage_key TEXT NOT NULL CHECK (length(btrim(usage_key)) > 0),
    UNIQUE (question_version_id, usage_key),
    UNIQUE (question_version_id, media_id, usage_key)
);

CREATE INDEX idx_bank_question_version_media_version
    ON bank_question_version_media(question_version_id);

CREATE TABLE question_stimulus_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    stimulus_id UUID NOT NULL REFERENCES question_stimuli(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES question_media(id) ON DELETE RESTRICT,
    usage_key TEXT NOT NULL CHECK (length(btrim(usage_key)) > 0),
    UNIQUE (stimulus_id, usage_key),
    UNIQUE (stimulus_id, media_id, usage_key)
);

CREATE INDEX idx_question_stimulus_media_stimulus
    ON question_stimulus_media(stimulus_id);

CREATE TABLE mock_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    mock_exam_id UUID NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
    subject_name TEXT,
    instructions TEXT,
    order_index INTEGER NOT NULL CHECK (order_index >= 0),
    UNIQUE (mock_exam_id, order_index)
);

CREATE INDEX idx_mock_sections_exam_order ON mock_sections(mock_exam_id, order_index);

CREATE TABLE mock_section_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES mock_sections(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES bank_questions(id) ON DELETE RESTRICT,
    question_version_id UUID NOT NULL,
    order_index INTEGER NOT NULL CHECK (order_index >= 0),
    marks_override NUMERIC(8,2) CHECK (marks_override IS NULL OR marks_override > 0),
    FOREIGN KEY (question_version_id, question_id)
        REFERENCES bank_question_versions(id, question_id) ON DELETE RESTRICT,
    UNIQUE (section_id, order_index),
    UNIQUE (section_id, question_id)
);

CREATE INDEX idx_mock_section_questions_section
    ON mock_section_questions(section_id, order_index);

CREATE TABLE mock_question_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES mock_sections(id) ON DELETE CASCADE,
    bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE RESTRICT,
    subject_name TEXT,
    topic TEXT,
    subtopic TEXT,
    question_type TEXT CHECK (question_type IS NULL OR question_type IN ('mcq', 'theory')),
    question_count INTEGER NOT NULL CHECK (question_count > 0)
);

CREATE INDEX idx_mock_question_rules_section ON mock_question_rules(section_id);

CREATE TABLE mock_exam_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    mock_exam_id UUID NOT NULL REFERENCES mock_exams(id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    published_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settings JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(settings) = 'object'),
    total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
    total_marks NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
    UNIQUE (mock_exam_id, version_number),
    UNIQUE (id, mock_exam_id)
);

CREATE INDEX idx_mock_exam_versions_exam
    ON mock_exam_versions(mock_exam_id, version_number DESC);

ALTER TABLE mock_exams
    ADD COLUMN available_from TIMESTAMPTZ,
    ADD COLUMN closes_at TIMESTAMPTZ,
    ADD COLUMN calculator_mode TEXT NOT NULL DEFAULT 'none'
        CHECK (calculator_mode IN ('none', 'basic', 'scientific')),
    ADD COLUMN shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN shuffle_options BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN result_release_mode TEXT NOT NULL DEFAULT 'score_only'
        CHECK (result_release_mode IN (
            'score_only',
            'immediately_with_corrections',
            'after_close',
            'after_theory_grading'
        )),
    ADD COLUMN pass_mark NUMERIC(5,2)
        CHECK (pass_mark IS NULL OR (pass_mark >= 0 AND pass_mark <= 100)),
    ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
    ADD CONSTRAINT mock_exams_availability_window_check
        CHECK (closes_at IS NULL OR available_from IS NULL OR closes_at > available_from);

CREATE TABLE mock_version_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    mock_exam_version_id UUID NOT NULL REFERENCES mock_exam_versions(id) ON DELETE RESTRICT,
    question_version_id UUID NOT NULL REFERENCES bank_question_versions(id) ON DELETE RESTRICT,
    section_title TEXT NOT NULL,
    section_order_index INTEGER NOT NULL CHECK (section_order_index >= 0),
    order_index INTEGER NOT NULL CHECK (order_index >= 0),
    marks NUMERIC(8,2) NOT NULL CHECK (marks > 0),
    UNIQUE (mock_exam_version_id, section_order_index, order_index),
    UNIQUE (id, mock_exam_version_id)
);

CREATE INDEX idx_mock_version_questions_version
    ON mock_version_questions(mock_exam_version_id, section_order_index, order_index);

ALTER TABLE mock_attempts
    ADD COLUMN mock_exam_version_id UUID REFERENCES mock_exam_versions(id) ON DELETE RESTRICT,
    ADD COLUMN attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
    ADD COLUMN deadline_at TIMESTAMPTZ,
    ADD COLUMN last_saved_at TIMESTAMPTZ,
    ADD COLUMN finalized_at TIMESTAMPTZ,
    ADD COLUMN submission_reason TEXT
        CHECK (submission_reason IS NULL OR submission_reason IN ('student', 'timeout', 'admin'));

ALTER TABLE mock_attempts
    DROP CONSTRAINT mock_attempts_mock_exam_id_student_id_key;

CREATE UNIQUE INDEX uq_mock_attempts_legacy_exam_student
    ON mock_attempts(mock_exam_id, student_id)
    WHERE mock_exam_version_id IS NULL;

CREATE UNIQUE INDEX uq_mock_attempts_version_student_number
    ON mock_attempts(mock_exam_version_id, student_id, attempt_number)
    WHERE mock_exam_version_id IS NOT NULL;

CREATE TABLE mock_attempt_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    mock_exam_version_id UUID NOT NULL REFERENCES mock_exam_versions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    additional_attempts INTEGER NOT NULL DEFAULT 1 CHECK (additional_attempts > 0),
    reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES user_profiles(id) ON DELETE RESTRICT
);

CREATE INDEX idx_mock_attempt_grants_version_student
    ON mock_attempt_grants(mock_exam_version_id, student_id)
    WHERE revoked_at IS NULL;

ALTER TABLE mock_answers
    ADD COLUMN mock_version_question_id UUID REFERENCES mock_version_questions(id) ON DELETE RESTRICT,
    ADD COLUMN selected_option_version_id UUID REFERENCES bank_question_option_versions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_mock_answers_attempt_version_question
    ON mock_answers(attempt_id, mock_version_question_id)
    WHERE mock_version_question_id IS NOT NULL;

-- These tables are accessed by the Hono service, not directly from Next.js.
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_stimuli ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_question_option_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_question_version_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_stimulus_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_section_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_question_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_exam_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_version_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_attempt_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE question_banks, question_stimuli, question_media,
    bank_questions, bank_question_versions, bank_question_option_versions,
    bank_question_version_media, question_stimulus_media,
    mock_sections, mock_section_questions, mock_question_rules,
    mock_exam_versions, mock_version_questions, mock_attempt_grants
    FROM anon, authenticated;

GRANT ALL ON TABLE question_banks, question_stimuli, question_media,
    bank_questions, bank_question_versions, bank_question_option_versions,
    bank_question_version_media, question_stimulus_media,
    mock_sections, mock_section_questions, mock_question_rules,
    mock_exam_versions, mock_version_questions, mock_attempt_grants
    TO service_role;

-- Reuse the canonical timestamp trigger function introduced by the initial schema.
CREATE TRIGGER trg_question_banks_updated_at
    BEFORE UPDATE ON question_banks
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_question_stimuli_updated_at
    BEFORE UPDATE ON question_stimuli
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_bank_questions_updated_at
    BEFORE UPDATE ON bank_questions
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_mock_sections_updated_at
    BEFORE UPDATE ON mock_sections
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_mock_question_rules_updated_at
    BEFORE UPDATE ON mock_question_rules
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
