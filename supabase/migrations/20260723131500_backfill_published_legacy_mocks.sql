-- Move valid mocks published before the versioned CBT engine into immutable
-- snapshots. Empty legacy mocks cannot become valid exam versions, so return
-- them to draft instead of exposing an exam that students cannot take.
do $$
declare
  legacy_mock record;
  questions jsonb;
begin
  for legacy_mock in
    select me.id, me.school_id, me.tutor_id, me.publish_at
    from mock_exams me
    where me.status = 'published'
      and not exists (
        select 1 from mock_exam_versions mev where mev.mock_exam_id = me.id
      )
  loop
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'question_type', mq.question_type,
        'question_text', mq.question_text,
        'marks', mq.marks,
        'grading_rubric', mq.grading_rubric,
        'options', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'option_text', mqo.option_text,
              'is_correct', mqo.is_correct
            )
            order by mqo.order_index
          )
          from mock_question_options mqo
          where mqo.question_id = mq.id
        ), '[]'::jsonb)
      )
      order by mq.order_index
    ), '[]'::jsonb)
    into questions
    from mock_questions mq
    where mq.mock_exam_id = legacy_mock.id
      and mq.school_id = legacy_mock.school_id;

    if jsonb_array_length(questions) = 0 then
      update mock_exams
      set status = 'draft', publish_at = null, updated_at = now()
      where id = legacy_mock.id and school_id = legacy_mock.school_id;
      continue;
    end if;

    update mock_exams
    set status = 'draft'
    where id = legacy_mock.id and school_id = legacy_mock.school_id;

    perform *
    from replace_authored_mock_questions(
      legacy_mock.school_id,
      legacy_mock.id,
      legacy_mock.tutor_id,
      questions
    );

    perform *
    from publish_versioned_mock(
      legacy_mock.school_id,
      legacy_mock.id,
      legacy_mock.tutor_id,
      legacy_mock.publish_at
    );
  end loop;
end
$$;
