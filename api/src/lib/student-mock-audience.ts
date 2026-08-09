import { parseMockAudienceScope } from '../domain/mock-audience'
import { loadStudentCourseIds } from './student-course-access'
import { supabase } from './supabase'

export type StudentMockAudience = { courseIds: string[]; programmeIds: string[] }

export async function loadStudentMockAudience(user: { id: string; school_id?: string | null }): Promise<StudentMockAudience> {
  if (!user.school_id) return { courseIds: [], programmeIds: [] }
  const [courseIds, enrolments] = await Promise.all([
    loadStudentCourseIds(user.id, user.school_id),
    supabase.from('enrolments').select('programme_id').eq('student_id', user.id).eq('school_id', user.school_id),
  ])
  if (enrolments.error) throw enrolments.error
  return {
    courseIds,
    // Programme-wide mocks are intentionally only for a student's full
    // programme enrolment. Buying one standalone course must not unlock a
    // whole JAMB programme mock.
    programmeIds: [...new Set((enrolments.data || []).flatMap(item => item.programme_id ? [item.programme_id] : []))],
  }
}

export function studentCanAccessCentreMock(mock: { audience_scope?: string | null; course_id?: string | null; programme_id?: string | null }, audience: StudentMockAudience) {
  const scope = parseMockAudienceScope(mock.audience_scope ?? 'course') || 'course'
  return (scope === 'course' && typeof mock.course_id === 'string' && audience.courseIds.includes(mock.course_id))
    || (scope === 'programme' && typeof mock.programme_id === 'string' && audience.programmeIds.includes(mock.programme_id))
    || scope === 'school'
}
