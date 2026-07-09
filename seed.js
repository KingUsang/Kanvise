/**
 * Kanvise dev seed script
 * -----------------------
 * Populates two tutorial centres with realistic, interconnected data across
 * every table in Database_Schema.md — enough to click through the dashboard
 * as any role while the UI is still being built.
 *
 * Uses the Supabase JS client for everything (auth + tables), same as Hono
 * does in production — never raw SQL — so this script is a fair stand-in
 * for how the real backend touches the database.
 *
 * REQUIRED ENV VARS:
 *   SUPABASE_URL               - your project URL
 *   SUPABASE_SERVICE_ROLE_KEY  - service role key (never expose this client-side)
 *
 * RUN:
 *   node seed.js
 *
 * All seed emails live on @seed.kanvise.test and all seed schools use a
 * "-seed" suffix in their slug — see unseed.js to wipe everything back out
 * before real users show up.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = 'KanviseSeed@2026';
const now = Date.now();
const daysFromNow = (n) => new Date(now + n * 24 * 60 * 60 * 1000).toISOString();
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

// Small wrapper so every insert reads the same way and fails loudly with
// context, instead of a bare Postgres error with no idea which step broke.
async function insertOne(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}\nRow: ${JSON.stringify(row)}`);
  return data;
}

async function createAuthUser(email, role, emailConfirm = true) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: emailConfirm,
    user_metadata: { kanvise_role: role }
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  return data.user;
}

async function run() {
  const credentials = []; // collected for the final printout

  // ---------------------------------------------------------------------
  // 1. Schools
  // ---------------------------------------------------------------------
  console.log('Creating schools...');

  const brightMinds = await insertOne('schools', {
    name: 'Bright Minds Tutorials',
    slug: 'bright-minds-seed',
    description: 'WAEC and JAMB prep for senior secondary students, fully online.',
    contact_email: 'hello@brightminds.seed',
    contact_phone: '+2348012340001',
    is_active: true,
  });

  const apexLearning = await insertOne('schools', {
    name: 'Apex Learning Hub',
    slug: 'apex-learning-seed',
    description: 'Small-group virtual tutoring for science subjects.',
    contact_email: 'hello@apexlearning.seed',
    contact_phone: '+2348012340002',
    is_active: true,
  });

  // Bright Minds has a linked payout account; Apex deliberately does not —
  // this is what should trigger the "set up payments" banner in the UI.
  await insertOne('paystack_subaccounts', {
    school_id: brightMinds.id,
    subaccount_code: 'ACCT_seed_brightminds',
    business_name: 'Chidi Okafor', // personal account — most centres aren't incorporated
    bank_code: '058',
    account_number: '0123456789',
    percentage_charge: 10.0,
  });

  await insertOne('kanvise_subscriptions', {
    school_id: brightMinds.id,
    paystack_reference: 'seed_sub_brightminds_001',
    amount: 15000.0,
    status: 'active',
    started_at: daysAgo(20),
    expires_at: daysFromNow(10),
    paid_at: daysAgo(20),
  });

  await insertOne('kanvise_subscriptions', {
    school_id: apexLearning.id,
    paystack_reference: 'seed_sub_apex_001',
    amount: 15000.0,
    status: 'pending', // hasn't paid Kanvise yet — another realistic incomplete state
  });

  // ---------------------------------------------------------------------
  // 2. Auth users + user_profiles
  // ---------------------------------------------------------------------
  console.log('Creating auth users and profiles...');

  async function makePerson({ email, role, school, kanviseId, firstName, lastName, bio }) {
    const authUser = await createAuthUser(email, role, true);
    const profile = await insertOne('user_profiles', {
      supabase_auth_id: authUser.id,
      school_id: school.id,
      kanvise_user_id: kanviseId,
      role,
      first_name: firstName,
      last_name: lastName,
      email,
      bio: bio || null,
    });
    credentials.push({ role, name: `${firstName} ${lastName}`, email, password: SEED_PASSWORD });
    return profile;
  }

  // Bright Minds people
  const chidi = await makePerson({
    email: 'chidi.okafor@seed.kanvise.test',
    role: 'admin',
    school: brightMinds,
    kanviseId: 'KNV-ADM-00001',
    firstName: 'Chidi',
    lastName: 'Okafor',
    bio: 'Founder of Bright Minds Tutorials. Also teaches Chemistry.',
  });

  const amaka = await makePerson({
    email: 'amaka.eze@seed.kanvise.test',
    role: 'tutor',
    school: brightMinds,
    kanviseId: 'KNV-TUT-00001',
    firstName: 'Amaka',
    lastName: 'Eze',
    bio: 'Physics and Biology tutor, five years experience.',
  });

  const david = await makePerson({
    email: 'david.okon@seed.kanvise.test',
    role: 'tutor',
    school: brightMinds,
    kanviseId: 'KNV-TUT-00002',
    firstName: 'David',
    lastName: 'Okon',
    bio: 'Mathematics tutor.',
  });

  const ngozi = await makePerson({
    email: 'ngozi.umeh@seed.kanvise.test',
    role: 'student',
    school: brightMinds,
    kanviseId: 'KNV-STU-00001',
    firstName: 'Ngozi',
    lastName: 'Umeh',
  });

  const tunde = await makePerson({
    email: 'tunde.bello@seed.kanvise.test',
    role: 'student',
    school: brightMinds,
    kanviseId: 'KNV-STU-00002',
    firstName: 'Tunde',
    lastName: 'Bello',
  });

  const fatima = await makePerson({
    email: 'fatima.yusuf@seed.kanvise.test',
    role: 'student',
    school: brightMinds,
    kanviseId: 'KNV-STU-00003',
    firstName: 'Fatima',
    lastName: 'Yusuf',
  });

  const emeka = await makePerson({
    email: 'emeka.nwosu@seed.kanvise.test',
    role: 'student',
    school: brightMinds,
    kanviseId: 'KNV-STU-00004',
    firstName: 'Emeka',
    lastName: 'Nwosu',
  });

  const bola = await makePerson({
    email: 'bola.ogundele@seed.kanvise.test',
    role: 'student',
    school: brightMinds,
    kanviseId: 'KNV-STU-00005',
    firstName: 'Bola',
    lastName: 'Ogundele',
  });

  // Apex people
  const blessing = await makePerson({
    email: 'blessing.adeyemi@seed.kanvise.test',
    role: 'admin',
    school: apexLearning,
    kanviseId: 'KNV-ADM-00002',
    firstName: 'Blessing',
    lastName: 'Adeyemi',
  });

  const samuel = await makePerson({
    email: 'samuel.idris@seed.kanvise.test',
    role: 'tutor',
    school: apexLearning,
    kanviseId: 'KNV-TUT-00003',
    firstName: 'Samuel',
    lastName: 'Idris',
    bio: 'Chemistry tutor.',
  });

  const grace = await makePerson({
    email: 'grace.effiong@seed.kanvise.test',
    role: 'student',
    school: apexLearning,
    kanviseId: 'KNV-STU-00006',
    firstName: 'Grace',
    lastName: 'Effiong',
  });

  // ---------------------------------------------------------------------
  // 3. Avatar configs (skip Emeka + Bola deliberately — simulates users
  //    who skipped this step during onboarding, a real supported state)
  // ---------------------------------------------------------------------
  console.log('Creating avatar configs...');

  async function makeAvatar(profile, school) {
    return insertOne('avatar_configs', {
      user_id: profile.id,
      school_id: school.id,
      skin_tone: 'medium',
      face_shape: 'round',
      hair_style: 'short',
      hair_colour: 'black',
      outfit_colour: 'navy',
      accessory: 'glasses',
      headwear: null,
    });
  }

  for (const [profile, school] of [
    [chidi, brightMinds], [amaka, brightMinds], [david, brightMinds],
    [ngozi, brightMinds], [tunde, brightMinds], [fatima, brightMinds],
    [blessing, apexLearning], [samuel, apexLearning], [grace, apexLearning],
  ]) {
    await makeAvatar(profile, school);
  }

  // ---------------------------------------------------------------------
  // 4. tutor_invites — all four states
  // ---------------------------------------------------------------------
  console.log('Creating tutor invites (pending/accepted/expired/revoked)...');

  // Accepted: David's own invite, backdated, linked to his real profile.
  await insertOne('tutor_invites', {
    school_id: brightMinds.id,
    email: david.email,
    invited_by: chidi.id,
    supabase_auth_id: david.supabase_auth_id,
    status: 'accepted',
    expires_at: daysAgo(3),
    accepted_at: daysAgo(4),
    created_at: daysAgo(10),
  });

  // Pending: a real unconfirmed auth user exists, invite still open.
  const pendingInviteUser = await createAuthUser('pending.invite@seed.kanvise.test', false);
  await insertOne('tutor_invites', {
    school_id: brightMinds.id,
    email: 'pending.invite@seed.kanvise.test',
    invited_by: chidi.id,
    supabase_auth_id: pendingInviteUser.id,
    status: 'pending',
    expires_at: daysFromNow(4),
  });

  // Expired: unconfirmed auth user still exists, but past its expiry.
  const expiredInviteUser = await createAuthUser('expired.invite@seed.kanvise.test', false);
  await insertOne('tutor_invites', {
    school_id: brightMinds.id,
    email: 'expired.invite@seed.kanvise.test',
    invited_by: chidi.id,
    supabase_auth_id: expiredInviteUser.id,
    status: 'expired',
    expires_at: daysAgo(2),
    created_at: daysAgo(9),
  });

  // Revoked: mirrors the real revoke flow — create, then deleteUser(),
  // so the auth record genuinely no longer exists.
  const revokedInviteUser = await createAuthUser('revoked.invite@seed.kanvise.test', false);
  await supabase.auth.admin.deleteUser(revokedInviteUser.id);
  await insertOne('tutor_invites', {
    school_id: brightMinds.id,
    email: 'revoked.invite@seed.kanvise.test',
    invited_by: chidi.id,
    supabase_auth_id: null, // deleted — nothing to point to anymore
    status: 'revoked',
    expires_at: daysFromNow(2),
    created_at: daysAgo(5),
  });

  // Apex: one simple pending invite, keeping this school lighter overall.
  const apexPendingInviteUser = await createAuthUser('apex.pending.invite@seed.kanvise.test', false);
  await insertOne('tutor_invites', {
    school_id: apexLearning.id,
    email: 'apex.pending.invite@seed.kanvise.test',
    invited_by: blessing.id,
    supabase_auth_id: apexPendingInviteUser.id,
    status: 'pending',
    expires_at: daysFromNow(6),
  });

  // ---------------------------------------------------------------------
  // 5. Programmes, sub-programmes, courses (Bright Minds)
  // ---------------------------------------------------------------------
  console.log('Creating programmes, sub-programmes, and courses...');

  const waecBootcamp = await insertOne('programmes', {
    school_id: brightMinds.id,
    name: 'WAEC Bootcamp 2026',
    slug: 'waec-bootcamp-2026',
    description: 'Full WAEC prep across sciences, arts, and core subjects.',
    price: 45000.0,
    is_published: true,
    created_by: chidi.id,
  });

  const scienceTrack = await insertOne('sub_programmes', {
    school_id: brightMinds.id,
    programme_id: waecBootcamp.id,
    name: 'Science Track',
    slug: 'science-track',
    description: 'Chemistry, Physics, and Biology.',
    price: 30000.0,
    is_published: true,
    created_by: chidi.id,
  });

  const artsTrack = await insertOne('sub_programmes', {
    school_id: brightMinds.id,
    programme_id: waecBootcamp.id,
    name: 'Arts Track',
    slug: 'arts-track',
    description: 'Literature and related arts subjects.',
    price: 25000.0,
    is_published: false, // still being set up — draft state on purpose
    created_by: chidi.id,
  });

  const chemistry = await insertOne('courses', {
    school_id: brightMinds.id,
    sub_programme_id: scienceTrack.id,
    name: 'Chemistry',
    slug: 'chemistry',
    description: 'WAEC Chemistry syllabus.',
    price: 12000.0,
    is_published: true,
    created_by: chidi.id,
  });

  const physics = await insertOne('courses', {
    school_id: brightMinds.id,
    sub_programme_id: scienceTrack.id,
    name: 'Physics',
    slug: 'physics',
    description: 'WAEC Physics syllabus.',
    price: 12000.0,
    is_published: true,
    created_by: chidi.id,
  });

  const biology = await insertOne('courses', {
    school_id: brightMinds.id,
    sub_programme_id: scienceTrack.id,
    name: 'Biology',
    slug: 'biology',
    description: 'WAEC Biology syllabus.',
    price: 12000.0,
    is_published: true,
    created_by: chidi.id,
  });

  const literature = await insertOne('courses', {
    school_id: brightMinds.id,
    sub_programme_id: artsTrack.id,
    name: 'Literature',
    slug: 'literature',
    description: 'WAEC Literature-in-English syllabus.',
    price: 10000.0,
    is_published: false, // no tutor assigned yet either — deliberately incomplete
    created_by: chidi.id,
  });

  const mathematics = await insertOne('courses', {
    school_id: brightMinds.id,
    programme_id: waecBootcamp.id, // directly under the programme, not a sub-programme
    name: 'Mathematics',
    slug: 'mathematics',
    description: 'WAEC Mathematics syllabus.',
    price: 12000.0,
    is_published: true,
    created_by: chidi.id,
  });

  const digitalLiteracy = await insertOne('courses', {
    school_id: brightMinds.id,
    // both programme_id and sub_programme_id null — genuinely standalone
    name: 'Basic Digital Literacy',
    slug: 'basic-digital-literacy',
    description: 'Typing, browsers, and using Kanvise itself.',
    price: 5000.0,
    is_published: true,
    created_by: chidi.id,
  });

  // Apex Learning
  const jambPrep = await insertOne('programmes', {
    school_id: apexLearning.id,
    name: 'JAMB Prep 2026',
    slug: 'jamb-prep-2026',
    description: 'JAMB prep programme — courses coming soon.',
    price: 20000.0,
    is_published: false, // draft — no courses under it yet
    created_by: blessing.id,
  });

  const apexChemistry = await insertOne('courses', {
    school_id: apexLearning.id,
    // standalone, same name as Bright Minds' Chemistry on purpose
    name: 'Chemistry',
    slug: 'chemistry',
    description: 'Small-group Chemistry tutoring.',
    price: 15000.0,
    is_published: true,
    created_by: blessing.id,
  });

  // ---------------------------------------------------------------------
  // 6. tutor_course_assignments
  // ---------------------------------------------------------------------
  console.log('Assigning tutors to courses...');

  await insertOne('tutor_course_assignments', {
    school_id: brightMinds.id,
    tutor_id: chidi.id, // admin teaching their own course — the solo case
    course_id: chemistry.id,
    assigned_by: chidi.id,
  });

  await insertOne('tutor_course_assignments', {
    school_id: brightMinds.id,
    tutor_id: amaka.id,
    course_id: physics.id,
    assigned_by: chidi.id,
  });

  await insertOne('tutor_course_assignments', {
    school_id: brightMinds.id,
    tutor_id: amaka.id,
    course_id: biology.id,
    assigned_by: chidi.id,
  });

  await insertOne('tutor_course_assignments', {
    school_id: brightMinds.id,
    tutor_id: david.id,
    course_id: mathematics.id,
    assigned_by: chidi.id,
  });
  // Note: Literature has no tutor assigned yet — deliberately, to test that state.

  await insertOne('tutor_course_assignments', {
    school_id: apexLearning.id,
    tutor_id: samuel.id,
    course_id: apexChemistry.id,
    assigned_by: blessing.id,
  });

  // ---------------------------------------------------------------------
  // 7. Payments + enrolments
  //    (payments must exist first — enrolments.payment_id is NOT NULL)
  // ---------------------------------------------------------------------
  console.log('Creating payments and enrolments...');

  const ngoziPayment = await insertOne('payments', {
    school_id: brightMinds.id,
    student_id: ngozi.id,
    programme_id: waecBootcamp.id,
    amount: 45000.0,
    kanvise_fee: 4500.0,
    centre_amount: 40500.0,
    paystack_reference: 'seed_pay_ngozi_001',
    status: 'successful',
    paid_at: daysAgo(15),
  });
  await insertOne('enrolments', {
    school_id: brightMinds.id,
    student_id: ngozi.id,
    programme_id: waecBootcamp.id,
    payment_id: ngoziPayment.id,
    enrolled_at: daysAgo(15),
  });

  const tundePayment = await insertOne('payments', {
    school_id: brightMinds.id,
    student_id: tunde.id,
    sub_programme_id: scienceTrack.id,
    amount: 30000.0,
    kanvise_fee: 3000.0,
    centre_amount: 27000.0,
    paystack_reference: 'seed_pay_tunde_001',
    status: 'successful',
    paid_at: daysAgo(12),
  });
  await insertOne('enrolments', {
    school_id: brightMinds.id,
    student_id: tunde.id,
    sub_programme_id: scienceTrack.id,
    payment_id: tundePayment.id,
    enrolled_at: daysAgo(12),
  });

  const fatimaPayment = await insertOne('payments', {
    school_id: brightMinds.id,
    student_id: fatima.id,
    course_id: physics.id,
    amount: 12000.0,
    kanvise_fee: 1200.0,
    centre_amount: 10800.0,
    paystack_reference: 'seed_pay_fatima_001',
    status: 'successful',
    paid_at: daysAgo(8),
  });
  await insertOne('enrolments', {
    school_id: brightMinds.id,
    student_id: fatima.id,
    course_id: physics.id,
    payment_id: fatimaPayment.id,
    enrolled_at: daysAgo(8),
  });

  // Pending payment, no enrolment — checkout started, never finished.
  await insertOne('payments', {
    school_id: brightMinds.id,
    student_id: emeka.id,
    course_id: mathematics.id,
    amount: 12000.0,
    kanvise_fee: 1200.0,
    centre_amount: 10800.0,
    paystack_reference: 'seed_pay_emeka_001',
    status: 'pending',
  });

  // Failed payment, no enrolment.
  await insertOne('payments', {
    school_id: brightMinds.id,
    student_id: bola.id,
    course_id: biology.id,
    amount: 12000.0,
    kanvise_fee: 1200.0,
    centre_amount: 10800.0,
    paystack_reference: 'seed_pay_bola_001',
    status: 'failed',
  });

  // Apex: Grace enrolled directly in the standalone Chemistry course.
  const gracePayment = await insertOne('payments', {
    school_id: apexLearning.id,
    student_id: grace.id,
    course_id: apexChemistry.id,
    amount: 15000.0,
    kanvise_fee: 1500.0,
    centre_amount: 13500.0,
    paystack_reference: 'seed_pay_grace_001',
    status: 'successful',
    paid_at: daysAgo(6),
  });
  await insertOne('enrolments', {
    school_id: apexLearning.id,
    student_id: grace.id,
    course_id: apexChemistry.id,
    payment_id: gracePayment.id,
    enrolled_at: daysAgo(6),
  });

  // ---------------------------------------------------------------------
  // 8. Live classes + attendance
  // ---------------------------------------------------------------------
  console.log('Creating live classes and attendance records...');

  const physicsScheduled = await insertOne('live_classes', {
    school_id: brightMinds.id,
    course_id: physics.id,
    tutor_id: amaka.id,
    title: 'Physics — Waves and Optics',
    scheduled_at: daysFromNow(2),
    duration_minutes: 60,
    status: 'scheduled',
    notification_sent: false,
    created_by: amaka.id,
  });

  await insertOne('live_classes', {
    school_id: brightMinds.id,
    course_id: physics.id,
    tutor_id: amaka.id,
    title: 'Physics — Live doubt-clearing session',
    scheduled_at: daysAgo(0), // "now"
    duration_minutes: 45,
    status: 'live',
    livekit_room_name: 'seed-physics-live-room',
    started_at: new Date(now - 10 * 60 * 1000).toISOString(), // started 10 min ago
    notification_sent: true,
    created_by: amaka.id,
  });

  const chemistryCompleted = await insertOne('live_classes', {
    school_id: brightMinds.id,
    course_id: chemistry.id,
    tutor_id: chidi.id,
    title: 'Chemistry — Periodic Table Deep Dive',
    scheduled_at: daysAgo(5),
    duration_minutes: 60,
    status: 'completed',
    livekit_room_name: 'seed-chemistry-completed-room',
    started_at: daysAgo(5),
    ended_at: new Date(new Date(daysAgo(5)).getTime() + 58 * 60 * 1000).toISOString(),
    notification_sent: true,
    created_by: chidi.id,
  });

  await insertOne('live_classes', {
    school_id: brightMinds.id,
    course_id: mathematics.id,
    tutor_id: david.id,
    title: 'Mathematics — Calculus Basics',
    scheduled_at: daysFromNow(5),
    duration_minutes: 90,
    status: 'scheduled',
    notification_sent: false,
    created_by: david.id,
  });

  // Attendance for the completed Chemistry class — only students who
  // actually have access to Chemistry (Ngozi via programme, Tunde via
  // sub-programme). Fatima is NOT here — she only has Physics access.
  await insertOne('attendance_records', {
    school_id: brightMinds.id,
    live_class_id: chemistryCompleted.id,
    student_id: ngozi.id,
    joined_at: daysAgo(5),
    left_at: new Date(new Date(daysAgo(5)).getTime() + 55 * 60 * 1000).toISOString(),
    duration_seconds: 55 * 60,
  });

  await insertOne('attendance_records', {
    school_id: brightMinds.id,
    live_class_id: chemistryCompleted.id,
    student_id: tunde.id,
    joined_at: new Date(new Date(daysAgo(5)).getTime() + 5 * 60 * 1000).toISOString(),
    left_at: new Date(new Date(daysAgo(5)).getTime() + 58 * 60 * 1000).toISOString(),
    duration_seconds: 53 * 60,
  });

  // ---------------------------------------------------------------------
  // 9. Notes
  // ---------------------------------------------------------------------
  console.log('Creating notes...');

  await insertOne('notes', {
    school_id: brightMinds.id,
    course_id: chemistry.id,
    tutor_id: chidi.id,
    title: 'Periodic Table Reference Sheet',
    description: 'Quick-reference sheet for the WAEC syllabus.',
    file_key: `schools/${brightMinds.id}/notes/seed-periodic-table.pdf`,
    file_name: 'periodic-table-reference.pdf',
    file_type: 'pdf',
    file_size_bytes: 482000,
  });

  await insertOne('notes', {
    school_id: brightMinds.id,
    course_id: chemistry.id,
    tutor_id: chidi.id,
    title: 'Organic Chemistry Slides',
    description: 'Slide deck from week 3.',
    file_key: `schools/${brightMinds.id}/notes/seed-organic-chem.pptx`,
    file_name: 'organic-chemistry-week3.pptx',
    file_type: 'pptx',
    file_size_bytes: 3150000,
  });

  await insertOne('notes', {
    school_id: brightMinds.id,
    course_id: physics.id,
    tutor_id: amaka.id,
    title: 'Waves and Optics Notes',
    description: null,
    file_key: `schools/${brightMinds.id}/notes/seed-waves-optics.pdf`,
    file_name: 'waves-and-optics.pdf',
    file_type: 'pdf',
    file_size_bytes: 612000,
  });

  // ---------------------------------------------------------------------
  // 10. Assignments + submissions
  // ---------------------------------------------------------------------
  console.log('Creating assignments and submissions...');

  const chemistryAssignment = await insertOne('assignments', {
    school_id: brightMinds.id,
    course_id: chemistry.id,
    tutor_id: chidi.id,
    title: 'Balancing Chemical Equations — Worksheet 1',
    description: 'Complete all 15 equations and show your working.',
    deadline_at: daysFromNow(3),
    is_published: true,
  });

  const physicsAssignment = await insertOne('assignments', {
    school_id: brightMinds.id,
    course_id: physics.id,
    tutor_id: amaka.id,
    title: 'Wave Properties Problem Set',
    description: 'Questions 1-10 from the syllabus handout.',
    deadline_at: daysFromNow(6),
    is_published: true,
    // No submissions yet on purpose — tests the empty state.
  });

  // Reviewed submission
  await insertOne('submissions', {
    school_id: brightMinds.id,
    assignment_id: chemistryAssignment.id,
    student_id: ngozi.id,
    file_key: `schools/${brightMinds.id}/submissions/seed-ngozi-chem-worksheet1.pdf`,
    file_name: 'ngozi-worksheet1.pdf',
    submitted_at: daysAgo(2),
    score: 13.5,
    feedback: 'Good work — double check questions 7 and 12.',
    reviewed_at: daysAgo(1),
    reviewed_by: chidi.id,
  });

  // Unreviewed submission — sits in the grading queue.
  await insertOne('submissions', {
    school_id: brightMinds.id,
    assignment_id: chemistryAssignment.id,
    student_id: tunde.id,
    file_key: `schools/${brightMinds.id}/submissions/seed-tunde-chem-worksheet1.pdf`,
    file_name: 'tunde-worksheet1.pdf',
    submitted_at: daysAgo(1),
  });

  // ---------------------------------------------------------------------
  // 11. Mock exams — one published with a graded/ungraded attempt,
  //     one still draft (for the auto-publish background job to pick up)
  // ---------------------------------------------------------------------
  console.log('Creating mock exams, questions, and a student attempt...');

  const chemistryMock = await insertOne('mock_exams', {
    school_id: brightMinds.id,
    course_id: chemistry.id,
    tutor_id: chidi.id,
    title: 'Chemistry Mock — Atomic Structure',
    description: 'Covers atomic structure and periodicity.',
    status: 'published',
    publish_at: daysAgo(3),
    time_limit_minutes: 30,
    total_mcq_questions: 2,
    total_theory_questions: 1,
  });

  const physicsDraftMock = await insertOne('mock_exams', {
    school_id: brightMinds.id,
    course_id: physics.id,
    tutor_id: amaka.id,
    title: 'Physics Mock — Waves (Draft)',
    description: 'Not yet released to students.',
    status: 'draft',
    publish_at: daysFromNow(1), // the auto-publish job should pick this up
    time_limit_minutes: 30,
    total_mcq_questions: 0,
    total_theory_questions: 0,
  });

  const mcq1 = await insertOne('mock_questions', {
    school_id: brightMinds.id,
    mock_exam_id: chemistryMock.id,
    question_type: 'mcq',
    question_text: 'What is the atomic number of Carbon?',
    marks: 2,
    order_index: 1,
  });
  const mcq1OptA = await insertOne('mock_question_options', {
    school_id: brightMinds.id,
    question_id: mcq1.id,
    option_text: '6',
    is_correct: true,
    order_index: 1,
  });
  await insertOne('mock_question_options', {
    school_id: brightMinds.id,
    question_id: mcq1.id,
    option_text: '12',
    is_correct: false,
    order_index: 2,
  });

  const mcq2 = await insertOne('mock_questions', {
    school_id: brightMinds.id,
    mock_exam_id: chemistryMock.id,
    question_type: 'mcq',
    question_text: 'Which group do the noble gases belong to?',
    marks: 2,
    order_index: 2,
  });
  await insertOne('mock_question_options', {
    school_id: brightMinds.id,
    question_id: mcq2.id,
    option_text: 'Group 0 / 18',
    is_correct: true,
    order_index: 1,
  });
  const mcq2OptWrong = await insertOne('mock_question_options', {
    school_id: brightMinds.id,
    question_id: mcq2.id,
    option_text: 'Group 1',
    is_correct: false,
    order_index: 2,
  });

  const theoryQ = await insertOne('mock_questions', {
    school_id: brightMinds.id,
    mock_exam_id: chemistryMock.id,
    question_type: 'theory',
    question_text: 'Explain why noble gases are chemically unreactive.',
    marks: 5,
    order_index: 3,
  });

  // Ngozi's attempt: got MCQ1 right, MCQ2 wrong, theory still ungraded.
  const ngoziAttempt = await insertOne('mock_attempts', {
    school_id: brightMinds.id,
    mock_exam_id: chemistryMock.id,
    student_id: ngozi.id,
    started_at: daysAgo(2),
    submitted_at: daysAgo(2),
    status: 'submitted',
    mcq_score: 2,
    total_mcq_questions: 2,
    correct_mcq_answers: 1,
  });

  await insertOne('mock_answers', {
    school_id: brightMinds.id,
    attempt_id: ngoziAttempt.id,
    question_id: mcq1.id,
    selected_option_id: mcq1OptA.id,
    is_correct: true,
  });

  await insertOne('mock_answers', {
    school_id: brightMinds.id,
    attempt_id: ngoziAttempt.id,
    question_id: mcq2.id,
    selected_option_id: mcq2OptWrong.id,
    is_correct: false,
  });

  await insertOne('mock_answers', {
    school_id: brightMinds.id,
    attempt_id: ngoziAttempt.id,
    question_id: theoryQ.id,
    theory_answer_text: 'Noble gases have a full outer electron shell, so they have no tendency to gain, lose, or share electrons.',
    is_correct: null, // theory — ungraded until a tutor scores it
    tutor_score: null,
  });

  // ---------------------------------------------------------------------
  // 12. Reviews, school promos, notifications
  // ---------------------------------------------------------------------
  console.log('Creating reviews, promos, and notifications...');

  await insertOne('reviews', {
    school_id: brightMinds.id,
    student_id: ngozi.id,
    programme_id: waecBootcamp.id,
    rating: 5,
    review_text: 'The live classes and notes library made WAEC prep so much less stressful.',
    is_published: true,
  });

  await insertOne('school_promos', {
    school_id: brightMinds.id,
    title: 'Enrol in WAEC Bootcamp 2026',
    image_key: `schools/${brightMinds.id}/promos/seed-waec-bootcamp-banner.jpg`,
    link_type: 'programme',
    link_id: waecBootcamp.id,
    order_index: 1,
    is_active: true,
  });

  await insertOne('notifications', {
    school_id: brightMinds.id,
    user_id: ngozi.id,
    type: 'live_class_reminder',
    title: 'Physics class starting soon',
    body: 'Your Waves and Optics class starts in 2 days.',
    is_read: false,
    related_entity_type: 'live_class',
    related_entity_id: physicsScheduled.id,
  });

  await insertOne('notifications', {
    school_id: brightMinds.id,
    user_id: ngozi.id,
    type: 'enrolment_confirmed',
    title: 'You\'re enrolled in WAEC Bootcamp 2026',
    body: 'Your payment was confirmed and you now have full access.',
    is_read: true,
    related_entity_type: 'programme',
    related_entity_id: waecBootcamp.id,
  });

  await insertOne('notifications', {
    school_id: brightMinds.id,
    user_id: tunde.id,
    type: 'assignment_deadline',
    title: 'Assignment due soon',
    body: 'Balancing Chemical Equations — Worksheet 1 is due in 3 days.',
    is_read: false,
    related_entity_type: 'assignment',
    related_entity_id: chemistryAssignment.id,
  });

  await insertOne('notifications', {
    school_id: brightMinds.id,
    user_id: ngozi.id,
    type: 'mock_published',
    title: 'New mock exam available',
    body: 'Chemistry Mock — Atomic Structure is now available to take.',
    is_read: true,
    related_entity_type: 'mock_exam',
    related_entity_id: chemistryMock.id,
  });

  // ---------------------------------------------------------------------
  // Done — print login credentials for manual testing
  // ---------------------------------------------------------------------
  console.log('\nSeed complete.\n');
  console.log('Bright Minds Tutorials (bright-minds-seed) — has Paystack subaccount, active Kanvise subscription');
  console.log('Apex Learning Hub (apex-learning-seed) — NO Paystack subaccount yet, pending Kanvise subscription\n');
  console.log('Login credentials (all share the same password):');
  console.log(`Password: ${SEED_PASSWORD}\n`);
  for (const c of credentials) {
    console.log(`  [${c.role.padEnd(7)}] ${c.name.padEnd(20)} ${c.email}`);
  }
  console.log('\nNotable seeded states to check against:');
  console.log('  - Chidi (admin) is also assigned to teach Chemistry — the solo admin-tutor case');
  console.log('  - Ngozi enrolled at Programme level, Tunde at Sub-programme level, Fatima at Course level');
  console.log('  - Emeka has a pending payment, Bola a failed one — neither has an enrolment');
  console.log('  - Grace (Apex) is enrolled in a course also named "Chemistry" — a different course entirely from Bright Minds\' Chemistry — good for spotting a missing school_id filter');
  console.log('  - tutor_invites has one row in each of pending/accepted/expired/revoked');
  console.log('  - Physics has a class currently "live", one scheduled, Chemistry has one "completed" with attendance');
  console.log('  - Chemistry mock exam is published with one graded MCQ set and one still-ungraded theory answer (Ngozi\'s attempt)');
  console.log('  - Physics mock exam is still "draft" with a publish_at in the future — good for testing the auto-publish job');
}

run().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
