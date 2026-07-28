-- Existing tutorial centres can bring their students onto Kanvise before every
-- learner has activated a login. Payment-confirmed enrolments remain unchanged;
-- admin imports are a separate, auditable source for the same enrolment record.
ALTER TABLE user_profiles
  ALTER COLUMN supabase_auth_id DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'active'
    CHECK (onboarding_status IN ('not_invited', 'invited', 'active')),
  ADD COLUMN IF NOT EXISTS onboarding_source TEXT NOT NULL DEFAULT 'self_signup'
    CHECK (onboarding_source IN ('self_signup', 'admin_import')),
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_school_onboarding_status
  ON user_profiles(school_id, onboarding_status)
  WHERE role = 'student';

ALTER TABLE enrolments
  ALTER COLUMN payment_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'payment'
    CHECK (source IN ('payment', 'admin_import')),
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

ALTER TABLE enrolments
  ADD CONSTRAINT enrolments_source_payment_check
  CHECK (
    (source = 'payment' AND payment_id IS NOT NULL)
    OR (source = 'admin_import' AND payment_id IS NULL)
  ) NOT VALID;

ALTER TABLE enrolments VALIDATE CONSTRAINT enrolments_source_payment_check;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_import_programme_enrolment
  ON enrolments(student_id, programme_id)
  WHERE source = 'admin_import' AND programme_id IS NOT NULL;
