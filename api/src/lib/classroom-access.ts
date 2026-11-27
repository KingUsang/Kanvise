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
  course_id: string | null
  tutor_id: string
  status: string
  [key: string]: unknown
}

export type ClassroomAccessFailure =
  | 'missing'
  | 'not_enrolled'
  | 'not_assigned_tutor'
  | 'lookup_failed'
  | 'unsupported_role'

export type ClassroomAccess =
  | { liveClass: ClassroomRecord; isHost: boolean }
  | { reason: ClassroomAccessFailure }

export type ClassroomAccessLevel = 'view' | 'host' | 'takeover'

export async function resolveClassroomAccess(
  classId: string,
  user: ClassroomUser,
  level: ClassroomAccessLevel = 'view',
): Promise<ClassroomAccess> {
  // Only the supported audiences may reach a Session. Other roles (including
  // legacy super_admin) get no implicit access through an account match
  // (DEV-LVC-033).
  if (!['admin', 'tutor', 'student'].includes(user.role)) return { reason: 'unsupported_role' }
  // Scope the lookup to the selected active account. A class in another
  // account is indistinguishable from a missing one, so its existence is not
  // revealed (DEV-ACC-003). A database failure still surfaces as lookup_failed.
  const { data, error } = await supabase.from('live_classes')
    .select('*, courses!live_classes_course_id_fkey(name), school:schools(name)')
    .eq('id', classId)
    .eq('school_id', user.school_id)
    .maybeSingle()

  if (error) return { reason: 'lookup_failed' }
  if (!data) return { reason: 'missing' }

  const liveClass = data as ClassroomRecord

  if (user.role === 'student' && liveClass.access_mode !== 'anyone_with_link') {
    const courseIds = await loadStudentCourseIds(user.id, user.school_id)
    if (!liveClass.course_id || !courseIds.includes(liveClass.course_id)) return { reason: 'not_enrolled' }
  }

  const isHost = liveClass.tutor_id === user.id && (user.role === 'admin' || user.role === 'tutor')
  if (user.role === 'tutor' && !isHost) return { reason: 'not_assigned_tutor' }
  // Takeover is deliberately narrower than general host access. An admin can
  // start a scheduled classroom for an absent tutor, but cannot thereby edit
  // its teaching materials or end an already-running class.
  if (level === 'takeover' && user.role === 'admin') return { liveClass, isHost: true }
  if (level === 'host' && !isHost) return { reason: 'not_assigned_tutor' }

  return { liveClass, isHost }
}

export function classroomAccessError(reason: ClassroomAccessFailure) {
  switch (reason) {
    case 'missing':
      return { status: 404 as const, error: 'Class not found', code: 'NOT_FOUND' }
    case 'not_enrolled':
      return { status: 403 as const, error: 'You are not enrolled in this class', code: 'NOT_ENROLLED' }
    case 'not_assigned_tutor':
      return { status: 403 as const, error: 'You are not the tutor assigned to this class', code: 'NOT_CLASS_TUTOR' }
    case 'unsupported_role':
      return { status: 403 as const, error: 'Your role cannot access live classes', code: 'INSUFFICIENT_ROLE' }
    case 'lookup_failed':
      return { status: 500 as const, error: 'Could not verify class access', code: 'CLASS_ACCESS_FAILED' }
  }
}
