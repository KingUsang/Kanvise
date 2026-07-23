import { supabase } from '../lib/supabase'

export type DueMock = { id: string; schoolId: string; courseId: string; title: string; courseName: string }
export type DueLiveClass = DueMock & { startsAt: string }
export type DueAssignment = DueMock & { deadlineAt: string; recipientIds: string[] }

export type JobsRepository = {
  claimDueMocks(now: Date, limit: number): Promise<DueMock[]>
  markMockPublicationNotified(id: string): Promise<void>
  findDueLiveClasses(windowStart: Date, windowEnd: Date, limit: number): Promise<DueLiveClass[]>
  markLiveClassReminderSent(id: string): Promise<void>
  findDueAssignments(windowStart: Date, windowEnd: Date, limit: number): Promise<DueAssignment[]>
}

export const jobsRepository: JobsRepository = {
  async claimDueMocks(now, limit) {
    const { data: candidates, error } = await supabase.from('mock_exams')
      .select('id, status, school_id, course_id, tutor_id, title, course:courses(name)')
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
        claimed.push({
          id: candidate.id, schoolId: candidate.school_id, courseId: candidate.course_id,
          title: candidate.title, courseName: (candidate.course as any)?.name || 'Your course',
        })
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
        claimed.push({
          id: candidate.id, schoolId: candidate.school_id, courseId: candidate.course_id,
          title: candidate.title, courseName: (candidate.course as any)?.name || 'Your course',
        })
        continue
      }
      // Compatibility for scheduled drafts created before versioned question banks.
      const { data, error: claimError } = await supabase.from('mock_exams')
        .update({ status: 'published', updated_at: now.toISOString() })
        .eq('id', candidate.id)
        .eq('status', 'draft')
        .select('id, school_id, course_id, title, course:courses(name)')
        .maybeSingle()
      if (claimError) throw claimError
      if (data) claimed.push({
        id: data.id, schoolId: data.school_id, courseId: data.course_id,
        title: data.title, courseName: (data.course as any)?.name || 'Your course',
      })
    }
    return claimed
  },

  async markMockPublicationNotified(id) {
    const { error } = await supabase.from('mock_exams').update({ notification_sent: true }).eq('id', id)
    if (error) throw error
  },

  async findDueLiveClasses(windowStart, windowEnd, limit) {
    const { data, error } = await supabase.from('live_classes')
      .select('id, school_id, course_id, title, scheduled_at, course:courses(name)')
      .eq('status', 'scheduled')
      .eq('notification_sent', false)
      .gte('scheduled_at', windowStart.toISOString())
      .lt('scheduled_at', windowEnd.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data || []).map((item) => ({
      id: item.id, schoolId: item.school_id, courseId: item.course_id, title: item.title,
      courseName: (item.course as any)?.name || 'Your course', startsAt: item.scheduled_at,
    }))
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
      const [{ data: enrolments, error: enrolmentError }, { data: submissions, error: submissionError }] = await Promise.all([
        supabase.from('enrolments').select('student_id').eq('school_id', assignment.school_id).eq('course_id', assignment.course_id),
        supabase.from('submissions').select('student_id').eq('school_id', assignment.school_id).eq('assignment_id', assignment.id),
      ])
      if (enrolmentError) throw enrolmentError
      if (submissionError) throw submissionError
      const submitted = new Set((submissions || []).map((item) => item.student_id))
      const recipientIds = [...new Set((enrolments || []).map((item) => item.student_id))].filter((id) => !submitted.has(id))
      results.push({
        id: assignment.id, schoolId: assignment.school_id, courseId: assignment.course_id,
        title: assignment.title, courseName: (assignment.course as any)?.name || 'Your course',
        deadlineAt: assignment.deadline_at, recipientIds,
      })
    }
    return results
  },
}
