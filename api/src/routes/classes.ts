import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import {
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  requireRole,
  tenantMiddleware,
} from '../middleware/auth'
import { programmesRouter } from './programmes'
import type { TenantVariables } from '../types'

// "Class" is the product term.  These routes deliberately keep the existing
// programmes/courses persistence model intact while the UI moves away from the
// legacy vocabulary.  The programmes router is mounted below for compatible
// create, edit, publish and detail behaviour.
export const classesRouter = new Hono<{ Variables: TenantVariables }>()

type CourseRow = { id: string; name: string; programme_id?: string | null; sub_programme_id?: string | null }

async function visibleClassSubjects(user: any, classId: string): Promise<CourseRow[] | null> {
  const [{ data: programme, error: programmeError }, { data: subProgrammes, error: subError }, { data: courses, error: courseError }] = await Promise.all([
    supabase.from('programmes').select('id').eq('id', classId).eq('school_id', user.school_id).maybeSingle(),
    supabase.from('sub_programmes').select('id, programme_id').eq('school_id', user.school_id).eq('programme_id', classId),
    supabase.from('courses').select('id, name, programme_id, sub_programme_id').eq('school_id', user.school_id),
  ])
  if (programmeError || subError || courseError) throw programmeError || subError || courseError
  if (!programme) return null

  const subProgrammeIds = new Set((subProgrammes || []).map((item: any) => item.id))
  const classSubjects = ((courses || []) as CourseRow[]).filter((course) =>
    course.programme_id === classId || (course.sub_programme_id && subProgrammeIds.has(course.sub_programme_id)),
  )
  if (user.role !== 'tutor') return classSubjects

  const { data: assignments, error } = await supabase.from('tutor_course_assignments')
    .select('course_id').eq('school_id', user.school_id).eq('tutor_id', user.id)
  if (error) throw error
  const assigned = new Set((assignments || []).map((assignment: any) => assignment.course_id))
  return classSubjects.filter((course) => assigned.has(course.id))
}

function classAccessMiddleware() {
  return [jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole('admin', 'tutor')] as const
}

// The class schedule is a read model over dated sessions and recurring slots.
// It intentionally does not use the old class_timetables draft/publish writer.
classesRouter.get('/:id/schedule', ...classAccessMiddleware(), async (c) => {
  try {
    const user = c.get('user')
    const classId = c.req.param('id')
    if (!classId) return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
    const subjects = await visibleClassSubjects(user, classId)
    if (!subjects?.length) return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)

    const requestedSubject = c.req.query('course_id')
    const visibleSubjectIds = requestedSubject
      ? subjects.filter((subject) => subject.id === requestedSubject).map((subject) => subject.id)
      : subjects.map((subject) => subject.id)
    if (!visibleSubjectIds.length) return c.json({ error: 'Subject not found in this class', code: 'SUBJECT_NOT_FOUND' }, 404)

    let sessionsQuery = (supabase as any).from('live_classes')
      .select('id, title, scheduled_at, duration_minutes, status, started_at, ended_at, course_id, tutor_id, timetable_slot_id, access_mode, course:courses(id, name), tutor:user_profiles!live_classes_tutor_id_fkey(id, first_name, last_name)')
      .eq('school_id', user.school_id)
      .in('course_id', visibleSubjectIds)
      .order('scheduled_at', { ascending: true })
    if (user.role === 'tutor') sessionsQuery = sessionsQuery.eq('tutor_id', user.id)
    const from = c.req.query('from')
    const to = c.req.query('to')
    if (from) sessionsQuery = sessionsQuery.gte('scheduled_at', from)
    if (to) sessionsQuery = sessionsQuery.lte('scheduled_at', to)

    let slotsQuery = (supabase as any).from('class_timetable_slots')
      .select('id, course_id, tutor_id, weekday, start_time, duration_minutes, starts_on, ends_on, title, source, recurrence_group_id, timetable_id, course:courses(id, name), tutor:user_profiles!class_timetable_slots_tutor_id_fkey(id, first_name, last_name)')
      .eq('school_id', user.school_id)
      .in('course_id', visibleSubjectIds)
      .is('deleted_at', null)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true })
    if (user.role === 'tutor') slotsQuery = slotsQuery.eq('tutor_id', user.id)

    const [{ data: sessions, error: sessionsError }, { data: recurringSlots, error: slotsError }] = await Promise.all([sessionsQuery, slotsQuery])
    if (sessionsError || slotsError) throw sessionsError || slotsError
    return c.json({ data: { subjects, sessions: sessions || [], recurring_slots: recurringSlots || [] } })
  } catch (error: any) {
    console.error('[classes] schedule read failed:', error)
    return c.json({ error: error.message || 'Could not load class schedule', code: 'CLASS_SCHEDULE_READ_FAILED' }, 500)
  }
})

// A timetable is operationally centre-wide, rather than a second view nested
// inside a class. It is admin-only because it exposes every tutor's workload.
classesRouter.get('/timetable', ...classAccessMiddleware(), async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Only admins can view the centre timetable', code: 'FORBIDDEN' }, 403)
  try {
    const { data: school, error: schoolError } = await supabase.from('schools')
      .select('account_type')
      .eq('id', user.school_id)
      .maybeSingle()
    if (schoolError) throw schoolError
    if (school?.account_type === 'independent') {
      return c.json({ error: 'Timetable is available for tutorial centres', code: 'CENTRE_TIMETABLE_UNAVAILABLE' }, 403)
    }
    let query = (supabase as any).from('class_timetable_slots')
      .select('id, course_id, tutor_id, weekday, start_time, duration_minutes, starts_on, ends_on, title, source, recurrence_group_id, timetable_id, course:courses(id, name, programme_id, programme:programmes(id, name)), tutor:user_profiles!class_timetable_slots_tutor_id_fkey(id, first_name, last_name)')
      .eq('school_id', user.school_id)
      .is('deleted_at', null)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true })
    const courseId = c.req.query('course_id')
    const tutorId = c.req.query('tutor_id')
    if (courseId) query = query.eq('course_id', courseId)
    if (tutorId) query = query.eq('tutor_id', tutorId)
    const { data, error } = await query
    if (error) throw error
    return c.json({ data: data || [] })
  } catch (error: any) {
    console.error('[classes] timetable read failed:', error)
    return c.json({ error: error.message || 'Could not load centre timetable', code: 'TIMETABLE_READ_FAILED' }, 500)
  }
})

// Keep the existing battle-tested setup and lifecycle contracts reachable from
// the class-first API. Routes above are registered first so they are not
// consumed by the generic /:id detail endpoint in programmesRouter.
classesRouter.route('/', programmesRouter)
