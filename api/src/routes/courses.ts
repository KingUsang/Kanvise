import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole } from '../middleware/auth'

export const coursesRouter = new Hono()

coursesRouter.use('*', jwtVerificationMiddleware)
coursesRouter.use('*', profileResolutionMiddleware)
coursesRouter.use('*', tenantMiddleware)

// ---------------------------------------------------------------------------
// 1. POST / - Create Course (Admin Only)
// Enforces nullable 3-tier structure & 400 INVALID_PARENT
// ---------------------------------------------------------------------------
coursesRouter.post('/', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const progId = body.programme_id || null
  const subProgId = body.sub_programme_id || null

  // 🚨 CRITICAL ARCHITECTURAL CONSTRAINT: Cannot belong to both at once!
  if (progId !== null && subProgId !== null) {
    return c.json({
      error: 'INVALID_PARENT',
      message: 'A course cannot have both a programme_id and a sub_programme_id set simultaneously.'
    }, 400)
  }

  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      school_id: user.school_id,
      created_by: user.id,
      name: body.name,
      slug: slug,
      description: body.description || null,
      price: body.price || 0.00,
      currency: body.currency || 'NGN',
      programme_id: progId,
      sub_programme_id: subProgId,
      is_published: false
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return c.json({ error: 'SLUG_TAKEN', message: 'A course with this slug already exists.' }, 409)
    return c.json({ error: error.message }, 500)
  }

  return c.json({ course }, 201)
})

// ---------------------------------------------------------------------------
// 2. GET / - List Courses (Admin & Tutor)
// Supports filters: programme_id, sub_programme_id, standalone, is_published
// ---------------------------------------------------------------------------
coursesRouter.get('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const progId = c.req.query('programme_id')
  const subProgId = c.req.query('sub_programme_id')
  const standalone = c.req.query('standalone')
  const isPublished = c.req.query('is_published')

  let query = supabase
    .from('courses')
    .select('*')
    .eq('school_id', user.school_id)

  if (progId) query = query.eq('programme_id', progId)
  if (subProgId) query = query.eq('sub_programme_id', subProgId)
  if (standalone === 'true') {
    query = query.is('programme_id', null).is('sub_programme_id', null)
  }
  if (isPublished !== undefined) {
    query = query.eq('is_published', isPublished === 'true')
  }

  // If tutor, filter to only courses assigned to this tutor
  if (user.role === 'tutor') {
    const { data: assigned } = await supabase
      .from('tutor_course_assignments')
      .select('course_id')
      .eq('tutor_id', user.id)
      .eq('school_id', user.school_id)

    const courseIds = (assigned || []).map((a: any) => a.course_id)
    if (courseIds.length === 0) return c.json({ courses: [] })
    query = query.in('id', courseIds)
  }

  const { data: courses, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  return c.json({ courses })
})

// ---------------------------------------------------------------------------
// 3. GET /:id - Single Course Details
// ---------------------------------------------------------------------------
coursesRouter.get('/:id', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data: course, error } = await supabase
    .from('courses')
    .select(`
      *,
      programmes(id, name, slug),
      sub_programmes(id, name, slug)
    `)
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (error || !course) return c.json({ error: 'COURSE_NOT_FOUND' }, 404)

  return c.json({ course })
})

// ---------------------------------------------------------------------------
// 4. PATCH /:id - Update Course (Admin Only)
// ---------------------------------------------------------------------------
coursesRouter.patch('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json()

  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.price !== undefined) updates.price = body.price
  if (body.programme_id !== undefined) updates.programme_id = body.programme_id
  if (body.sub_programme_id !== undefined) updates.sub_programme_id = body.sub_programme_id
  updates.updated_at = new Date().toISOString()

  // Re-verify parent exclusivity if parents are being updated
  const newProg = updates.programme_id !== undefined ? updates.programme_id : null
  const newSub = updates.sub_programme_id !== undefined ? updates.sub_programme_id : null
  if (newProg && newSub) {
    return c.json({ error: 'INVALID_PARENT', message: 'Cannot set both programme_id and sub_programme_id.' }, 400)
  }

  const { data: course, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', id)
    .eq('school_id', user.school_id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  if (!course) return c.json({ error: 'COURSE_NOT_FOUND' }, 404)

  return c.json({ course })
})

// ---------------------------------------------------------------------------
// 5. POST /:id/publish & unpublish - Publish toggle (Admin Only)
// ---------------------------------------------------------------------------
coursesRouter.post('/:id/publish', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { error } = await supabase
    .from('courses')
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Course published' })
})

coursesRouter.post('/:id/unpublish', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { error } = await supabase
    .from('courses')
    .update({ is_published: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Course unpublished' })
})

// ---------------------------------------------------------------------------
// 6. DELETE /:id - Delete Course (Admin Only)
// ---------------------------------------------------------------------------
coursesRouter.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { count } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', id)
    .eq('school_id', user.school_id)

  if (count && count > 0) {
    return c.json({ error: 'ACTIVE_ENROLMENTS_EXIST', message: 'Cannot delete course with active enrolments.' }, 409)
  }

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Course deleted successfully' })
})

// ---------------------------------------------------------------------------
// 7. TUTOR ASSIGNMENTS: POST, GET, DELETE /:courseId/tutors
// ---------------------------------------------------------------------------
coursesRouter.post('/:courseId/tutors', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const courseId = c.req.param('courseId')
  const { tutor_id } = await c.req.json()

  if (!tutor_id) return c.json({ error: 'tutor_id is required' }, 400)

  const { data: targetUser } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', tutor_id)
    .eq('school_id', user.school_id)
    .single()

  if (!targetUser) return c.json({ error: 'TUTOR_NOT_FOUND' }, 404)
  if (targetUser.role !== 'tutor') return c.json({ error: 'NOT_A_TUTOR', message: 'Assigned user must have the tutor role.' }, 400)

  const { error } = await supabase
    .from('tutor_course_assignments')
    .insert({
      school_id: user.school_id,
      course_id: courseId,
      tutor_id: tutor_id,
      assigned_by: user.id
    })

  if (error) {
    if (error.code === '23505') return c.json({ error: 'ALREADY_ASSIGNED', message: 'Tutor is already assigned to this course.' }, 409)
    return c.json({ error: error.message }, 500)
  }

  return c.json({ message: 'Tutor assigned to course' }, 201)
})

coursesRouter.get('/:courseId/tutors', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const courseId = c.req.param('courseId')

  const { data: assignments, error } = await supabase
    .from('tutor_course_assignments')
    .select(`
      id,
      assigned_at,
      user_profiles!tutor_id(id, first_name, last_name, email, profile_photo_url, role)
    `)
    .eq('course_id', courseId)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ tutors: (assignments || []).map((a: any) => a.user_profiles) })
})

coursesRouter.delete('/:courseId/tutors/:tutorId', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const courseId = c.req.param('courseId')
  const tutorId = c.req.param('tutorId')

  const { error } = await supabase
    .from('tutor_course_assignments')
    .delete()
    .eq('course_id', courseId)
    .eq('tutor_id', tutorId)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Tutor removed from course' })
})
