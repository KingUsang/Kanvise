-- Centre mocks have one explicit audience. This replaces the old assumption
-- that every centre mock is visible only through one course, while retaining
-- that behaviour for all existing mocks.

ALTER TABLE public.mock_exams
    ADD COLUMN audience_scope TEXT NOT NULL DEFAULT 'course',
    ADD COLUMN programme_id UUID;

ALTER TABLE public.mock_exams
    ADD CONSTRAINT mock_exams_audience_scope_check
    CHECK (audience_scope IN ('course', 'programme', 'school', 'marketplace'));

ALTER TABLE public.mock_exams
    ADD CONSTRAINT mock_exams_programme_id_fkey
    FOREIGN KEY (programme_id) REFERENCES public.programmes(id) ON DELETE SET NULL;

-- Public-only mocks predate centre audiences. Preserve them while the
-- marketplace is still present; centre and both-distribution mocks retain
-- their current course audience.
UPDATE public.mock_exams
SET audience_scope = 'marketplace'
WHERE distribution_mode = 'marketplace';

ALTER TABLE public.mock_exams
    DROP CONSTRAINT IF EXISTS mock_exams_centre_distribution_requires_course_check;

ALTER TABLE public.mock_exams
    ADD CONSTRAINT mock_exams_centre_audience_target_check
    CHECK (
      (audience_scope = 'course' AND course_id IS NOT NULL AND programme_id IS NULL)
      OR (audience_scope = 'programme' AND course_id IS NULL AND programme_id IS NOT NULL)
      OR (audience_scope = 'school' AND course_id IS NULL AND programme_id IS NULL)
      OR (audience_scope = 'marketplace' AND distribution_mode = 'marketplace'
          AND course_id IS NULL AND programme_id IS NULL)
    );

CREATE INDEX idx_mock_exams_school_audience
    ON public.mock_exams (school_id, audience_scope, status);

CREATE INDEX idx_mock_exams_programme_audience
    ON public.mock_exams (school_id, programme_id)
    WHERE audience_scope = 'programme';

COMMENT ON COLUMN public.mock_exams.audience_scope IS
    'Exactly one audience: course, programme, school (all active centre students), or legacy marketplace.';

COMMENT ON COLUMN public.mock_exams.programme_id IS
    'Target programme when audience_scope is programme; null for all other scopes.';
