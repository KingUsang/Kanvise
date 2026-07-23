import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import {
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
  requireRole,
} from '../middleware/auth'
import type { AppVariables } from '../types'
import {
  attendancePairKey,
  summariseStudentEvents,
  uniqueAttendancePairCount,
} from '../domain/attendance'

export const attendanceRouter = new Hono<{ Variables: AppVariables }>()

attendanceRouter.use('*', jwtVerificationMiddleware)
attendanceRouter.use('*', profileResolutionMiddleware)
attendanceRouter.use('*', tenantMiddleware)
attendanceRouter.use('*', requireRole('admin', 'tutor'))

const configuredRiskThreshold = Number(process.env.ATTENDANCE_RISK_THRESHOLD_PERCENT || 70)
const riskThreshold = Number.isFinite(configuredRiskThreshold)
  ? Math.min(100, Math.max(0, configuredRiskThreshold))
  : 70

// ── GET /attendance/metrics ────────────────────────────────────────────────
attendanceRouter.get('/metrics', async (c) => {
  const user = c.get('user')
  const schoolId = user.school_id
  const role = user.role
  
  const programmeId = c.req.query('programme_id')
  const classId = c.req.query('class_id')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')

  if (!schoolId) {
    return c.json({ error: 'User does not belong to a school' }, 400)
  }

  // 1. Fetch relevant live_classes
  let classesQuery = supabase
    .from('live_classes')
    .select('id, course_id, status, scheduled_at, courses(id, name)')
    .eq('school_id', schoolId)
    .eq('status', 'completed')

  if (role !== 'admin') {
     classesQuery = classesQuery.eq('tutor_id', user.id)
  }
  
  if (programmeId) {
     const { data: pCourses } = await supabase
       .from('courses')
       .select('id')
       .eq('school_id', schoolId)
       .eq('programme_id', programmeId)
     if (pCourses && pCourses.length > 0) {
        classesQuery = classesQuery.in('course_id', pCourses.map(c => c.id))
     } else {
        classesQuery = classesQuery.in('course_id', ['none'])
     }
  }
  
  if (classId) classesQuery = classesQuery.eq('id', classId)
  if (startDate) classesQuery = classesQuery.gte('scheduled_at', startDate)
  if (endDate) classesQuery = classesQuery.lte('scheduled_at', endDate)

  const { data: liveClasses, error: classesError } = await classesQuery
  
  if (classesError) return c.json({ error: 'Failed to fetch classes' }, 500)
  
  const totalSessions = liveClasses ? liveClasses.length : 0

  if (totalSessions === 0) {
     return c.json({ data: { average_attendance: 0, total_sessions: 0, at_risk_students: 0, risk_threshold: riskThreshold } })
  }

  const classIds = liveClasses!.map(c => c.id)
  const courseIds = [...new Set(liveClasses!.map(c => c.course_id))]

  // 2. Fetch expected students (enrolments) considering hierarchy
  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, sub_programme_id, programme_id')
    .in('id', courseIds)

  const subProgrammeIds = [...new Set(coursesData?.map(c => c.sub_programme_id).filter(Boolean) || [])]
  const programmeIds = [...new Set(coursesData?.map(c => c.programme_id).filter(Boolean) || [])]

  // Fetch enrolments optimally using the database (PostgREST OR syntax without quotes)
  let enrolmentsQuery = supabase
    .from('enrolments')
    .select('student_id, course_id, sub_programme_id, programme_id')
    .eq('school_id', schoolId)

  const orConditions = []
  if (courseIds.length > 0) orConditions.push(`course_id.in.(${courseIds.join(',')})`)
  if (subProgrammeIds.length > 0) orConditions.push(`sub_programme_id.in.(${subProgrammeIds.join(',')})`)
  if (programmeIds.length > 0) orConditions.push(`programme_id.in.(${programmeIds.join(',')})`)

  if (orConditions.length > 0) {
     enrolmentsQuery = enrolmentsQuery.or(orConditions.join(','))
  } else {
     enrolmentsQuery = enrolmentsQuery.eq('id', '00000000-0000-0000-0000-000000000000') // prevent fetching all
  }

  const { data: enrolments, error: enrolmentsError } = await enrolmentsQuery
    
  if (enrolmentsError) console.error("Metrics enrolments fetch error:", enrolmentsError)

  // 3. Fetch actual attendance records
  const { data: records } = await supabase
    .from('attendance_records')
    .select('student_id, live_class_id')
    .eq('school_id', schoolId)
    .in('live_class_id', classIds)

  // Calculate Metrics
  let totalExpectedAttendees = 0
  const attendedClassPairs = new Set(
    (records || []).map(attendancePairKey),
  )
  const totalActualAttendees = uniqueAttendancePairCount(records || [])

  liveClasses!.forEach(lc => {
     const courseInfo = coursesData?.find(c => c.id === lc.course_id)
     const courseEnrolments = enrolments?.filter(e => 
         e.course_id === lc.course_id || 
         (courseInfo?.sub_programme_id && e.sub_programme_id === courseInfo.sub_programme_id) || 
         (courseInfo?.programme_id && e.programme_id === courseInfo.programme_id)
     ) || []
     
     // Deduplicate students (in case they enrolled multiple ways)
     const uniqueStudents = new Set(courseEnrolments.map(e => e.student_id))
     totalExpectedAttendees += uniqueStudents.size
  })

  let averageAttendance = 0
  if (totalExpectedAttendees > 0) {
      averageAttendance = Math.round((totalActualAttendees / totalExpectedAttendees) * 100)
  }

  let atRiskCount = 0
  if (enrolments && enrolments.length > 0) {
      const studentIds = [...new Set(enrolments.map(e => e.student_id))]
      for (const sId of studentIds) {
          const expectedClassesCount = liveClasses!.filter(lc => {
              const courseInfo = coursesData?.find(c => c.id === lc.course_id)
              return enrolments.some(e => 
                  e.student_id === sId && (
                  e.course_id === lc.course_id || 
                  (courseInfo?.sub_programme_id && e.sub_programme_id === courseInfo.sub_programme_id) || 
                  (courseInfo?.programme_id && e.programme_id === courseInfo.programme_id))
              )
          }).length
          
          if (expectedClassesCount > 0) {
              const attendedClassesCount = liveClasses!.filter(liveClass =>
                attendedClassPairs.has(`${liveClass.id}:${sId}`),
              ).length
              const rate = (attendedClassesCount / expectedClassesCount) * 100
              if (rate < riskThreshold) atRiskCount++
          }
      }
  }

  return c.json({
      data: {
          average_attendance: Math.min(100, averageAttendance),
          total_sessions: totalSessions,
          at_risk_students: atRiskCount,
          risk_threshold: riskThreshold,
      }
  })
})

// ── GET /attendance/records ────────────────────────────────────────────────
attendanceRouter.get('/records', async (c) => {
  const user = c.get('user')
  const schoolId = user.school_id
  const role = user.role
  
  const programmeId = c.req.query('programme_id')
  const classId = c.req.query('class_id')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = parseInt(c.req.query('limit') || '20', 10)

  if (!schoolId) {
    return c.json({ error: 'User does not belong to a school' }, 400)
  }

  // 1. Fetch relevant live_classes (limited to 50 most recent to avoid massive memory processing)
  let classesQuery = supabase
    .from('live_classes')
    .select('id, course_id, status, scheduled_at, title, courses(id, name, programmes(name))')
    .eq('school_id', schoolId)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  if (role !== 'admin') {
     classesQuery = classesQuery.eq('tutor_id', user.id)
  }
  
  if (programmeId) {
     const { data: pCourses } = await supabase
       .from('courses')
       .select('id')
       .eq('school_id', schoolId)
       .eq('programme_id', programmeId)
     if (pCourses && pCourses.length > 0) {
        classesQuery = classesQuery.in('course_id', pCourses.map(c => c.id))
     } else {
        classesQuery = classesQuery.in('course_id', ['none'])
     }
  }

  if (classId) classesQuery = classesQuery.eq('id', classId)
  if (startDate) classesQuery = classesQuery.gte('scheduled_at', startDate)
  if (endDate) classesQuery = classesQuery.lte('scheduled_at', endDate)

  const { data: liveClasses, error: classesError } = await classesQuery
  
  if (classesError) return c.json({ error: 'Failed to fetch classes' }, 500)
  if (!liveClasses || liveClasses.length === 0) return c.json({ data: [], meta: { total: 0, page, limit } })

  const classIds = liveClasses.map(c => c.id)
  const courseIds = [...new Set(liveClasses.map(c => c.course_id))]

  // 2. Fetch expected students (enrolments) considering hierarchy
  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, sub_programme_id, programme_id')
    .in('id', courseIds)

  const subProgrammeIds = [...new Set(coursesData?.map(c => c.sub_programme_id).filter(Boolean) || [])]
  const programmeIds = [...new Set(coursesData?.map(c => c.programme_id).filter(Boolean) || [])]

  // Fetch enrolments optimally using the database (PostgREST OR syntax without quotes)
  let enrolmentsQuery = supabase
    .from('enrolments')
    .select('student_id, course_id, sub_programme_id, programme_id, user_profiles(first_name, last_name)')
    .eq('school_id', schoolId)

  const orConditions = []
  if (courseIds.length > 0) orConditions.push(`course_id.in.(${courseIds.join(',')})`)
  if (subProgrammeIds.length > 0) orConditions.push(`sub_programme_id.in.(${subProgrammeIds.join(',')})`)
  if (programmeIds.length > 0) orConditions.push(`programme_id.in.(${programmeIds.join(',')})`)

  if (orConditions.length > 0) {
     enrolmentsQuery = enrolmentsQuery.or(orConditions.join(','))
  } else {
     enrolmentsQuery = enrolmentsQuery.eq('id', '00000000-0000-0000-0000-000000000000') // prevent fetching all
  }

  const { data: enrolments, error: enrolmentsError } = await enrolmentsQuery
    
  if (enrolmentsError) console.error("Records enrolments fetch error:", enrolmentsError)
    
  // 3. Fetch actual attendance
  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('school_id', schoolId)
    .in('live_class_id', classIds)

  // 4. Build complete roster (Attendees + Absentees)
  let roster = []

  for (const lc of liveClasses) {
      const courseInfo = coursesData?.find(c => c.id === lc.course_id)
      const classEnrolments = enrolments?.filter(e => 
          e.course_id === lc.course_id || 
          (courseInfo?.sub_programme_id && e.sub_programme_id === courseInfo.sub_programme_id) || 
          (courseInfo?.programme_id && e.programme_id === courseInfo.programme_id)
      ) || []
      const classRecords = records?.filter(r => r.live_class_id === lc.id) || []
      
      // Deduplicate enrolments to prevent rendering a student twice if they enrolled in both course and programme
      const uniqueStudentIds = new Set()
      
      const courseObj = lc.courses as any
      const courseName = courseObj?.name || 'Unknown Course'
      const programmeName = courseObj?.programmes?.name || ''
      
      for (const enr of classEnrolments) {
          if (uniqueStudentIds.has(enr.student_id)) continue;
          uniqueStudentIds.add(enr.student_id);

          const studentProfile = enr.user_profiles as any
          const studentRecords = classRecords.filter(r => r.student_id === enr.student_id)
          const attendanceSummary = summariseStudentEvents(studentRecords)
          const record = attendanceSummary?.earliest
          
          let status = 'Absent'
          let durationStr = '--'
          let joinedStr = '--:--'
          
          if (record) {
              const scheduledAtTime = new Date(lc.scheduled_at).getTime()
              const joinedAtTime = new Date(record.joined_at).getTime()
              
              // If joined more than 15 mins after schedule, mark as Late
              const diffMins = (joinedAtTime - scheduledAtTime) / (1000 * 60)
              status = diffMins > 15 ? 'Late' : 'Present'
              
              // Format joined time (e.g. 09:15 AM)
              joinedStr = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(record.joined_at))
              
              const totalDurationSeconds = attendanceSummary?.totalDurationSeconds || 0
              if (totalDurationSeconds) {
                  const hrs = Math.floor(totalDurationSeconds / 3600)
                  const mins = Math.floor((totalDurationSeconds % 3600) / 60)
                  if (hrs > 0) {
                      durationStr = `${hrs}h ${mins}m`
                  } else {
                      durationStr = `${mins}m`
                  }
              }
          }
          
          roster.push({
              id: record?.id || `${lc.id}-${enr.student_id}`,
              student_id: enr.student_id,
              student_name: `${studentProfile?.first_name || ''} ${studentProfile?.last_name || ''}`.trim(),
              avatar_url: null,
              course_name: courseName,
              programme_name: programmeName,
              class_title: lc.title,
              scheduled_at: lc.scheduled_at,
              join_time: joinedStr,
              duration: durationStr,
              status: status
          })
      }
  }

  // 5. Sort roster (most recent class first, then Absentees at bottom? No, just alphabetical by name or scheduled time)
  roster.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  // 6. Paginate
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const paginatedRoster = roster.slice(startIndex, endIndex)

  return c.json({
      data: paginatedRoster,
      meta: {
          total: roster.length,
          page,
          limit,
          total_pages: Math.ceil(roster.length / limit)
      }
  })
})
