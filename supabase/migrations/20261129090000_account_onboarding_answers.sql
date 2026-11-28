-- Onboarding answers (02 ONB-02 to ONB-09; 20 DM-14). One row per tutoring
-- account, written when the owner finishes or skips the scripted questions.
-- Invited tutors read the account's row; nothing is stored per tutor.

CREATE TABLE IF NOT EXISTS public.account_onboarding_answers (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  teaching_mode text NOT NULL DEFAULT 'solo',
  audience text NOT NULL DEFAULT 'both',
  class_format text NOT NULL DEFAULT 'both',
  subjects text[] NOT NULL DEFAULT '{}',
  has_students boolean NOT NULL DEFAULT false,
  -- True when any answer fell back to its ONB-09 default (skipped or save failed).
  used_defaults boolean NOT NULL DEFAULT false,
  -- Setup steps the owner chose to skip. Only the course plan step can be skipped.
  skipped_steps text[] NOT NULL DEFAULT '{}',
  answered_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_onboarding_answers_teaching_mode_check CHECK (teaching_mode IN ('solo', 'team')),
  CONSTRAINT account_onboarding_answers_audience_check CHECK (audience IN ('children_teens', 'adults', 'both')),
  CONSTRAINT account_onboarding_answers_class_format_check CHECK (class_format IN ('one_to_one', 'small_groups', 'both')),
  CONSTRAINT account_onboarding_answers_subjects_check CHECK (cardinality(subjects) <= 10),
  CONSTRAINT account_onboarding_answers_skipped_steps_check CHECK (skipped_steps <@ ARRAY['course_plan']::text[])
);

ALTER TABLE public.account_onboarding_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_onboarding_answers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_onboarding_answers TO service_role;
