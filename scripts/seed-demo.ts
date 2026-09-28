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
    is_active: true
  }).select('id').single();
  
  if (schoolErr) throw schoolErr;
  console.log("School created:", school.id);

  // 3. Create Users
  const usersToCreate = [
    { name: 'Tutor', email: 'tutor@demo.com', role: 'tutor' },
    { name: 'Emeka Okafor', email: 'emeka@demo.com', role: 'student' },
    { name: 'Ada', email: 'ada@demo.com', role: 'student' },
    { name: 'Tobi', email: 'tobi@demo.com', role: 'student' },
    { name: 'David', email: 'david@demo.com', role: 'student' },
    { name: 'Favour', email: 'favour@demo.com', role: 'student' },
    { name: 'Sarah', email: 'sarah@demo.com', role: 'student' }
  ];

  const createdUsers: Record<string, any> = {};

  for (const u of usersToCreate) {
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const existing = existingUser.users.find(x => (x as any).email === u.email);
    if (existing) await supabase.auth.admin.deleteUser(existing.id);

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { role: u.role, school_id: school.id, first_name: u.name.split(' ')[0], last_name: u.name.split(' ').slice(1).join(' ') }
    });
    if (authErr) throw authErr;

    const [firstName, ...lastNames] = u.name.split(' ');
    
    let { data: profile } = await supabase.from('user_profiles').select('id').eq('supabase_auth_id', authUser.user.id).maybeSingle();
    if (!profile) {
      const { data: pData, error: pErr } = await supabase.from('user_profiles').insert({
        supabase_auth_id: authUser.user.id,
        role: u.role,
        school_id: school.id,
        kanvise_user_id: `KNV-${u.role === "student" ? "STD" : "TUT"}-${Math.floor(Math.random()*10000).toString().padStart(4, "0")}`,
        first_name: firstName,
        last_name: lastNames.join(' ') || '',
        email: u.email
      }).select('id').single();
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
    
    createdUsers[u.name.split(' ')[0]] = profile;
    console.log(`Created ${u.name}`);
  }

  // 4. Create Course
  const { data: course, error: cErr } = await supabase.from('courses').insert({
    school_id: school.id,
    name: 'Physics',
    slug: 'physics',
    price: 0,
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

  // Enrol students
  for (const name of ['Emeka', 'Ada', 'Tobi', 'David', 'Favour', 'Sarah']) {
    const { error: enrolmentError } = await supabase.from('enrolments').insert({
      school_id: school.id,
      student_id: createdUsers[name].id,
      course_id: course.id,
      // Current enrolments are either payment-backed or manually granted.
      // Demo learners are deliberately granted access by the demo tutor.
      source: 'admin_import',
      granted_by: createdUsers['Tutor'].id,
      imported_at: new Date().toISOString(),
    });
    assertNoError(enrolmentError, `Enrolling ${name} in Physics`);
  }

  // 5. Create historical mocks (Mock 1, Mock 2, Mock 3).
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

  const todayScores = { "Newton's Laws": 41, "Kinematics": 74, "Energy": 82, "Waves": 79 };
  const todayQuestions = [];
  
  for (const [topic, target] of Object.entries(todayScores)) {
      todayQuestions.push({
          question_type: 'mcq',
          question_text: `Easy question on ${topic}`,
          marks: target,
          topic: topic,
          options: [{ option_text: 'A', is_correct: true }, { option_text: 'B', is_correct: false }]
      });
      todayQuestions.push({
          question_type: 'mcq',
          question_text: `Hard question on ${topic}`,
          marks: 100 - target,
          topic: topic,
          options: [{ option_text: 'A', is_correct: false }, { option_text: 'B', is_correct: true }]
      });
  }

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
