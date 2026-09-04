-- A mock's structure and access are independent. Centre learners see only
-- their matching subjects; direct links are for anyone granted an entitlement.
ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS direct_link_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.mock_exams
  DROP CONSTRAINT IF EXISTS mock_exams_audience_scope_check,
  DROP CONSTRAINT IF EXISTS mock_exams_centre_audience_target_check,
  ADD CONSTRAINT mock_exams_audience_scope_check
    CHECK (audience_scope IN ('course', 'combination', 'direct_link', 'programme', 'school')),
  ADD CONSTRAINT mock_exams_centre_audience_target_check
    CHECK (
      (audience_scope = 'course' AND course_id IS NOT NULL AND programme_id IS NULL)
      OR (audience_scope = 'programme' AND course_id IS NULL AND programme_id IS NOT NULL)
      OR (audience_scope IN ('school', 'combination', 'direct_link') AND course_id IS NULL AND programme_id IS NULL)
    );

-- A manual multi-subject mock has no programme. It deliberately snapshots all
-- author-selected sections. Legacy programme mocks retain their saved-subject
-- selection behaviour.
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

  IF delivery = 'subject_combination' AND target_programme IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM enrolments enrolment
      WHERE enrolment.school_id = NEW.school_id AND enrolment.student_id = NEW.student_id
        AND enrolment.programme_id = target_programme
    ) THEN RAISE EXCEPTION 'PROGRAMME_ENROLMENT_REQUIRED'; END IF;
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
