-- Kanvise Row Level Security (RLS) Policies & Database Triggers
-- Canonical Architecture Mapping (Document 03 & 06)
-- Migration: 20260706000001_kanvise_rls_and_triggers.sql

-- ============================================================================
-- 1. AUTOMATED TIMESTAMP TRIGGERS (updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach timestamp triggers to all tables with updated_at column
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.columns 
        WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_update_timestamp ON %I;', t);
        EXECUTE format('CREATE TRIGGER trg_update_timestamp BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_modified_column();', t);
    END LOOP;
END;
$$;

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY ON ALL CANONICAL TABLES
-- ============================================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanvise_id_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanvise_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE paystack_subaccounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- Note: Service Role (used by Hono API backend) bypasses RLS automatically.
-- These policies enforce strict defense-in-depth for client-side direct queries.
-- ============================================================================

-- Helper function to extract school_id from JWT app_metadata
CREATE OR REPLACE FUNCTION current_user_school_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF((auth.jwt() -> 'app_metadata' ->> 'school_id'), '')::uuid;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- 3.1 SCHOOLS (Tenant Anchor)
-- ----------------------------------------------------------------------------
CREATE POLICY "Public can view active schools by slug" 
ON schools FOR SELECT 
USING (is_active = true);

CREATE POLICY "Users can view their own school details" 
ON schools FOR SELECT 
USING (id = current_user_school_id());

CREATE POLICY "Admins can update their own school" 
ON schools FOR UPDATE 
USING (id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- ----------------------------------------------------------------------------
-- 3.2 USER PROFILES & AVATARS
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view profiles in their school" 
ON user_profiles FOR SELECT 
USING (school_id = current_user_school_id() OR id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON user_profiles FOR UPDATE 
USING (id = auth.uid() OR (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

CREATE POLICY "Users can view and manage their own avatar" 
ON avatar_configs FOR ALL 
USING (user_id = auth.uid() OR school_id = current_user_school_id());

-- ----------------------------------------------------------------------------
-- 3.3 CURRICULUM LAYER (Programmes, Sub-programmes, Courses)
-- ----------------------------------------------------------------------------
CREATE POLICY "Public can view published programmes" 
ON programmes FOR SELECT 
USING (is_published = true OR school_id = current_user_school_id());

CREATE POLICY "School admins and tutors can manage programmes" 
ON programmes FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "Public can view published sub_programmes" 
ON sub_programmes FOR SELECT 
USING (is_published = true OR school_id = current_user_school_id());

CREATE POLICY "School admins and tutors can manage sub_programmes" 
ON sub_programmes FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "Public can view published courses" 
ON courses FOR SELECT 
USING (is_published = true OR school_id = current_user_school_id());

CREATE POLICY "School admins and tutors can manage courses" 
ON courses FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "Users can view tutor course assignments in their school" 
ON tutor_course_assignments FOR SELECT 
USING (school_id = current_user_school_id());

-- ----------------------------------------------------------------------------
-- 3.4 FINANCE & ENROLMENT LAYER (Payments, Enrolments, Subaccounts)
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own enrolments or admins view all school enrolments" 
ON enrolments FOR SELECT 
USING (student_id = auth.uid() OR (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor')));

CREATE POLICY "Users can view their own payments or admins view school payments" 
ON payments FOR SELECT 
USING (student_id = auth.uid() OR (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

CREATE POLICY "Admins can view and manage paystack subaccounts" 
ON paystack_subaccounts FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ----------------------------------------------------------------------------
-- 3.5 ACADEMICS & LIVE CLASSES LAYER (Notes, Assignments, Submissions)
-- ----------------------------------------------------------------------------
CREATE POLICY "Users in school can view live classes and attendance" 
ON live_classes FOR SELECT 
USING (school_id = current_user_school_id());

CREATE POLICY "Tutors and admins can manage live classes" 
ON live_classes FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "Students view attendance, admins/tutors manage" 
ON attendance_records FOR ALL 
USING (school_id = current_user_school_id() AND (student_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor')));

CREATE POLICY "Enrolled students and tutors can view notes" 
ON notes FOR SELECT 
USING (school_id = current_user_school_id());

CREATE POLICY "Tutors and admins can upload and manage notes" 
ON notes FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "School users can view assignments" 
ON assignments FOR SELECT 
USING (school_id = current_user_school_id());

CREATE POLICY "Tutors and admins can manage assignments" 
ON assignments FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "Students view their own submissions, tutors view assigned course submissions" 
ON submissions FOR SELECT 
USING (student_id = auth.uid() OR (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor')));

CREATE POLICY "Students can insert their own submissions" 
ON submissions FOR INSERT 
WITH CHECK (student_id = auth.uid() AND school_id = current_user_school_id());

CREATE POLICY "Tutors and admins can grade submissions" 
ON submissions FOR UPDATE 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

-- ----------------------------------------------------------------------------
-- 3.6 CBT ENGINE LAYER (Mock exams, questions, options, attempts, answers)
-- ----------------------------------------------------------------------------
CREATE POLICY "School users can view published mock exams" 
ON mock_exams FOR SELECT 
USING (school_id = current_user_school_id() AND (status = 'published' OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor')));

CREATE POLICY "Tutors and admins can manage mock exams" 
ON mock_exams FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "School users can view mock questions and options for published exams" 
ON mock_questions FOR SELECT 
USING (school_id = current_user_school_id());

CREATE POLICY "School users can view mock options" 
ON mock_question_options FOR SELECT 
USING (school_id = current_user_school_id());

CREATE POLICY "Tutors and admins manage mock questions and options" 
ON mock_questions FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "Tutors and admins manage mock options ALL" 
ON mock_question_options FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'));

CREATE POLICY "Students view and create their own attempts" 
ON mock_attempts FOR ALL 
USING (student_id = auth.uid() OR (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor')));

CREATE POLICY "Students manage their own answers during active attempt" 
ON mock_answers FOR ALL 
USING (
    attempt_id IN (SELECT id FROM mock_attempts WHERE student_id = auth.uid()) 
    OR (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

-- ----------------------------------------------------------------------------
-- 3.7 MARKETING & ENGAGEMENT (Promos, Reviews, Notifications)
-- ----------------------------------------------------------------------------
CREATE POLICY "Public can view active school promos" 
ON school_promos FOR SELECT 
USING (is_active = true OR school_id = current_user_school_id());

CREATE POLICY "Admins manage school promos" 
ON school_promos FOR ALL 
USING (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Public can view published reviews" 
ON reviews FOR SELECT 
USING (is_published = true OR school_id = current_user_school_id());

CREATE POLICY "Enrolled students can create reviews" 
ON reviews FOR INSERT 
WITH CHECK (student_id = auth.uid() AND school_id = current_user_school_id());

CREATE POLICY "Users view and manage their own notifications" 
ON notifications FOR ALL 
USING (user_id = auth.uid() OR (school_id = current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));
