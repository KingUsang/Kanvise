
-- Marketplace foundation: a mock can be distributed publicly without belonging
-- to a centre course. All existing mocks remain centre-distributed.
--
-- This deliberately changes only mock_exams. Classes, notes, assignments,
-- enrolments, and tutor_course_assignments remain course-bound.

ALTER TABLE mock_exams
    ADD COLUMN distribution_mode TEXT NOT NULL DEFAULT 'centre';

ALTER TABLE mock_exams
    ADD CONSTRAINT mock_exams_distribution_mode_check
    CHECK (distribution_mode IN ('centre', 'marketplace', 'both'));

ALTER TABLE mock_exams
    DROP CONSTRAINT IF EXISTS mock_exams_course_id_fkey;

ALTER TABLE mock_exams
    ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE mock_exams
    ADD CONSTRAINT mock_exams_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE mock_exams
    ADD CONSTRAINT mock_exams_centre_distribution_requires_course_check
    CHECK (distribution_mode = 'marketplace' OR course_id IS NOT NULL);

ALTER TABLE mock_exams
    ADD COLUMN marketplace_approval_status TEXT NOT NULL DEFAULT 'not_requested',
    ADD COLUMN marketplace_submitted_at TIMESTAMPTZ,
    ADD COLUMN marketplace_approved_at TIMESTAMPTZ,
    ADD COLUMN marketplace_approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN marketplace_rejection_reason TEXT;

ALTER TABLE mock_exams
    ADD CONSTRAINT mock_exams_marketplace_approval_status_check
    CHECK (marketplace_approval_status IN ('not_requested', 'pending', 'approved', 'rejected'));

CREATE INDEX idx_mock_exams_school_distribution_mode
    ON mock_exams (school_id, distribution_mode);

CREATE INDEX idx_mock_exams_marketplace_approval
    ON mock_exams (school_id, marketplace_approval_status)
    WHERE distribution_mode IN ('marketplace', 'both');

COMMENT ON COLUMN mock_exams.distribution_mode IS
    'Audience for a mock: centre requires a course; marketplace may omit one; both supports both access paths.';

COMMENT ON COLUMN mock_exams.marketplace_approval_status IS
    'Tutor marketplace submissions require centre-admin approval; admins and solo tutor-admins publish directly.';
