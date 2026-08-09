-- Adaptive JAMB mocks contain several subject sections but generate one
-- immutable question set per student attempt. A student sees only the courses
-- in their saved programme subject combination (normally four).

ALTER TABLE public.mock_exams
    ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'fixed',
    ADD CONSTRAINT mock_exams_delivery_mode_check
      CHECK (delivery_mode IN ('fixed', 'subject_combination'));

ALTER TABLE public.mock_version_questions
    ADD COLUMN section_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX idx_mock_version_questions_section_course
    ON public.mock_version_questions (mock_exam_version_id, section_course_id);

CREATE TABLE public.student_programme_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    UNIQUE (student_id, programme_id, course_id)
);

CREATE INDEX idx_student_programme_subjects_student
    ON public.student_programme_subjects (school_id, student_id, programme_id);

CREATE TABLE public.mock_attempt_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES public.mock_attempts(id) ON DELETE CASCADE,
    mock_version_question_id UUID NOT NULL REFERENCES public.mock_version_questions(id) ON DELETE RESTRICT,
    UNIQUE (attempt_id, mock_version_question_id)
);

CREATE INDEX idx_mock_attempt_questions_attempt
    ON public.mock_attempt_questions (attempt_id, mock_version_question_id);

ALTER TABLE public.student_programme_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_attempt_questions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_programme_subjects, public.mock_attempt_questions
    TO service_role;

COMMENT ON COLUMN public.mock_exams.delivery_mode IS
    'fixed shows all sections; subject_combination snapshots only sections matching a student’s programme subject choices.';

COMMENT ON COLUMN public.mock_version_questions.section_course_id IS
    'Course/subject represented by the source section, copied into the immutable version.';

-- Populate the section's course automatically whenever a version is frozen.
-- This keeps the immutable version independent of later draft edits.
CREATE OR REPLACE FUNCTION public.assign_version_question_section_course()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  SELECT section.course_id INTO NEW.section_course_id
  FROM mock_exam_versions version
  JOIN mock_sections section ON section.mock_exam_id = version.mock_exam_id
    AND section.school_id = version.school_id
    AND section.order_index = NEW.section_order_index
  WHERE version.id = NEW.mock_exam_version_id
    AND version.school_id = NEW.school_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mock_version_questions_section_course
  BEFORE INSERT ON public.mock_version_questions
  FOR EACH ROW EXECUTE FUNCTION public.assign_version_question_section_course();

UPDATE public.mock_version_questions question
SET section_course_id = section.course_id
FROM public.mock_exam_versions version
JOIN public.mock_sections section ON section.mock_exam_id = version.mock_exam_id
  AND section.school_id = version.school_id
  AND section.order_index = question.section_order_index
WHERE question.mock_exam_version_id = version.id
  AND question.school_id = version.school_id;

-- Every attempt has an immutable list of questions. Fixed mocks include their
-- full version; adaptive JAMB mocks include only sections matching the
-- student's saved four-course programme combination.
CREATE OR REPLACE FUNCTION public.snapshot_mock_attempt_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  delivery TEXT;
  target_programme UUID;
  selected_count INTEGER;
  inserted_count INTEGER;
BEGIN
  SELECT mock.delivery_mode, mock.programme_id INTO delivery, target_programme
  FROM mock_exams mock WHERE mock.id = NEW.mock_exam_id AND mock.school_id = NEW.school_id;

  IF delivery = 'subject_combination' THEN
    IF target_programme IS NULL OR NOT EXISTS (
      SELECT 1 FROM enrolments enrolment
      WHERE enrolment.school_id = NEW.school_id AND enrolment.student_id = NEW.student_id
        AND enrolment.programme_id = target_programme
    ) THEN
      RAISE EXCEPTION 'PROGRAMME_ENROLMENT_REQUIRED';
    END IF;
    SELECT count(*) INTO selected_count FROM student_programme_subjects selection
    WHERE selection.school_id = NEW.school_id AND selection.student_id = NEW.student_id
      AND selection.programme_id = target_programme;
    IF selected_count <> 4 THEN RAISE EXCEPTION 'STUDENT_SUBJECTS_NOT_SET'; END IF;

    INSERT INTO mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
    SELECT NEW.school_id, NEW.id, question.id
    FROM mock_version_questions question
    WHERE question.school_id = NEW.school_id AND question.mock_exam_version_id = NEW.mock_exam_version_id
      AND EXISTS (
        SELECT 1 FROM student_programme_subjects selection
        WHERE selection.school_id = NEW.school_id AND selection.student_id = NEW.student_id
          AND selection.programme_id = target_programme AND selection.course_id = question.section_course_id
      );
  ELSE
    INSERT INTO mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
    SELECT NEW.school_id, NEW.id, question.id
    FROM mock_version_questions question
    WHERE question.school_id = NEW.school_id AND question.mock_exam_version_id = NEW.mock_exam_version_id;
  END IF;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN RAISE EXCEPTION 'MOCK_HAS_NO_QUESTIONS_FOR_SUBJECTS'; END IF;

  UPDATE mock_attempts attempt SET
    total_mcq_questions = (
      SELECT count(*) FROM mock_attempt_questions snapshot
      JOIN mock_version_questions question ON question.id = snapshot.mock_version_question_id
      JOIN bank_question_versions question_version ON question_version.id = question.question_version_id
      JOIN bank_questions bank_question ON bank_question.id = question_version.question_id
      WHERE snapshot.attempt_id = NEW.id AND bank_question.question_type = 'mcq'
    ),
    total_marks = (
      SELECT COALESCE(sum(question.marks), 0) FROM mock_attempt_questions snapshot
      JOIN mock_version_questions question ON question.id = snapshot.mock_version_question_id
      WHERE snapshot.attempt_id = NEW.id
    )
  WHERE attempt.id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mock_attempt_questions_snapshot
  AFTER INSERT ON public.mock_attempts
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_mock_attempt_questions();

CREATE OR REPLACE FUNCTION public.enforce_mock_attempt_question_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.mock_version_question_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM mock_attempt_questions snapshot
    WHERE snapshot.attempt_id = NEW.attempt_id
      AND snapshot.mock_version_question_id = NEW.mock_version_question_id
  ) THEN RAISE EXCEPTION 'ATTEMPT_QUESTION_NOT_FOUND'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mock_answers_attempt_question_snapshot
  BEFORE INSERT OR UPDATE OF mock_version_question_id ON public.mock_answers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mock_attempt_question_snapshot();

CREATE OR REPLACE FUNCTION public.recalculate_mock_attempt_snapshot_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'timed_out', 'fully_graded') THEN
    UPDATE mock_attempts attempt SET
      total_mcq_questions = (
        SELECT count(*) FROM mock_attempt_questions snapshot
        JOIN mock_version_questions question ON question.id = snapshot.mock_version_question_id
        JOIN bank_question_versions question_version ON question_version.id = question.question_version_id
        JOIN bank_questions bank_question ON bank_question.id = question_version.question_id
        WHERE snapshot.attempt_id = NEW.id AND bank_question.question_type = 'mcq'
      ),
      total_marks = (
        SELECT COALESCE(sum(question.marks), 0) FROM mock_attempt_questions snapshot
        JOIN mock_version_questions question ON question.id = snapshot.mock_version_question_id
        WHERE snapshot.attempt_id = NEW.id
      )
    WHERE attempt.id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mock_attempt_snapshot_totals
  AFTER UPDATE OF status ON public.mock_attempts
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_mock_attempt_snapshot_totals();

-- An unanswered theory question still needs a gradeable answer row. Without
-- this, tutors cannot give it zero and an attempt can never become fully
-- graded. The row is created only after the attempt is finalised.
CREATE OR REPLACE FUNCTION public.create_unanswered_theory_answers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'timed_out') AND OLD.status = 'in_progress' THEN
    INSERT INTO mock_answers (school_id, attempt_id, mock_version_question_id, theory_answer_text, is_flagged, saved_at)
    SELECT NEW.school_id, NEW.id, snapshot.mock_version_question_id, NULL, false, NEW.submitted_at
    FROM mock_attempt_questions snapshot
    JOIN mock_version_questions question ON question.id = snapshot.mock_version_question_id
    JOIN bank_question_versions question_version ON question_version.id = question.question_version_id
    JOIN bank_questions bank_question ON bank_question.id = question_version.question_id
    WHERE snapshot.attempt_id = NEW.id AND bank_question.question_type = 'theory'
      AND NOT EXISTS (
        SELECT 1 FROM mock_answers answer
        WHERE answer.attempt_id = NEW.id AND answer.mock_version_question_id = snapshot.mock_version_question_id
      )
    ON CONFLICT (attempt_id, mock_version_question_id) WHERE mock_version_question_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mock_attempt_unanswered_theory_answers
  AFTER UPDATE OF status ON public.mock_attempts
  FOR EACH ROW EXECUTE FUNCTION public.create_unanswered_theory_answers();

-- Existing attempts predate per-attempt snapshots, so preserve their complete
-- historical version before enforcing the answer constraint.
INSERT INTO public.mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
SELECT attempt.school_id, attempt.id, question.id
FROM public.mock_attempts attempt
JOIN public.mock_version_questions question ON question.mock_exam_version_id = attempt.mock_exam_version_id
  AND question.school_id = attempt.school_id
ON CONFLICT (attempt_id, mock_version_question_id) DO NOTHING;
