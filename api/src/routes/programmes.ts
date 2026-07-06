import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole } from '../middleware/auth'

export const programmesRouter = new Hono()

programmesRouter.use('*', jwtVerificationMiddleware)
programmesRouter.use('*', profileResolutionMiddleware)
programmesRouter.use('*', tenantMiddleware)

// ---------------------------------------------------------------------------
// 1. POST / - Create a new Programme (Admin Only)
// ---------------------------------------------------------------------------
programmesRouter.post('/', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const { data: programme, error } = await supabase
    .from('programmes')
    .insert({
      school_id: user.school_id,
      created_by: user.id,
      name: body.name,
      slug: slug,
      description: body.description || null,
      price: body.price || 0.00,
      currency: body.currency || 'NGN',
      thumbnail_url: body.thumbnail_url || null,
      is_published: false
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return c.json({ error: 'SLUG_TAKEN', message: 'A programme with this slug already exists in this school.' }, 409)
    return c.json({ error: error.message }, 500)
  }

  return c.json({ programme }, 201)
})

// ---------------------------------------------------------------------------
// 2. GET / - List all Programmes for the School (Admin & Tutor)
// ---------------------------------------------------------------------------
programmesRouter.get('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const isPublished = c.req.query('is_published')

  let query = supabase
    .from('programmes')
    .select('*')
    .eq('school_id', user.school_id)

  if (isPublished !== undefined) {
    query = query.eq('is_published', isPublished === 'true')
  }

  // If tutor, we only show programmes that have courses assigned to this tutor
  if (user.role === 'tutor') {
    const { data: assignedCourses } = await supabase
      .from('tutor_course_assignments')
      .select('course_id, courses!inner(programme_id)')
      .eq('tutor_id', user.id)
      .eq('school_id', user.school_id)

    const progIds = (assignedCourses || [])
      .map((item: any) => item.courses?.programme_id)
      .filter((id: any) => id !== null && id !== undefined)

    if (progIds.length === 0) {
      return c.json({ programmes: [] })
    }
    query = query.in('id', progIds)
  }

  const { data: programmes, error } = await query.order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  return c.json({ programmes })
})

// ---------------------------------------------------------------------------
// 3. GET /:id - Get single Programme with sub-programmes and courses
// ---------------------------------------------------------------------------
programmesRouter.get('/:id', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { data: programme, error } = await supabase
    .from('programmes')
    .select(`
      *,
      sub_programmes(*),
      courses(*)
    `)
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (error || !programme) return c.json({ error: 'PROGRAMME_NOT_FOUND' }, 404)

  // Count active enrolments
  const { count } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('programme_id', id)
    .eq('school_id', user.school_id)

  return c.json({
    data: {
      ...programme,
      enrolled_count: count || 0
    }
  })
})

// ---------------------------------------------------------------------------
// 4. PATCH /:id - Update Programme (Admin Only)
// ---------------------------------------------------------------------------
programmesRouter.patch('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json()

  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.price !== undefined) updates.price = body.price
  if (body.thumbnail_url !== undefined) updates.thumbnail_url = body.thumbnail_url
  updates.updated_at = new Date().toISOString()

  const { data: programme, error } = await supabase
    .from('programmes')
    .update(updates)
    .eq('id', id)
    .eq('school_id', user.school_id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  if (!programme) return c.json({ error: 'PROGRAMME_NOT_FOUND' }, 404)

  return c.json({ programme })
})

// ---------------------------------------------------------------------------
// 5. POST /:id/publish & unpublish - Publish toggle (Admin Only)
// ---------------------------------------------------------------------------
programmesRouter.post('/:id/publish', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  // Check if programme has at least one course directly or in sub-programmes
  const { count: directCourses } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('programme_id', id)

  const { data: subProgs } = await supabase
    .from('sub_programmes')
    .select('id')
    .eq('programme_id', id)

  const subProgIds = (subProgs || []).map((sp: any) => sp.id)
  let subCourses = 0
  if (subProgIds.length > 0) {
    const { count } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .in('sub_programme_id', subProgIds)
    subCourses = count || 0
  }

  if ((directCourses || 0) + subCourses === 0) {
    return c.json({ error: 'NO_COURSES_IN_PROGRAMME', message: 'A programme must have at least one course before it can be published.' }, 400)
  }

  const { error } = await supabase
    .from('programmes')
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Programme published' })
})

programmesRouter.post('/:id/unpublish', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { error } = await supabase
    .from('programmes')
    .update({ is_published: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Programme unpublished' })
})

// ---------------------------------------------------------------------------
// 6. DELETE /:id - Delete Programme (Admin Only)
// ---------------------------------------------------------------------------
programmesRouter.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  // Cannot delete if active enrolments exist
  const { count } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('programme_id', id)
    .eq('school_id', user.school_id)

  if (count && count > 0) {
    return c.json({ error: 'ACTIVE_ENROLMENTS_EXIST', message: 'Cannot delete programme with active student enrolments.' }, 409)
  }

  const { error } = await supabase
    .from('programmes')
    .delete()
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Programme deleted successfully' })
})

// ---------------------------------------------------------------------------
// 7. NESTED ROUTES: POST & GET /:programmeId/sub-programmes
// ---------------------------------------------------------------------------
programmesRouter.post('/:programmeId/sub-programmes', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const programmeId = c.req.param('programmeId')
  const body = await c.req.json()

  if (!body.name) return c.json({ error: 'Name is required' }, 400)
  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  // Verify parent exists
  const { data: parent, error: parentErr } = await supabase
    .from('programmes')
    .select('id')
    .eq('id', programmeId)
    .eq('school_id', user.school_id)
    .single()

  if (parentErr || !parent) return c.json({ error: 'PROGRAMME_NOT_FOUND' }, 404)

  const { data: subProgramme, error } = await supabase
    .from('sub_programmes')
    .insert({
      school_id: user.school_id,
      programme_id: programmeId,
      created_by: user.id,
      name: body.name,
      slug: slug,
      description: body.description || null,
      price: body.price || 0.00,
      currency: body.currency || 'NGN',
      is_published: false
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return c.json({ error: 'SLUG_TAKEN' }, 409)
    return c.json({ error: error.message }, 500)
  }

  return c.json({ sub_programme: subProgramme }, 201)
})

programmesRouter.get('/:programmeId/sub-programmes', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const programmeId = c.req.param('programmeId')

  const { data: subProgrammes, error } = await supabase
    .from('sub_programmes')
    .select('*, courses(*)')
    .eq('programme_id', programmeId)
    .eq('school_id', user.school_id)
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ sub_programmes: subProgrammes })
})
