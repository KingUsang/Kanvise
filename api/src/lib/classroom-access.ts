import { supabase } from './supabase'
import { loadStudentCourseIds } from './student-course-access'

/**
 * The one policy boundary for an already-created live class.
 *
 * `role` determines a person's baseline access to a centre; `tutor_id` is the
 * per-class teaching assignment. That distinction is what lets an admin who
 * is assigned to teach host their own class without giving every admin host
 * control over every tutor's classroom.
 */
export type ClassroomUser = { id: string; school_id: string; role: string }

export type ClassroomRecord = {
  id: string
  school_id: string
  course_id: string
  tutor_id: string
  status: string
  livekit_room_name?: string | null
  [key: string]: unknown
}

export type ClassroomAccessFailure =
  | 'missing'
  | 'wrong_school'
  | 'not_enrolled'
  | 'not_assigned_tutor'
  | 'lookup_failed'

export type ClassroomAccess =
  | { liveClass: ClassroomRecord; isHost: boolean }
  | { reason: ClassroomAccessFailure }

export type ClassroomAccessLevel = 'view' | 'host'

export async function resolveClassroomAccess(
  classId: string,
  user: ClassroomUser,
  level: ClassroomAccessLevel = 'view',
): Promise<ClassroomAccess> {
  // Deliberately look up by ID first. Querying with school_id would turn a
  // tenant mismatch and a database failure into an indistinguishable 404.
  const { data, error } = await supabase.from('live_classes')
    .select('*, courses(name), school:schools(name)')
    .eq('id', classId)
    .maybeSingle()

  if (error) return { reason: 'lookup_failed' }
  if (!data) return { reason: 'missing' }

  const liveClass = data as ClassroomRecord
  if (liveClass.school_id !== user.school_id) return { reason: 'wrong_school' }

  if (user.role === 'student') {
    const courseIds = await loadStudentCourseIds(user.id, user.school_id)
    if (!courseIds.includes(liveClass.course_id)) return { reason: 'not_enrolled' }
  }

  // An admin can observe any classroom in their centre. A tutor can access
  // only their assigned classroom. Both roles become a host only when their
  // profile is the tutor assigned to this exact class.
  const isHost = liveClass.tutor_id === user.id && (user.role === 'admin' || user.role === 'tutor')
  if (user.role === 'tutor' && !isHost) return { reason: 'not_assigned_tutor' }
  if (level === 'host' && !isHost) return { reason: 'not_assigned_tutor' }

  return { liveClass, isHost }
}

export function classroomAccessError(reason: ClassroomAccessFailure) {
  switch (reason) {
    case 'missing':
      return { status: 404 as const, error: 'Class not found', code: 'NOT_FOUND' }
    case 'wrong_school':
      return { status: 403 as const, error: 'This class belongs to a different centre', code: 'WRONG_SCHOOL' }
    case 'not_enrolled':
      return { status: 403 as const, error: 'You are not enrolled in this class', code: 'NOT_ENROLLED' }
    case 'not_assigned_tutor':
      return { status: 403 as const, error: 'You are not the tutor assigned to this class', code: 'NOT_CLASS_TUTOR' }
    case 'lookup_failed':
      return { status: 500 as const, error: 'Could not verify class access', code: 'CLASS_ACCESS_FAILED' }
  }
}
