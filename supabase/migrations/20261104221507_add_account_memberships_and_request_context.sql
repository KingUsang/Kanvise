-- Batch D Wave 1: introduce the general person -> tutoring-account
-- membership model without removing the legacy profile/account projection.
--
-- This is an expand-and-backfill migration. The legacy role, school_id and
-- student_centre_memberships columns remain in place for compatibility while
-- Hono moves protected reads to account_memberships.

CREATE TABLE public.account_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  person_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'tutor', 'learner')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'suspended')),
  source text NOT NULL DEFAULT 'legacy_backfill'
    CHECK (source IN ('legacy_backfill', 'student_membership', 'invitation', 'api')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (person_id, school_id),
  CONSTRAINT account_memberships_revocation_consistency CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status IN ('revoked', 'suspended') AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX account_memberships_person_status_idx
  ON public.account_memberships (person_id, status, school_id);
CREATE INDEX account_memberships_school_status_role_idx
  ON public.account_memberships (school_id, status, role, person_id);

-- Staff profiles already represented by the legacy account projection become
-- account memberships. Learners are populated from the dedicated membership
-- table below so a learner can carry memberships in more than one account.
INSERT INTO public.account_memberships (person_id, school_id, role, status, source, revoked_at)
SELECT profile.id,
       profile.school_id,
       profile.role,
       CASE WHEN profile.is_active THEN 'active' ELSE 'suspended' END,
       'legacy_backfill',
       CASE WHEN profile.is_active THEN NULL ELSE now() END
FROM public.user_profiles AS profile
WHERE profile.school_id IS NOT NULL
  AND profile.role IN ('admin', 'tutor')
ON CONFLICT (person_id, school_id) DO NOTHING;

INSERT INTO public.account_memberships (person_id, school_id, role, status, source, revoked_at)
SELECT legacy.student_id,
       legacy.school_id,
       'learner',
       CASE
         WHEN legacy.status = 'active' AND profile.is_active THEN 'active'
         ELSE 'revoked'
       END,
       'student_membership',
       CASE
         WHEN legacy.status = 'active' AND profile.is_active THEN NULL
         ELSE COALESCE(legacy.revoked_at, now())
       END
FROM public.student_centre_memberships AS legacy
JOIN public.user_profiles AS profile ON profile.id = legacy.student_id
ON CONFLICT (person_id, school_id) DO UPDATE
SET role = EXCLUDED.role,
    status = EXCLUDED.status,
    source = EXCLUDED.source,
    revoked_at = EXCLUDED.revoked_at,
    updated_at = now();

-- The old Learner membership table remains a compatibility write surface until
-- all callers migrate. Keep it synchronized with the canonical membership.
CREATE OR REPLACE FUNCTION public.sync_account_membership_from_legacy_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.account_memberships (
    person_id, school_id, role, status, source, joined_at, revoked_at, updated_at
  )
  VALUES (
    NEW.student_id,
    NEW.school_id,
    'learner',
    CASE WHEN NEW.status = 'active' THEN 'active' ELSE 'revoked' END,
    'student_membership',
    NEW.joined_at,
    CASE WHEN NEW.status = 'active' THEN NULL ELSE COALESCE(NEW.revoked_at, now()) END,
    now()
  )
  ON CONFLICT (person_id, school_id) DO UPDATE
  SET role = 'learner',
      status = EXCLUDED.status,
      source = 'student_membership',
      revoked_at = EXCLUDED.revoked_at,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_account_membership_from_legacy_student
  ON public.student_centre_memberships;
CREATE TRIGGER sync_account_membership_from_legacy_student
AFTER INSERT OR UPDATE OF student_id, school_id, status, revoked_at
ON public.student_centre_memberships
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_membership_from_legacy_student();

-- Existing account-scoped relationships are evidence that the person was
-- already associated with that account in the legacy model. Preserve those
-- rows and make the inferred membership explicit before validating the new
-- composite constraints. ON CONFLICT keeps an existing role/status decision
-- authoritative; this does not rewrite or delete a relationship row.
INSERT INTO public.account_memberships (person_id, school_id, role, status, source, revoked_at)
SELECT DISTINCT relationship.student_id,
       relationship.school_id,
       'learner',
       CASE WHEN profile.is_active THEN 'active' ELSE 'suspended' END,
       'legacy_backfill',
       CASE WHEN profile.is_active THEN NULL ELSE now() END
FROM (
  SELECT enrolment.student_id, enrolment.school_id
  FROM public.enrolments AS enrolment
  UNION
  SELECT selection.student_id, selection.school_id
  FROM public.student_programme_subjects AS selection
) AS relationship
JOIN public.user_profiles AS profile ON profile.id = relationship.student_id
ON CONFLICT (person_id, school_id) DO NOTHING;

-- Fail with a diagnostic instead of silently dropping or reassigning any
-- historical relationship if the compatibility backfill ever changes.
DO $$
DECLARE
  unresolved_count bigint;
BEGIN
  SELECT count(*)
  INTO unresolved_count
  FROM (
    SELECT enrolment.student_id, enrolment.school_id
    FROM public.enrolments AS enrolment
    UNION
    SELECT selection.student_id, selection.school_id
    FROM public.student_programme_subjects AS selection
  ) AS relationship
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.account_memberships AS membership
    WHERE membership.person_id = relationship.student_id
      AND membership.school_id = relationship.school_id
  );

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'ACCOUNT_MEMBERSHIP_BACKFILL_INCOMPLETE: % historical relationship(s) have no membership',
      unresolved_count;
  END IF;
END;
$$;

-- Add the constraints without holding a validation scan in the ALTER TABLE
-- lock, then validate them explicitly after the deterministic reconciliation.
-- This keeps the rollout expand/migrate/contract-safe while still failing the
-- migration if any historical row cannot be proven tenant-consistent.
ALTER TABLE public.enrolments
  ADD CONSTRAINT enrolments_account_membership_fkey
  FOREIGN KEY (student_id, school_id)
  REFERENCES public.account_memberships (person_id, school_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.student_programme_subjects
  ADD CONSTRAINT student_programme_subjects_account_membership_fkey
  FOREIGN KEY (student_id, school_id)
  REFERENCES public.account_memberships (person_id, school_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.enrolments
  VALIDATE CONSTRAINT enrolments_account_membership_fkey;

ALTER TABLE public.student_programme_subjects
  VALIDATE CONSTRAINT student_programme_subjects_account_membership_fkey;

-- Keep the existing enrolment compatibility trigger, but harden its function
-- boundary and ensure its legacy write also creates the canonical membership.
CREATE OR REPLACE FUNCTION public.attach_enrolment_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.membership_id IS NULL THEN
    INSERT INTO public.student_centre_memberships(student_id, school_id, source)
    VALUES (NEW.student_id, NEW.school_id, 'enrolment')
    ON CONFLICT (student_id, school_id)
    DO UPDATE SET status = 'active', revoked_at = NULL, updated_at = now();
    SELECT membership.id
    INTO NEW.membership_id
    FROM public.student_centre_memberships AS membership
    WHERE membership.student_id = NEW.student_id
      AND membership.school_id = NEW.school_id
      AND membership.status = 'active';
  END IF;
  IF NEW.membership_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_CENTRE_MEMBERSHIP_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_account_membership_from_legacy_student() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_account_membership_from_legacy_student() TO service_role;
REVOKE ALL ON FUNCTION public.attach_enrolment_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_enrolment_membership() TO service_role;

ALTER TABLE public.account_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_memberships FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_memberships TO service_role;
