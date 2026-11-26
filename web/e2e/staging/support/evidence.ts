import { createClient } from '@supabase/supabase-js'
import { updateManifest } from './run-manifest'

const supabase = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findAuthUser(email: string) {
  const client = supabase()
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
    if (user?.email) return { id: user.id, email: user.email }
    if (data.users.length < 100) break
  }
  throw new Error(`Evidence inspection could not find auth user ${email}`)
}

export async function recordPendingAuthUser(email: string) {
  const authUser = await findAuthUser(email)
  await updateManifest((manifest) => {
    if (!manifest.authUsers.some((item) => item.id === authUser.id)) manifest.authUsers.push(authUser)
  })
  return authUser
}

export async function recordRegisteredCentre(email: string, expectedName: string) {
  const client = supabase()
  const authUser = await findAuthUser(email)

  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('id,auth_user_id,school_id,role,email')
    .eq('auth_user_id', authUser.id)
    .single()
  if (profileError) throw profileError
  if (profile.role !== 'admin' || !profile.school_id) throw new Error(`Registered user ${email} is not an activated centre admin`)

  const { data: school, error: schoolError } = await client
    .from('schools')
    .select('id,name,slug')
    .eq('id', profile.school_id)
    .single()
  if (schoolError) throw schoolError
  if (school.name !== expectedName) throw new Error(`School evidence mismatch: expected ${expectedName}, received ${school.name}`)

  await updateManifest((manifest) => {
    if (!manifest.authUsers.some((item) => item.id === authUser.id)) manifest.authUsers.push(authUser)
    manifest.tenants.push({ id: school.id, name: school.name, slug: school.slug })
    manifest.database.push({ table: 'user_profiles', id: profile.id, schoolId: school.id })
    manifest.providers.push({ provider: 'gmail', kind: 'mailbox-recipient', id: email })
  })
  return { authUser, profile, school }
}

export async function recordCreatedClass(schoolId: string, expectedName: string, expectedSubject: string) {
  const client = supabase()
  const { data: programme, error } = await client
    .from('programmes')
    .select('id,school_id,name')
    .eq('school_id', schoolId)
    .eq('name', expectedName)
    .single()
  if (error) throw error
  const { data: subjects, error: subjectsError } = await client
    .from('courses')
    .select('id,school_id,name,programme_id')
    .eq('school_id', schoolId)
    .eq('programme_id', programme.id)
  if (subjectsError) throw subjectsError
  const subject = subjects.find((item) => item.name === expectedSubject)
  if (!subject) throw new Error(`Class ${programme.id} did not persist subject ${expectedSubject}`)

  await updateManifest((manifest) => {
    manifest.database.push(
      { table: 'programmes', id: programme.id, schoolId },
      { table: 'courses', id: subject.id, schoolId },
    )
  })
  return { programme, subject }
}

export async function recordActivatedStudent(email: string, schoolId: string, programmeId: string) {
  const client = supabase()
  const authUser = await findAuthUser(email)
  const { data: profile, error } = await client
    .from('user_profiles')
    .select('id,auth_user_id,school_id,role,email,onboarding_status')
    .eq('auth_user_id', authUser.id)
    .single()
  if (error) throw error
  if (profile.role !== 'student' || profile.school_id !== schoolId || profile.onboarding_status !== 'active') {
    throw new Error(`Student ${email} was not activated in the expected tenant`)
  }
  const { data: enrolment, error: enrolmentError } = await client
    .from('enrolments')
    .select('id,school_id,student_id,programme_id')
    .eq('school_id', schoolId)
    .eq('student_id', profile.id)
    .eq('programme_id', programmeId)
    .single()
  if (enrolmentError) throw enrolmentError
  await updateManifest((manifest) => {
    if (!manifest.authUsers.some((item) => item.id === authUser.id)) manifest.authUsers.push(authUser)
    manifest.database.push(
      { table: 'user_profiles', id: profile.id, schoolId },
      { table: 'enrolments', id: enrolment.id, schoolId },
    )
  })
  return { authUser, profile, enrolment }
}

export async function recordActivatedTutor(email: string, schoolId: string, courseId: string) {
  const client = supabase()
  const authUser = await findAuthUser(email)
  const { data: profile, error } = await client.from('user_profiles')
    .select('id,auth_user_id,school_id,role,email,onboarding_status')
    .eq('auth_user_id', authUser.id).single()
  if (error) throw error
  if (profile.role !== 'tutor' || profile.school_id !== schoolId || profile.onboarding_status !== 'active') {
    throw new Error(`Tutor ${email} was not activated in the expected tenant`)
  }
  const { data: assignment, error: assignmentError } = await client.from('tutor_course_assignments')
    .select('id,school_id,tutor_id,course_id').eq('school_id', schoolId)
    .eq('tutor_id', profile.id).eq('course_id', courseId).single()
  if (assignmentError) throw assignmentError
  await updateManifest((manifest) => {
    if (!manifest.authUsers.some((item) => item.id === authUser.id)) manifest.authUsers.push(authUser)
    addDatabaseResource(manifest, 'user_profiles', profile.id, schoolId)
    addDatabaseResource(manifest, 'tutor_course_assignments', assignment.id, schoolId)
  })
  return { authUser, profile, assignment }
}

function addDatabaseResource(manifest: Awaited<ReturnType<typeof updateManifest>>, table: string, id: string, schoolId: string) {
  if (!manifest.database.some((item) => item.table === table && item.id === id)) {
    manifest.database.push({ table, id, schoolId })
  }
}

function addR2Object(manifest: Awaited<ReturnType<typeof updateManifest>>, key: string, schoolId: string) {
  const bucket = process.env.R2_BUCKET_NAME!
  if (!bucket) throw new Error('R2_BUCKET_NAME is required for storage evidence')
  if (!manifest.r2Objects.some((item) => item.bucket === bucket && item.key === key)) {
    manifest.r2Objects.push({ bucket, key, schoolId })
  }
}

export async function recordMaterial(schoolId: string, courseId: string, title: string) {
  const client = supabase()
  const { data, error } = await client.from('notes')
    .select('id,school_id,course_id,title,file_key,file_name')
    .eq('school_id', schoolId).eq('course_id', courseId).eq('title', title).single()
  if (error) throw error
  await updateManifest((manifest) => {
    addDatabaseResource(manifest, 'notes', data.id, schoolId)
    addR2Object(manifest, data.file_key, schoolId)
  })
  return data
}

export async function recordAssignment(schoolId: string, courseId: string, title: string) {
  const client = supabase()
  const { data, error } = await client.from('assignments')
    .select('id,school_id,course_id,title,is_published,attachment_file_key')
    .eq('school_id', schoolId).eq('course_id', courseId).eq('title', title).single()
  if (error) throw error
  if (!data.is_published) throw new Error(`Assignment ${data.id} was not published`)
  await updateManifest((manifest) => {
    addDatabaseResource(manifest, 'assignments', data.id, schoolId)
    if (data.attachment_file_key) addR2Object(manifest, data.attachment_file_key, schoolId)
  })
  return data
}

export async function recordSubmission(schoolId: string, assignmentId: string) {
  const client = supabase()
  const { data, error } = await client.from('submissions')
    .select('id,school_id,assignment_id,file_key,score,feedback,reviewed_at')
    .eq('school_id', schoolId).eq('assignment_id', assignmentId).single()
  if (error) throw error
  await updateManifest((manifest) => {
    addDatabaseResource(manifest, 'submissions', data.id, schoolId)
    addR2Object(manifest, data.file_key, schoolId)
  })
  return data
}
