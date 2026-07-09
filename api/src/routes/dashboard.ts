import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware } from '../middleware/auth'

export const dashboardRouter = new Hono()

dashboardRouter.use('*', jwtVerificationMiddleware)
dashboardRouter.use('*', profileResolutionMiddleware)
dashboardRouter.use('*', tenantMiddleware)

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

    const [
      { count: totalStudents },
      { count: activeTutors },
      { count: upcomingClasses },
      { data: payments }
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'tutor').eq('school_id', schoolId),
      supabase.from('live_classes').select('*', { count: 'exact', head: true }).eq('status', 'scheduled').eq('school_id', schoolId),
      supabase.from('payments').select('centre_amount').eq('status', 'successful').eq('school_id', schoolId).gte('paid_at', startOfMonth.toISOString())
    ])

    const mtdRevenue = payments ? payments.reduce((sum, p) => sum + Number(p.centre_amount), 0) : 0

    // Fetch needs grading (Admin sees all)
    const { data: recentAssignments } = await supabase
      .from('assignments')
      .select('id, title, courses(name)')
      .eq('school_id', schoolId)
      .limit(3)
      // .order('created_at', { ascending: false }) // Commented out to avoid crashing if created_at doesn't exist, we just rely on default order

    let needsGrading = []
    if (recentAssignments) {
      for (const a of recentAssignments) {
        const { count: total } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', a.id)
        const { count: graded } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', a.id).not('score', 'is', null)
        
        needsGrading.push({
          id: a.id,
          title: a.title,
          context: `${(a.courses as any)?.name || 'General'} • ${total || 0} Submissions`,
          progress: total ? Math.round(((graded || 0) / total) * 100) : 0
        })
      }
    }

    responseData.admin_stats = {
      total_students: totalStudents || 0,
      active_tutors: activeTutors || 0,
      upcoming_classes: upcomingClasses || 0,
      mtd_revenue: mtdRevenue,
      needs_grading: needsGrading
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

    responseData.tutor_stats = {
      classes_today: classesToday || 0,
      pending_submissions: pendingSubmissions,
      my_courses: myCourses || 0
    }
  }

  return c.json({ data: responseData })
})
