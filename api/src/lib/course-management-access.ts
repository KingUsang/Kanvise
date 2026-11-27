import { supabase } from './supabase'
import type { TenantUser } from '../types'

export type CourseAccessResult = { allowed: boolean; error?: unknown }

/**
 * Whether the account user can manage a Course: an Admin of the account, or a
 * Tutor assigned to the Course. Lookup failures are returned in `error` so the
 * caller can answer 503 instead of treating them as a denial.
 */
export async function tutorCanManageCourse(user: TenantUser, courseId: string): Promise<CourseAccessResult> {
  if (!user.school_id) return { allowed: false }
  const course = await supabase.from('courses')
    .select('id, programme_id')
    .eq('id', courseId)
    .eq('school_id', user.school_id)
    .maybeSingle()
  if (course.error) return { allowed: false, error: course.error }
  if (!course.data) return { allowed: false }
  if (user.role === 'admin') return { allowed: true }
  if (user.role !== 'tutor') return { allowed: false }
  const { data, error } = await supabase.from('tutor_course_assignments')
    .select('id')
    .eq('school_id', user.school_id)
    .eq('course_id', courseId)
    .eq('tutor_id', user.id)
    .maybeSingle()
  if (error) return { allowed: false, error }
  return { allowed: Boolean(data) }
}
