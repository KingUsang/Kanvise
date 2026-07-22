import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, Variables } from '../middleware/auth'

export const dashboardRouter = new Hono<{ Variables: Variables }>()

dashboardRouter.use('*', jwtVerificationMiddleware)
dashboardRouter.use('*', profileResolutionMiddleware)
dashboardRouter.use('*', tenantMiddleware)

async function loadNeedsGrading(schoolId: string, tutorId?: string) {
  let assignmentsQuery = supabase
    .from('assignments')
    .select('id, title, courses(name)')
    .eq('school_id', schoolId)
    .limit(20)

  if (tutorId) assignmentsQuery = assignmentsQuery.eq('tutor_id', tutorId)

  const { data: recentAssignments } = await assignmentsQuery
  if (!recentAssignments) return []

  const items = await Promise.all(recentAssignments.map(async (assignment) => {
    const [{ count: total }, { count: graded }] = await Promise.all([
      supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', assignment.id).eq('school_id', schoolId),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', assignment.id).eq('school_id', schoolId).not('score', 'is', null),
    ])

    return {
      id: assignment.id,
      kind: 'assignment',
      href: `/dashboard/assignments/${assignment.id}/submissions`,
      title: assignment.title,
      context: `${(assignment.courses as any)?.name || 'General'} • ${(total || 0) - (graded || 0)} waiting`,
      pending_count: (total || 0) - (graded || 0),
      progress: total ? Math.round(((graded || 0) / total) * 100) : 0,
    }
  }))

  return items.filter((item) => item.pending_count > 0)
    .sort((a, b) => b.pending_count - a.pending_count)
    .slice(0, 3)
}

async function loadMockOverview(schoolId: string, tutorId?: string) {
  let mocksQuery = supabase.from('mock_exams')
    .select('id, title, course_id, courses(name)')
    .eq('school_id', schoolId)
    .eq('status', 'published')

  if (tutorId) {
    const { data: assignments } = await supabase.from('tutor_course_assignments')
      .select('course_id').eq('school_id', schoolId).eq('tutor_id', tutorId)
    const courseIds = (assignments || []).map((assignment) => assignment.course_id)
    if (courseIds.length === 0) return { pending_count: 0, active_count: 0, items: [] }
    mocksQuery = mocksQuery.in('course_id', courseIds)
  }

  const { data: mocks } = await mocksQuery
  if (!mocks?.length) return { pending_count: 0, active_count: 0, items: [] }

  const mockIds = mocks.map((mock) => mock.id)
  const { data: attempts } = await supabase.from('mock_attempts')
    .select('id, mock_exam_id, status').eq('school_id', schoolId).in('mock_exam_id', mockIds)
    .in('status', ['submitted', 'timed_out'])
  const attemptIds = (attempts || []).map((attempt) => attempt.id)
  const { data: ungradedAnswers } = attemptIds.length
    ? await supabase.from('mock_answers')
      .select('attempt_id, question:mock_questions(question_type)')
      .eq('school_id', schoolId).in('attempt_id', attemptIds).is('tutor_score', null)
    : { data: [] }
  const pendingAttemptIds = new Set((ungradedAnswers || [])
    .filter((answer) => (answer.question as any)?.question_type === 'theory')
    .map((answer) => answer.attempt_id))
  const pendingByMock = new Map<string, number>()
  for (const attempt of attempts || []) {
    if (pendingAttemptIds.has(attempt.id)) {
      pendingByMock.set(attempt.mock_exam_id, (pendingByMock.get(attempt.mock_exam_id) || 0) + 1)
    }
  }

  const items = mocks.map((mock) => ({
    id: mock.id,
    kind: 'mock',
    href: `/dashboard/mocks/${mock.id}/results`,
    title: mock.title,
    context: `${(mock.courses as any)?.name || 'General'} • ${pendingByMock.get(mock.id) || 0} waiting`,
    pending_count: pendingByMock.get(mock.id) || 0,
    progress: 0,
  })).filter((item) => item.pending_count > 0)
    .sort((a, b) => b.pending_count - a.pending_count)
    .slice(0, 3)

  return {
    pending_count: [...pendingByMock.values()].reduce((sum, count) => sum + count, 0),
    active_count: mocks.length,
    items,
  }
}

dashboardRouter.get('/stats', async (c) => {
  const user = c.get('user')
  const schoolId = user.school_id

  if (!schoolId) {
    return c.json({ error: 'User does not belong to a school' }, 400)
  }

  const role = user.role
  
  // Determine capabilities
  let isAdmin = role === 'admin'
  let isTutor = role === 'tutor'

  // If admin, check if they are also assigned as a tutor
  if (isAdmin) {
    const { count } = await supabase
      .from('tutor_course_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('tutor_id', user.id)
      .eq('school_id', schoolId)
    
    if (count && count > 0) {
      isTutor = true
    }
  }

  const responseData: any = {}

  // Fetch admin stats if they have admin capability
  if (isAdmin) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const [
      { count: totalStudents },
      { data: tutorProfiles },
      { data: teachingAssignments },
      { count: upcomingClasses },
      { data: payments },
      { count: successfulPayments },
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId),
      supabase.from('user_profiles').select('id').eq('role', 'tutor').eq('school_id', schoolId),
      supabase.from('tutor_course_assignments').select('tutor_id').eq('school_id', schoolId),
      supabase.from('live_classes').select('*', { count: 'exact', head: true }).eq('status', 'scheduled').eq('school_id', schoolId)
        .gte('scheduled_at', startOfToday.toISOString()).lte('scheduled_at', endOfToday.toISOString()),
      supabase.from('payments').select('centre_amount').eq('status', 'successful').eq('school_id', schoolId).gte('paid_at', startOfMonth.toISOString()),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'successful').eq('school_id', schoolId).gte('paid_at', startOfMonth.toISOString()),
    ])

    const mtdRevenue = payments ? payments.reduce((sum, p) => sum + Number(p.centre_amount), 0) : 0
    const tutorIds = new Set([
      ...(tutorProfiles || []).map((profile) => profile.id),
      ...(teachingAssignments || []).map((assignment) => assignment.tutor_id),
    ])

    const [needsGrading, mockOverview] = await Promise.all([
      loadNeedsGrading(schoolId),
      loadMockOverview(schoolId),
    ])

    responseData.admin_stats = {
      total_students: totalStudents || 0,
      tutors_count: tutorIds.size,
      upcoming_classes: upcomingClasses || 0,
      mtd_revenue: mtdRevenue,
      successful_payments: successfulPayments || 0,
      needs_grading: [...mockOverview.items, ...needsGrading].slice(0, 4),
      mocks: mockOverview,
    }
  }

  // Fetch tutor stats if they have tutor capability
  if (isTutor) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const [
      { count: classesToday },
      { count: myCourses },
      { data: assignments }
    ] = await Promise.all([
      supabase.from('live_classes').select('*', { count: 'exact', head: true })
        .eq('tutor_id', user.id).eq('school_id', schoolId)
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString()),
        
      supabase.from('tutor_course_assignments').select('*', { count: 'exact', head: true })
        .eq('tutor_id', user.id).eq('school_id', schoolId),
        
      supabase.from('assignments').select('id').eq('tutor_id', user.id).eq('school_id', schoolId)
    ])

    let pendingSubmissions = 0
    if (assignments && assignments.length > 0) {
      const assignmentIds = assignments.map(a => a.id)
      const { count } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .in('assignment_id', assignmentIds)
        .eq('school_id', schoolId)
        .is('score', null)
        
      pendingSubmissions = count || 0
    }

    const mockOverview = await loadMockOverview(schoolId, user.id)
    responseData.tutor_stats = {
      classes_today: classesToday || 0,
      pending_submissions: pendingSubmissions,
      my_courses: myCourses || 0,
      needs_grading: [...mockOverview.items, ...await loadNeedsGrading(schoolId, user.id)].slice(0, 4),
      mocks: mockOverview,
    }
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  let scheduleQuery = supabase.from('live_classes')
    .select('id, title, scheduled_at, duration_minutes, status, courses(name)')
    .eq('school_id', schoolId)
    .gte('scheduled_at', startOfToday.toISOString())
    .lte('scheduled_at', endOfToday.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })
    .limit(6)
  if (!isAdmin) scheduleQuery = scheduleQuery.eq('tutor_id', user.id)
  const { data: todaySchedule, error: scheduleError } = await scheduleQuery
  if (scheduleError) return c.json({ error: 'Failed to load dashboard schedule' }, 500)
  responseData.today_schedule = todaySchedule || []

  if (isTutor) {
    const { data: myTodaySchedule, error: myScheduleError } = await supabase.from('live_classes')
      .select('id, title, scheduled_at, duration_minutes, status, courses(name)')
      .eq('school_id', schoolId).eq('tutor_id', user.id)
      .gte('scheduled_at', startOfToday.toISOString()).lte('scheduled_at', endOfToday.toISOString())
      .neq('status', 'cancelled').order('scheduled_at', { ascending: true }).limit(6)
    if (myScheduleError) return c.json({ error: 'Failed to load teaching schedule' }, 500)
    responseData.my_today_schedule = myTodaySchedule || []
  }

  return c.json({ data: responseData })
})
