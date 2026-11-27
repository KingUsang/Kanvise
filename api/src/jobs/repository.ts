import { supabase } from '../lib/supabase'
import { listCourseLearnerIds } from '../lib/student-course-access'

export type DueMock = {
  id: string; schoolId: string; courseId: string | null; programmeId: string | null
  audienceScope: 'course' | 'programme' | 'school' | 'combination' | 'direct_link'; title: string; courseName: string
}
export type DueLiveClass = { id: string; schoolId: string; courseId: string; title: string; courseName: string; startsAt: string }
export type DueAssignment = { id: string; schoolId: string; courseId: string; title: string; courseName: string; deadlineAt: string; recipientIds: string[] }

export type JobsRepository = {
  materializeTimetableClasses(horizonDays: number): Promise<number>
  claimDueMocks(now: Date, limit: number): Promise<DueMock[]>
  markMockPublicationNotified(id: string): Promise<void>
  findDueLiveClasses(windowStart: Date, windowEnd: Date, limit: number): Promise<DueLiveClass[]>
  markLiveClassReminderSent(id: string): Promise<void>
  findDueAssignments(windowStart: Date, windowEnd: Date, limit: number): Promise<DueAssignment[]>
}

export const jobsRepository: JobsRepository = {
  async materializeTimetableClasses(horizonDays) {
    const { data, error } = await supabase.rpc('materialize_published_class_timetables' as any, {
      p_horizon_days: horizonDays,
    } as any)
    if (error) throw error
    return Number(data || 0)
  },

  async claimDueMocks(now, limit) {
    const { data: candidates, error } = await supabase.from('mock_exams')
      .select('id, status, school_id, course_id, programme_id, audience_scope, tutor_id, title, course:courses(name), programme:programmes(name)')
      .in('status', ['draft', 'published'])
      .eq('notification_sent', false)
      .not('publish_at', 'is', null)
      .lte('publish_at', now.toISOString())
      .order('publish_at', { ascending: true })
      .limit(limit)
    if (error) throw error

    const claimed: DueMock[] = []
    for (const candidate of candidates || []) {
      if (candidate.status === 'published') {
        claimed.push(toDueMock(candidate))
        continue
      }
      const { count: sectionCount, error: sectionError } = await supabase.from('mock_sections')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', candidate.school_id).eq('mock_exam_id', candidate.id)
      if (sectionError) throw sectionError
      if ((sectionCount || 0) > 0) {
        const { error: publishError } = await supabase.rpc('publish_versioned_mock', {
          p_school_id: candidate.school_id,
          p_mock_exam_id: candidate.id,
          p_published_by: candidate.tutor_id,
          p_published_at: now.toISOString(),
        })
        if (publishError) throw publishError
        claimed.push(toDueMock(candidate))
        continue
      }
      // Compatibility for scheduled drafts created before versioned question banks.
      const { data, error: claimError } = await supabase.from('mock_exams')
        .update({ status: 'published', updated_at: now.toISOString() })
        .eq('id', candidate.id)
        .eq('status', 'draft')
        .select('id, school_id, course_id, programme_id, audience_scope, title, course:courses(name), programme:programmes(name)')
        .maybeSingle()
      if (claimError) throw claimError
      if (data) claimed.push(toDueMock(data))
    }
    return claimed
  },

  async markMockPublicationNotified(id) {
    const { error } = await supabase.from('mock_exams').update({ notification_sent: true }).eq('id', id)
    if (error) throw error
  },

  async findDueLiveClasses(windowStart, windowEnd, limit) {
    const { data, error } = await supabase.from('live_classes')
      .select('id, school_id, course_id, title, scheduled_at, course:courses!live_classes_course_id_fkey(name)')
      .eq('status', 'scheduled')
      .eq('notification_sent', false)
      .gte('scheduled_at', windowStart.toISOString())
      .lt('scheduled_at', windowEnd.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limit)
    if (error) throw error
    // Reminders are addressed through course enrolments, so classes without a course have no recipients.
    return (data || []).flatMap((item) => item.course_id ? [{
      id: item.id, schoolId: item.school_id, courseId: item.course_id, title: item.title,
      courseName: (item.course as any)?.name || 'Your course', startsAt: item.scheduled_at,
    }] : [])
  },

  async markLiveClassReminderSent(id) {
    const { error } = await supabase.from('live_classes').update({ notification_sent: true }).eq('id', id)
    if (error) throw error
  },

  async findDueAssignments(windowStart, windowEnd, limit) {
    const { data, error } = await supabase.from('assignments')
      .select('id, school_id, course_id, title, deadline_at, course:courses(name)')
      .eq('is_published', true)
      .gte('deadline_at', windowStart.toISOString())
      .lt('deadline_at', windowEnd.toISOString())
      .order('deadline_at', { ascending: true })
      .limit(limit)
    if (error) throw error

    const results: DueAssignment[] = []
    for (const assignment of data || []) {
      const [learnerIds, { data: submissions, error: submissionError }] = await Promise.all([
        listCourseLearnerIds(assignment.school_id, assignment.course_id),
        supabase.from('submissions').select('student_id').eq('school_id', assignment.school_id).eq('assignment_id', assignment.id),
      ])
      if (submissionError) throw submissionError
      const submitted = new Set((submissions || []).map((item) => item.student_id))
      const recipientIds = learnerIds.filter((id) => !submitted.has(id))
      results.push({
        id: assignment.id, schoolId: assignment.school_id, courseId: assignment.course_id,
        title: assignment.title, courseName: (assignment.course as any)?.name || 'Your course',
        deadlineAt: assignment.deadline_at, recipientIds,
      })
    }
    return results
  },
}

function toDueMock(mock: any): DueMock {
  const audienceScope = ['course', 'programme', 'school', 'combination', 'direct_link'].includes(mock.audience_scope)
    ? mock.audience_scope as DueMock['audienceScope']
    : 'course'
  return {
    id: mock.id,
    schoolId: mock.school_id,
    courseId: mock.course_id,
    programmeId: mock.programme_id,
    audienceScope,
    title: mock.title,
    courseName: audienceScope === 'programme'
      ? (mock.programme as any)?.name || 'Your class'
      : (mock.course as any)?.name || 'Your tutoring agency',
  }
}
