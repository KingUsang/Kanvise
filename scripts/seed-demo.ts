import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function assertNoError(error: { message: string } | null, step: string) {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function run() {
  console.log("Starting demo seed...");
  
  // 1. Clean up old demo school if it exists
  const { data: oldSchool } = await supabase.from('schools').select('id').eq('slug', 'pitch-demo').maybeSingle();
  if (oldSchool) {
    console.log("Deleting old demo school...");
    await supabase.from('schools').delete().eq('id', oldSchool.id);
  }

  // 2. Create School
  const { data: school, error: schoolErr } = await supabase.from('schools').insert({
    name: 'Pitch Demo Centre',
    slug: 'pitch-demo',
    account_type: 'centre',
    is_active: true
  }).select('id').single();
  
  if (schoolErr) throw schoolErr;
  console.log("School created:", school.id);

  // 3. Create Users
  const usersToCreate = [
    { name: 'Admin', email: 'admin@demo.com', role: 'admin' },
    { name: 'Tutor', email: 'tutor@demo.com', role: 'tutor' },
    { name: 'Emeka Okafor', email: 'emeka@demo.com', role: 'student' },
    { name: 'Ada', email: 'ada@demo.com', role: 'student' },
    { name: 'Tobi', email: 'tobi@demo.com', role: 'student' },
  ];

  const createdUsers: Record<string, any> = {};
  // Fetching the complete auth list for every learner made the deterministic
  // demo setup needlessly slow on the staging connection.
  const { data: existingUsersData, error: existingUsersError } = await supabase.auth.admin.listUsers();
  assertNoError(existingUsersError, 'Loading existing demo accounts');
  const existingUsersByEmail = new Map(
    (existingUsersData?.users ?? []).map(user => [user.email, user])
  );

  for (const u of usersToCreate) {
    const existing = existingUsersByEmail.get(u.email);
    const authAttributes = {
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { role: u.role, school_id: school.id, first_name: u.name.split(' ')[0], last_name: u.name.split(' ').slice(1).join(' ') }
    };
    const { data: authUser, error: authErr } = existing
      ? await supabase.auth.admin.updateUserById(existing.id, authAttributes)
      : await supabase.auth.admin.createUser({ email: u.email, ...authAttributes });
    if (authErr || !authUser?.user) throw authErr ?? new Error(`Could not create ${u.email}`);

    const [firstName, ...lastNames] = u.name.split(' ');
    
    let { data: profile } = await supabase.from('user_profiles').select('id, kanvise_user_id').eq('supabase_auth_id', authUser.user.id).maybeSingle();
    if (!profile) {
      const { data: pData, error: pErr } = await supabase.from('user_profiles').insert({
        supabase_auth_id: authUser.user.id,
        role: u.role,
        school_id: school.id,
        kanvise_user_id: `KNV-${u.role === "student" ? "STD" : u.role === "admin" ? "ADM" : "TUT"}-${Math.floor(Math.random()*10000).toString().padStart(4, "0")}`,
        first_name: firstName,
        last_name: lastNames.join(' ') || '',
        email: u.email
      }).select('id, kanvise_user_id').single();
      if (pErr) throw pErr;
      profile = pData;
    } else {
        const { error: updateError } = await supabase.from('user_profiles').update({
          role: u.role,
          school_id: school.id,
          first_name: firstName,
          last_name: lastNames.join(' ') || '',
          email: u.email,
        }).eq('id', profile.id);
        assertNoError(updateError, `Updating ${u.name}'s profile`);
    }
    // Auth claims are the server-side source used by the web middleware. They
    // must move with the re-seeded Pitch Demo Centre, not retain a prior run's
    // school ID (which sends a valid learner into an empty school session).
    const { error: claimsError } = await supabase.auth.admin.updateUserById(authUser.user.id, {
      app_metadata: {
        role: u.role,
        kanvise_role: u.role,
        school_id: school.id,
        profile_id: profile.id,
        kanvise_user_id: profile.kanvise_user_id,
      },
    });
    assertNoError(claimsError, `Updating ${u.name}'s auth claims`);
    
    createdUsers[u.name.split(' ')[0]] = profile;
    console.log(`Created ${u.name}`);
  }

  // 4. Create a class (persisted as the established programme model) and its
  // subjects. The class-first dashboard reads these exact existing records; it
  // does not have a separate demo-only data model.
  const { data: programme, error: programmeError } = await supabase.from('programmes').insert({
    school_id: school.id,
    name: 'JAMB 2027 Preparation',
    slug: 'jamb-2027-preparation',
    description: 'A focused multi-subject preparation class for the 2027 UTME.',
    price: 0,
    is_published: true,
    created_by: createdUsers['Tutor'].id,
  }).select('id').single();
  assertNoError(programmeError, 'Creating the demo class');
  if (!programme) throw new Error('Demo class was not created');

  // 5. Create the first subject.
  const { data: course, error: cErr } = await supabase.from('courses').insert({
    school_id: school.id,
    programme_id: programme.id,
    name: 'Physics',
    slug: 'physics',
    price: 0,
    is_published: true,
    created_by: createdUsers['Tutor'].id
  }).select('id').single();
  if (cErr) throw cErr;

  // Assign tutor
  const { error: assignmentError } = await supabase.from('tutor_course_assignments').insert({
    school_id: school.id,
    tutor_id: createdUsers['Tutor'].id,
    course_id: course.id,
    // This demo centre has one tutor, who is also the course creator.
    assigned_by: createdUsers['Tutor'].id,
  });
  assertNoError(assignmentError, 'Assigning Physics to the tutor');

  const { data: chemistry, error: chemistryError } = await supabase.from('courses').insert({
    school_id: school.id,
    programme_id: programme.id,
    name: 'Chemistry',
    slug: 'chemistry',
    price: 0,
    is_published: true,
    created_by: createdUsers['Tutor'].id,
  }).select('id').single();
  assertNoError(chemistryError, 'Creating Chemistry');
  if (!chemistry) throw new Error('Chemistry was not created');
  const { error: chemistryAssignmentError } = await supabase.from('tutor_course_assignments').insert({
    school_id: school.id,
    tutor_id: createdUsers['Tutor'].id,
    course_id: chemistry.id,
    assigned_by: createdUsers['Tutor'].id,
  });
  assertNoError(chemistryAssignmentError, 'Assigning Chemistry to the tutor');

  // Enrol students
  for (const name of ['Emeka', 'Ada', 'Tobi']) {
    const { error: enrolmentError } = await supabase.from('enrolments').insert({
      school_id: school.id,
      student_id: createdUsers[name].id,
      programme_id: programme.id,
      // Current enrolments are either payment-backed or manually granted.
      // Demo learners are deliberately granted access by the demo tutor.
      source: 'admin_import',
      granted_by: createdUsers['Tutor'].id,
      imported_at: new Date().toISOString(),
    });
    assertNoError(enrolmentError, `Enrolling ${name} in Physics`);
  }

  // A real timetable and dated session let the class workspace show both the
  // recurring teaching arrangement and the next actual class.
  const nextSessionAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  nextSessionAt.setHours(17, 0, 0, 0);
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const { error: slotError } = await supabase.from('class_timetable_slots').insert([
    { school_id: school.id, course_id: course.id, tutor_id: createdUsers['Tutor'].id, weekday: 3, start_time: '17:00', duration_minutes: 90, starts_on: weekStart.toISOString().slice(0, 10), title: 'Physics problem-solving', source: 'direct', created_by: createdUsers['Tutor'].id, published_at: new Date().toISOString() },
    { school_id: school.id, course_id: chemistry.id, tutor_id: createdUsers['Tutor'].id, weekday: 5, start_time: '17:00', duration_minutes: 90, starts_on: weekStart.toISOString().slice(0, 10), title: 'Chemistry revision', source: 'direct', created_by: createdUsers['Tutor'].id, published_at: new Date().toISOString() },
  ]);
  assertNoError(slotError, 'Creating recurring class schedule');
  const { data: upcomingSession, error: sessionError } = await supabase.from('live_classes').insert({
    school_id: school.id, course_id: course.id, tutor_id: createdUsers['Tutor'].id,
    title: 'Physics: Forces and motion', scheduled_at: nextSessionAt.toISOString(), duration_minutes: 90,
    status: 'scheduled', created_by: createdUsers['Tutor'].id, teaching_mode: 'whiteboard', classroom_provider: 'plugnmeet',
  }).select('id').single();
  assertNoError(sessionError, 'Creating upcoming Physics session');
  if (upcomingSession) {
    const { error: attendanceError } = await supabase.from('attendance_records').insert({
      school_id: school.id, live_class_id: upcomingSession.id, student_id: createdUsers['Ada'].id,
      joined_at: new Date().toISOString(), source: 'manual',
    });
    assertNoError(attendanceError, 'Creating attendance signal');
  }
  const { error: assignmentCreateError } = await supabase.from('assignments').insert({
    school_id: school.id, course_id: chemistry.id, tutor_id: createdUsers['Tutor'].id,
    title: 'Balancing equations practice', description: 'Work through the balancing examples before Friday\'s chemistry session.',
    deadline_at: new Date(Date.now() + 5 * 86400000).toISOString(), is_published: true,
  });
  assertNoError(assignmentCreateError, 'Creating class assignment');

  // 6. Create historical mocks (Mock 1, Mock 2, Mock 3).
  // The recording itself starts the live class through the product workflow,
  // so no brittle pre-created classroom is needed here.
  const mockHistory = [
    { title: 'Physics Mock 1', publish_at: new Date(Date.now() - 30*86400000).toISOString(), scores: { "Newton's Laws": 42, "Kinematics": 76, "Energy": 81, "Waves": 78 } },
    { title: 'Physics Mock 2', publish_at: new Date(Date.now() - 20*86400000).toISOString(), scores: { "Newton's Laws": 38, "Kinematics": 71, "Energy": 79, "Waves": 82 } },
    { title: 'Physics Mock 3', publish_at: new Date(Date.now() - 10*86400000).toISOString(), scores: { "Newton's Laws": 44, "Kinematics": 74, "Energy": 83, "Waves": 79 } }
  ];

  for (const m of mockHistory) {
    const { data: mock, error: mErr } = await supabase.from('mock_exams').insert({
      school_id: school.id,
      course_id: course.id,
      tutor_id: createdUsers['Tutor'].id,
      title: m.title,
      status: 'draft',
      time_limit_minutes: 60
    }).select('id').single();
    if (mErr) throw mErr;

    const questions = Object.entries(m.scores).map(([topic, score]) => ({
      question_type: 'theory',
      question_text: `Write an essay on ${topic}`,
      marks: 100,
      topic: topic
    }));

    const { error: rpcErr } = await supabase.rpc('replace_authored_mock_questions', {
      p_school_id: school.id,
      p_mock_exam_id: mock.id,
      p_author_id: createdUsers['Tutor'].id,
      p_questions: questions
    });
    if (rpcErr) throw rpcErr;

    const { error: pResErr } = await supabase.rpc('publish_versioned_mock', {
      p_school_id: school.id,
      p_mock_exam_id: mock.id,
      p_published_by: createdUsers['Tutor'].id,
      p_published_at: new Date().toISOString()
    });
    if (pResErr) throw pResErr;

    const { error: publishAtError } = await supabase.from('mock_exams').update({ publish_at: m.publish_at }).eq('id', mock.id);
    assertNoError(publishAtError, `Backdating ${m.title}`);

    const { data: mockVersion, error: versionError } = await supabase.from('mock_exam_versions')
      .select('id').eq('mock_exam_id', mock.id).order('version_number', { ascending: false }).limit(1).single();
    assertNoError(versionError, `Loading ${m.title}'s published version`);
    if (!mockVersion) throw new Error("mockVersion is null after publish!");

    const { data: vQuestions, error: questionsError } = await supabase.from('mock_version_questions')
      .select('id, section_order_index, order_index, question_version_id')
      .eq('mock_exam_version_id', mockVersion.id);
    assertNoError(questionsError, `Loading ${m.title}'s questions`);
    if (!vQuestions?.length) throw new Error(`${m.title} has no published questions`);

    const { data: attempt, error: aErr } = await supabase.rpc('start_or_resume_versioned_mock_attempt', {
      p_school_id: school.id,
      p_mock_exam_id: mock.id,
      p_student_id: createdUsers['Emeka'].id,
      p_now: m.publish_at
    });
    if (aErr) throw aErr;

    const attemptId = attempt[0].attempt_id;
    for (const vq of vQuestions) {
        const { data: bqv, error: questionVersionError } = await supabase.from('bank_question_versions').select('plain_text').eq('id', vq.question_version_id).single();
        assertNoError(questionVersionError, `Loading a ${m.title} question`);
        if (!bqv) throw new Error(`Could not load a ${m.title} question`);
        const topic = Object.keys(m.scores).find(t => bqv.plain_text.includes(t));
        const score = m.scores[topic!];
        
        await supabase.from('mock_answers').insert({
            school_id: school.id,
            attempt_id: attemptId,
            mock_version_question_id: vq.id,
            theory_answer_text: 'My answer',
            tutor_score: score
        });
    }

    const { error: submitError } = await supabase.rpc('submit_versioned_mock_attempt', {
      p_school_id: school.id,
      p_attempt_id: attemptId,
      p_student_id: createdUsers['Emeka'].id,
      p_now: m.publish_at,
      p_reason: 'student',
    });
    assertNoError(submitError, `Submitting ${m.title} for Emeka`);
  }
  
  // 7. Create "Today's Mock"
  const { data: todayMock, error: todayErr } = await supabase.from('mock_exams').insert({
    school_id: school.id,
    course_id: course.id,
    tutor_id: createdUsers['Tutor'].id,
    title: 'Today\'s Physics Mock',
    status: 'draft',
    time_limit_minutes: 60
  }).select('id').single();
  if (todayErr) throw todayErr;

  // The marks deliberately preserve distinct strong / average / struggling
  // outcomes, while the questions themselves form a credible short Physics
  // assessment that follows the live Newton's Third Law lesson.
  const todayQuestions = [
    {
      question_type: 'mcq', topic: "Newton's Laws", marks: 41,
      question_text: "A book rests on a table. Which force is the Newton's Third Law partner to the force of the book pushing down on the table?",
      options: [
        { option_text: 'The table pushes upward on the book.', is_correct: true },
        { option_text: 'The Earth pulls downward on the book.', is_correct: false },
      ],
    },
    {
      question_type: 'mcq', topic: "Newton's Laws", marks: 59,
      question_text: 'A rocket rises by expelling gases downward. Which statement is correct?',
      options: [
        { option_text: 'The gases exert no force on the rocket after leaving it.', is_correct: false },
        { option_text: 'The gases push the rocket upward while the rocket pushes the gases downward.', is_correct: true },
      ],
    },
    {
      question_type: 'mcq', topic: 'Kinematics', marks: 74,
      question_text: 'A car starts from rest and accelerates uniformly at 2 m/s² for 5 seconds. What is its final velocity?',
      options: [
        { option_text: '10 m/s', is_correct: true },
        { option_text: '2.5 m/s', is_correct: false },
      ],
    },
    {
      question_type: 'mcq', topic: 'Kinematics', marks: 26,
      question_text: 'Which velocity-time graph represents an object moving at constant velocity?',
      options: [
        { option_text: 'A straight line sloping upward.', is_correct: false },
        { option_text: 'A horizontal straight line.', is_correct: true },
      ],
    },
    {
      question_type: 'mcq', topic: 'Energy', marks: 82,
      question_text: 'What is the kinetic energy of a 4 kg object moving at 3 m/s?',
      options: [
        { option_text: '18 J', is_correct: true },
        { option_text: '36 J', is_correct: false },
      ],
    },
    {
      question_type: 'mcq', topic: 'Energy', marks: 18,
      question_text: 'Ignoring air resistance, what happens to a ball’s energy as it rises after being thrown upward?',
      options: [
        { option_text: 'Both kinetic and potential energy decrease.', is_correct: false },
        { option_text: 'Kinetic energy changes to potential energy while total mechanical energy stays constant.', is_correct: true },
      ],
    },
    {
      question_type: 'mcq', topic: 'Waves', marks: 79,
      question_text: 'A wave has frequency 5 Hz and wavelength 2 m. What is its speed?',
      options: [
        { option_text: '10 m/s', is_correct: true },
        { option_text: '2.5 m/s', is_correct: false },
      ],
    },
    {
      question_type: 'mcq', topic: 'Waves', marks: 21,
      question_text: 'In a transverse wave, particles of the medium vibrate in which direction?',
      options: [
        { option_text: 'Parallel to the direction of wave travel.', is_correct: false },
        { option_text: 'Perpendicular to the direction of wave travel.', is_correct: true },
      ],
    },
  ];

  const { error: todayRpcErr } = await supabase.rpc('replace_authored_mock_questions', {
    p_school_id: school.id,
    p_mock_exam_id: todayMock.id,
    p_author_id: createdUsers['Tutor'].id,
    p_questions: todayQuestions
  });
  if (todayRpcErr) throw todayRpcErr;

  const { error: todayPResErr } = await supabase.rpc('publish_versioned_mock', {
    p_school_id: school.id,
    p_mock_exam_id: todayMock.id,
    p_published_by: createdUsers['Tutor'].id,
      p_published_at: new Date().toISOString()
  });
  if (todayPResErr) throw todayPResErr;
  
  await supabase.from('mock_exams').update({ publish_at: new Date().toISOString() }).eq('id', todayMock.id);

  console.log("Demo seed complete!");
}

run().catch(console.error);
