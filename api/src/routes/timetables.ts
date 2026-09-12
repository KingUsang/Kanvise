import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import type { TenantVariables } from '../types'

export const timetablesRouter = new Hono<{ Variables: TenantVariables }>()

timetablesRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole('admin'))

function validDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function validTime(value: unknown) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function validTimezone(value: unknown) {
  if (typeof value !== 'string' || !value) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

async function loadTimetables(schoolId: string) {
  const db = supabase as any
  const [{ data: timetables, error }, { data: slots, error: slotsError }] = await Promise.all([
    db.from('class_timetables')
      .select('*, programme:programmes(id, name), standalone_course:courses!class_timetables_standalone_course_id_fkey(id, name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true }),
    db.from('class_timetable_slots')
      .select('*, course:courses(id, name, programme_id), tutor:user_profiles!class_timetable_slots_tutor_id_fkey(id, first_name, last_name)')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true }),
  ])
  if (error || slotsError) throw error || slotsError

  return (timetables || []).map((timetable: any) => ({
    ...timetable,
    slots: (slots || []).filter((slot: any) => slot.timetable_id === timetable.id),
  }))
}

timetablesRouter.get('/', async (c) => {
  try {
    return c.json({ data: await loadTimetables(c.get('user').school_id) })
  } catch (error) {
    console.error('[timetables] list failed:', error)
    return c.json({ error: 'Could not load timetables' }, 500)
  }
})

timetablesRouter.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const programmeId = typeof body.programme_id === 'string' && body.programme_id ? body.programme_id : null
  const standaloneCourseId = typeof body.standalone_course_id === 'string' && body.standalone_course_id ? body.standalone_course_id : null
  const timezone = body.timezone || 'Africa/Lagos'
  if (Number(Boolean(programmeId)) + Number(Boolean(standaloneCourseId)) !== 1) {
    return c.json({ error: 'Choose one course for this timetable', code: 'INVALID_SCOPE' }, 400)
  }
  if (!validTimezone(timezone)) return c.json({ error: 'Choose a valid timezone', code: 'INVALID_TIMEZONE' }, 400)

  const scopeTable = programmeId ? 'programmes' : 'courses'
  const scopeId = programmeId || standaloneCourseId
  const { data: scope } = await supabase.from(scopeTable).select('id').eq('id', scopeId!).eq('school_id', user.school_id).maybeSingle()
  if (!scope) return c.json({ error: 'Course not found', code: 'SCOPE_NOT_FOUND' }, 404)

  const db = supabase as any
  const { data, error } = await db.from('class_timetables').insert({
    school_id: user.school_id,
    programme_id: programmeId,
    standalone_course_id: standaloneCourseId,
    timezone,
    status: 'draft',
    created_by: user.id,
  }).select().single()
  if (error) {
    if (error.code === '23505') return c.json({ error: 'This course already has a timetable', code: 'TIMETABLE_EXISTS' }, 409)
    return c.json({ error: 'Could not create timetable' }, 500)
  }
  return c.json({ data }, 201)
})

timetablesRouter.post('/:id/slots', async (c) => {
  const user = c.get('user')
  const timetableId = c.req.param('id')!
  const body = await c.req.json()
  const courseId = String(body.course_id || '')
  const tutorId = String(body.tutor_id || '')
  const weekday = Number(body.weekday)
  const durationMinutes = body.duration_minutes === undefined ? 60 : Number(body.duration_minutes)
  const recurrence = body.recurrence === 'this_week' ? 'this_week' : 'ongoing'
  const weekStart = body.week_start

  if (!courseId || !tutorId || !Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !validTime(body.start_time) || !validDate(weekStart)) {
    return c.json({ error: 'Choose a subject, tutor, day and start time', code: 'INVALID_SLOT' }, 400)
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    return c.json({ error: 'Duration must be between 15 and 240 minutes', code: 'INVALID_DURATION' }, 400)
  }

  const db = supabase as any
  const [{ data: timetable }, { data: course }, { data: assignment }] = await Promise.all([
    db.from('class_timetables').select('id, status, has_unpublished_changes, programme_id, standalone_course_id').eq('id', timetableId).eq('school_id', user.school_id).maybeSingle(),
    supabase.from('courses').select('id, programme_id').eq('id', courseId).eq('school_id', user.school_id).maybeSingle(),
    supabase.from('tutor_course_assignments').select('id').eq('course_id', courseId).eq('tutor_id', tutorId).eq('school_id', user.school_id).maybeSingle(),
  ])
  if (!timetable) return c.json({ error: 'Timetable not found', code: 'NOT_FOUND' }, 404)
  if (timetable.status !== 'draft' && !timetable.has_unpublished_changes) return c.json({ error: 'Choose Edit timetable before changing published classes', code: 'TIMETABLE_PUBLISHED' }, 409)
  if (!course || !assignment) return c.json({ error: 'Use a subject and tutor already assigned to each other', code: 'INVALID_ASSIGNMENT' }, 403)
  if ((timetable.programme_id && course.programme_id !== timetable.programme_id) || (timetable.standalone_course_id && course.id !== timetable.standalone_course_id)) {
    return c.json({ error: 'That subject is outside this timetable', code: 'COURSE_OUTSIDE_TIMETABLE' }, 400)
  }

  const { data, error } = await db.from('class_timetable_slots').insert({
    timetable_id: timetableId,
    school_id: user.school_id,
    course_id: courseId,
    tutor_id: tutorId,
    weekday,
    start_time: body.start_time,
    duration_minutes: durationMinutes,
    starts_on: weekStart,
    ends_on: recurrence === 'this_week' ? addDays(weekStart, 6) : null,
    title: String(body.title || '').trim() || null,
  }).select().single()
  if (error) {
    if (error.code === '23505') return c.json({ error: 'That subject already has a class at this time', code: 'SLOT_EXISTS' }, 409)
    return c.json({ error: 'Could not add timetable class' }, 500)
  }
  return c.json({ data }, 201)
})

timetablesRouter.delete('/:id/slots/:slotId', async (c) => {
  const user = c.get('user')
  const db = supabase as any
  const { data: timetable } = await db.from('class_timetables').select('status, has_unpublished_changes').eq('id', c.req.param('id')).eq('school_id', user.school_id).maybeSingle()
  if (!timetable) return c.json({ error: 'Timetable not found', code: 'NOT_FOUND' }, 404)
  if (timetable.status !== 'draft' && !timetable.has_unpublished_changes) return c.json({ error: 'Choose Edit timetable before removing a class', code: 'TIMETABLE_PUBLISHED' }, 409)
  const request = db.from('class_timetable_slots')
  const { error } = timetable.status === 'published'
    ? await request.update({ deleted_at: new Date().toISOString() }).eq('id', c.req.param('slotId')).eq('timetable_id', c.req.param('id')).eq('school_id', user.school_id)
    : await request.delete().eq('id', c.req.param('slotId')).eq('timetable_id', c.req.param('id')).eq('school_id', user.school_id)
  if (error) return c.json({ error: 'Could not remove timetable class' }, 500)
  return c.json({ message: 'Timetable class removed' })
})

timetablesRouter.post('/:id/publish', async (c) => {
  const user = c.get('user')
  const { data, error } = await supabase.rpc('publish_class_timetable' as any, {
    p_timetable_id: c.req.param('id'), p_school_id: user.school_id, p_published_by: user.id,
  } as any)
  if (error) return c.json({ error: error.message || 'Could not publish timetable', code: 'TIMETABLE_PUBLISH_FAILED' }, 400)
  return c.json({ message: 'Timetable published', generated_classes: data })
})

timetablesRouter.post('/:id/edit', async (c) => {
  const user = c.get('user')
  const { error } = await supabase.rpc('unpublish_class_timetable' as any, {
    p_timetable_id: c.req.param('id'), p_school_id: user.school_id, p_actor_id: user.id,
  } as any)
  if (error) return c.json({ error: error.message || 'Could not reopen timetable', code: 'TIMETABLE_EDIT_FAILED' }, 400)
  return c.json({ message: 'Draft changes opened; students still see the published timetable' })
})
