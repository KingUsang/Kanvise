import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware } from '../middleware/auth'

type Variables = { user: any }
type SubjectInput = { name?: unknown; description?: unknown; tutor_ids?: unknown }

export const programmesRouter = new Hono<{ Variables: Variables }>()

programmesRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware)

const enforceAdmin = async (c: any, next: any) => {
  const profile = c.get('user')
  if (profile.role !== 'admin') {
    return c.json({ error: 'Only admins can perform this action', code: 'FORBIDDEN' }, 403)
  }
  await next()
}

const enforceAdminOrTutor = async (c: any, next: any) => {
  const profile = c.get('user')
  if (!['admin', 'tutor'].includes(profile.role)) {
    return c.json({ error: 'Students cannot access curriculum management', code: 'FORBIDDEN' }, 403)
  }
  await next()
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function normaliseSubjects(subjects: SubjectInput[]) {
  return subjects.map((subject, index) => ({
    name: typeof subject.name === 'string' ? subject.name.trim() : '',
    slug: slugify(typeof subject.name === 'string' ? subject.name.trim() : ''),
    description: typeof subject.description === 'string' ? subject.description.trim() : '',
    tutor_ids: Array.isArray(subject.tutor_ids)
      ? [...new Set(subject.tutor_ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : [],
    sort_order: index,
  }))
}

async function loadProgrammeSubjects(schoolId: string, programmeId: string) {
  const [{ data: subProgrammes, error: subError }, { data: allCourses, error: courseError }] = await Promise.all([
    supabase.from('sub_programmes').select('id').eq('school_id', schoolId).eq('programme_id', programmeId),
    supabase.from('courses').select('*').eq('school_id', schoolId),
  ])
  if (subError) throw subError
  if (courseError) throw courseError
  const subIds = new Set((subProgrammes || []).map(item => item.id))
  return (allCourses || [])
    .filter(course => course.programme_id === programmeId || (course.sub_programme_id && subIds.has(course.sub_programme_id)))
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name))
}

// Compatibility create endpoint. New UI uses /setup so a programme cannot be created empty.
programmesRouter.post('/', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    if (!profile.school_id) return c.json({ error: 'Admin has no school setup', code: 'NO_SCHOOL' }, 400)
    const body = await c.req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const slug = slugify(typeof body.slug === 'string' ? body.slug : name)
    if (!name || !slug) return c.json({ error: 'Missing required fields', code: 'BAD_REQUEST' }, 400)

    const { data, error } = await supabase.from('programmes').insert({
      school_id: profile.school_id,
      name,
      slug,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      price: Number.isFinite(Number(body.price)) ? Math.max(Number(body.price), 0) : 0,
      currency: body.currency || 'NGN',
      thumbnail_url: null,
      is_published: false,
      created_by: profile.id,
    }).select().single()
    if (error) throw error
    return c.json({ data, message: 'Programme created successfully' }, 201)
  } catch (error: any) {
    const status = error.code === '23505' ? 409 : 500
    return c.json({ error: status === 409 ? 'A programme with this name already exists' : error.message || 'Internal server error', code: status === 409 ? 'SLUG_TAKEN' : undefined }, status)
  }
})

// Atomically creates a draft programme, its subjects, and optional teaching assignments.
programmesRouter.post('/setup', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    if (!profile.school_id) return c.json({ error: 'Admin has no school setup', code: 'NO_SCHOOL' }, 400)
    const body = await c.req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const programmeSlug = slugify(name)
    const subjects = (Array.isArray(body.subjects) ? normaliseSubjects(body.subjects) : [])
      .map(subject => ({ ...subject, slug: slugify(`${programmeSlug}-${subject.name}`) }))
    if (!name) return c.json({ error: 'Programme name is required', code: 'PROGRAMME_NAME_REQUIRED' }, 400)
    if (subjects.length === 0) return c.json({ error: 'Add at least one subject', code: 'SUBJECT_REQUIRED' }, 400)
    if (subjects.some(subject => !subject.name || !subject.slug)) {
      return c.json({ error: 'Every subject needs a name', code: 'SUBJECT_NAME_REQUIRED' }, 400)
    }
    const names = subjects.map(subject => subject.name.toLocaleLowerCase())
    if (new Set(names).size !== names.length) {
      return c.json({ error: 'Subject names must be unique within a programme', code: 'DUPLICATE_SUBJECTS' }, 400)
    }

    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      return c.json({ error: 'Enter a valid programme fee', code: 'INVALID_PRICE' }, 400)
    }

    const { data, error } = await (supabase as any).rpc('setup_programme', {
      p_school_id: profile.school_id,
      p_created_by: profile.id,
      p_name: name,
      p_slug: programmeSlug,
      p_description: typeof body.description === 'string' ? body.description.trim() : '',
      p_price: price,
      p_currency: body.currency || 'NGN',
      p_subjects: subjects,
    })
    if (error) throw error
    return c.json({ data, message: 'Programme setup saved as a draft' }, 201)
  } catch (error: any) {
    const code = error.message === 'TUTOR_SCHOOL_MISMATCH' ? 'INVALID_TUTOR'
      : error.message === 'DUPLICATE_SUBJECTS' ? 'DUPLICATE_SUBJECTS'
      : error.code === '23505' ? 'SLUG_TAKEN' : 'SETUP_FAILED'
    const status = ['INVALID_TUTOR', 'DUPLICATE_SUBJECTS'].includes(code) ? 400 : code === 'SLUG_TAKEN' ? 409 : 500
    return c.json({ error: code === 'INVALID_TUTOR' ? 'A selected tutor does not belong to this centre' : error.message || 'Programme setup failed', code }, status)
  }
})

programmesRouter.get('/', enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get('user')
    if (!profile.school_id) return c.json({ data: [] })
    const isPublished = c.req.query('is_published')
    let query = supabase.from('programmes').select('*, enrolments(count)').eq('school_id', profile.school_id)
    if (isPublished !== undefined) query = query.eq('is_published', isPublished === 'true')
    const [{ data: programmes, error }, { data: subProgrammes, error: subError }, { data: courses, error: courseError }, { data: assignments, error: assignmentError }] = await Promise.all([
      query.order('created_at', { ascending: false }),
      supabase.from('sub_programmes').select('id, programme_id').eq('school_id', profile.school_id),
      supabase.from('courses').select('*').eq('school_id', profile.school_id),
      supabase.from('tutor_course_assignments').select('course_id, tutor_id').eq('school_id', profile.school_id),
    ])
    if (error) throw error
    if (subError) throw subError
    if (courseError) throw courseError
    if (assignmentError) throw assignmentError

    const parentBySub = new Map((subProgrammes || []).map(item => [item.id, item.programme_id]))
    const tutorsByCourse = new Map<string, string[]>()
    for (const assignment of assignments || []) {
      tutorsByCourse.set(assignment.course_id, [...(tutorsByCourse.get(assignment.course_id) || []), assignment.tutor_id])
    }
    const enhanced = (programmes || []).map(programme => {
      const subjects = (courses || []).filter(course => course.programme_id === programme.id || parentBySub.get(course.sub_programme_id || '') === programme.id)
        .map((course: any) => ({ ...course, tutor_ids: tutorsByCourse.get(course.id) || [] }))
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name))
      return {
        ...programme,
        courses: subjects,
        courses_count: subjects.length,
        assigned_subjects_count: subjects.filter(subject => subject.tutor_ids.length > 0).length,
        tutors_complete: subjects.length > 0 && subjects.every(subject => subject.tutor_ids.length > 0),
        enrolled_count: programme.enrolments?.[0]?.count || 0,
      }
    })
    return c.json({ data: profile.role === 'tutor'
      ? enhanced.filter(programme => programme.courses.some(subject => subject.tutor_ids.includes(profile.id)))
      : enhanced })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.get('/:id', enforceAdminOrTutor, async (c) => {
  try {
    const profile = c.get('user')
    const id = c.req.param('id')
    const { data: programme, error } = await supabase.from('programmes').select('*, enrolments(count)')
      .eq('id', id).eq('school_id', profile.school_id).single()
    if (error || !programme) return c.json({ error: 'Programme not found', code: 'NOT_FOUND' }, 404)
    const subjects = await loadProgrammeSubjects(profile.school_id, id)
    const subjectIds = subjects.map(subject => subject.id)
    let assignments: any[] = []
    if (subjectIds.length > 0) {
      const result = await supabase.from('tutor_course_assignments').select('course_id, tutor_id')
        .eq('school_id', profile.school_id).in('course_id', subjectIds)
      if (result.error) throw result.error
      assignments = result.data || []
    }
    return c.json({ data: {
      ...programme,
      courses: subjects.map(subject => ({
        ...subject,
        tutor_ids: assignments.filter(item => item.course_id === subject.id).map(item => item.tutor_id),
      })),
      courses_count: subjects.length,
      enrolled_count: programme.enrolments?.[0]?.count || 0,
    } })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.patch('/:id', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const body = await c.req.json()
    const updates: any = {}
    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim()
      updates.slug = slugify(body.name)
    }
    if (typeof body.description === 'string') updates.description = body.description.trim() || null
    if (body.price !== undefined && Number.isFinite(Number(body.price)) && Number(body.price) >= 0) updates.price = Number(body.price)
    const { data, error } = await supabase.from('programmes').update(updates)
      .eq('id', c.req.param('id')).eq('school_id', profile.school_id).select().single()
    if (error) throw error
    if (!data) return c.json({ error: 'Programme not found', code: 'NOT_FOUND' }, 404)
    return c.json({ data, message: 'Programme updated successfully' })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.post('/:id/publish', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const id = c.req.param('id')
    const { data: programme } = await supabase.from('programmes').select('id').eq('id', id).eq('school_id', profile.school_id).maybeSingle()
    if (!programme) return c.json({ error: 'Programme not found', code: 'NOT_FOUND' }, 404)
    const subjects = await loadProgrammeSubjects(profile.school_id, id)
    if (subjects.length === 0) {
      return c.json({ error: 'A programme must have at least one subject before it can be published.', code: 'NO_SUBJECTS_IN_PROGRAMME', readiness: { subject_count: 0, missing_tutors: [] } }, 400)
    }
    const subjectIds = subjects.map(subject => subject.id)
    const { data: assignments, error: assignmentError } = await supabase.from('tutor_course_assignments')
      .select('course_id').eq('school_id', profile.school_id).in('course_id', subjectIds)
    if (assignmentError) throw assignmentError
    const assigned = new Set((assignments || []).map(item => item.course_id))
    const missingTutors = subjects.filter(subject => !assigned.has(subject.id)).map(subject => ({ id: subject.id, name: subject.name }))
    if (missingTutors.length > 0) {
      return c.json({ error: 'Assign at least one tutor to every subject before publishing.', code: 'SUBJECTS_NEED_TUTORS', readiness: { subject_count: subjects.length, missing_tutors: missingTutors } }, 400)
    }
    const { error: subjectError } = await supabase.from('courses').update({ is_published: true })
      .eq('school_id', profile.school_id).in('id', subjectIds)
    if (subjectError) throw subjectError
    const { data, error } = await supabase.from('programmes').update({ is_published: true })
      .eq('id', id).eq('school_id', profile.school_id).select().single()
    if (error) throw error
    return c.json({ message: 'Programme published', data })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.post('/:id/unpublish', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const { data, error } = await supabase.from('programmes').update({ is_published: false })
      .eq('id', c.req.param('id')).eq('school_id', profile.school_id).select().single()
    if (error) throw error
    return c.json({ message: 'Programme unpublished', data })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

programmesRouter.delete('/:id', enforceAdmin, async (c) => {
  try {
    const profile = c.get('user')
    const id = c.req.param('id')
    const { count, error: countError } = await supabase.from('enrolments').select('*', { count: 'exact', head: true })
      .eq('programme_id', id).eq('school_id', profile.school_id)
    if (countError && countError.code !== '42P01') throw countError
    if (count && count > 0) return c.json({ error: 'Cannot delete programme with active enrolments', code: 'ACTIVE_ENROLMENTS_EXIST' }, 409)
    const { error } = await supabase.from('programmes').delete().eq('id', id).eq('school_id', profile.school_id)
    if (error) throw error
    return c.json({ message: 'Programme deleted' })
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})
