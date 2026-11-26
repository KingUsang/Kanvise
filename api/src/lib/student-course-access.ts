import { supabase } from './supabase'

const db = supabase as any

export type StudentEnrolment = {
  programme_id: string | null
  sub_programme_id: string | null
  course_id: string | null
}

export type StudentCourse = {
  id: string
  programme_id: string | null
  sub_programme_id: string | null
}

/**
 * Builds the PostgREST predicate for every enrolment that grants access to a
 * course. Keep this aligned with resolveStudentCourses: a programme purchase
 * grants its courses, including courses nested inside one of its
 * sub-programmes.
 */
export function courseAccessEnrolmentFilter(
  course: StudentCourse,
  subProgramme?: { id: string; programme_id: string } | null,
) {
  const filters = [`course_id.eq.${course.id}`]
  if (course.programme_id) filters.push(`programme_id.eq.${course.programme_id}`)
  if (course.sub_programme_id) filters.push(`sub_programme_id.eq.${course.sub_programme_id}`)
  if (subProgramme?.programme_id) filters.push(`programme_id.eq.${subProgramme.programme_id}`)
  return filters.join(',')
}

export function resolveStudentCourses<T extends StudentCourse>(
  enrolments: StudentEnrolment[],
  courses: T[],
  subProgrammes: Array<{ id: string; programme_id: string }> = [],
) {
  const programmeIds = new Set(enrolments.flatMap((item) => item.programme_id ? [item.programme_id] : []))
  const subProgrammeIds = new Set(enrolments.flatMap((item) => item.sub_programme_id ? [item.sub_programme_id] : []))
  const courseIds = new Set(enrolments.flatMap((item) => item.course_id ? [item.course_id] : []))
  const subProgrammeParents = new Map(subProgrammes.map((item) => [item.id, item.programme_id]))

  return courses.filter((course) => courseIds.has(course.id)
    || Boolean(course.programme_id && programmeIds.has(course.programme_id))
    || Boolean(course.sub_programme_id && subProgrammeIds.has(course.sub_programme_id))
    || Boolean(course.sub_programme_id && programmeIds.has(subProgrammeParents.get(course.sub_programme_id) || '')))
}

/**
 * True only while the person holds an active Learner membership in the
 * account. account_memberships is the canonical source (DEV-ACC-001); the
 * legacy student_centre_memberships table is kept in sync by a trigger and is
 * no longer read for access decisions.
 */
export async function hasActiveLearnerMembership(studentId: string, schoolId: string) {
  const { data: membership, error } = await db.from('account_memberships')
    .select('id')
    .eq('person_id', studentId)
    .eq('school_id', schoolId)
    .eq('role', 'learner')
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw new Error('Could not resolve student course access')
  return Boolean(membership)
}

export async function loadStudentCourseIds(studentId: string, schoolId: string) {
  if (!await hasActiveLearnerMembership(studentId, schoolId)) return []

  const [{ data: enrolments, error: enrolmentsError }, { data: courses, error: coursesError }, { data: subProgrammes, error: subProgrammesError }] = await Promise.all([
    supabase.from('enrolments').select('programme_id, sub_programme_id, course_id')
      .eq('student_id', studentId).eq('school_id', schoolId),
    supabase.from('courses').select('id, programme_id, sub_programme_id').eq('school_id', schoolId),
    supabase.from('sub_programmes').select('id, programme_id').eq('school_id', schoolId),
  ])
  if (enrolmentsError || coursesError || subProgrammesError) {
    throw new Error('Could not resolve student course access')
  }
  return resolveStudentCourses(enrolments || [], courses || [], subProgrammes || []).map((course) => course.id)
}
