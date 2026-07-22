import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import type { AppVariables, KanviseUser } from '../types'
import { createPresignedDownload, StorageError, verifyPrivateUpload } from '../storage/r2'
import { loadStudentCourseIds } from '../lib/student-course-access'

export const courseAssignmentsRouter = new Hono<{ Variables: AppVariables }>()
export const assignmentsRouter = new Hono<{ Variables: AppVariables }>()

for (const router of [courseAssignmentsRouter, assignmentsRouter]) {
  router.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)
}

async function courseForSchool(courseId: string, schoolId: string) {
  const { data } = await supabase.from('courses')
    .select('id, programme_id')
    .eq('id', courseId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return data
}

async function tutorCanManageCourse(user: KanviseUser, courseId: string) {
  if (!user.school_id || !(await courseForSchool(courseId, user.school_id))) return false
  if (user.role === 'admin') return true
  if (user.role !== 'tutor') return false
  const { data } = await supabase.from('tutor_course_assignments')
    .select('id')
    .eq('school_id', user.school_id)
    .eq('course_id', courseId)
    .eq('tutor_id', user.id)
    .maybeSingle()
  return Boolean(data)
}

async function studentCanAccessCourse(user: KanviseUser, courseId: string) {
  if (!user.school_id) return false
  return (await loadStudentCourseIds(user.id, user.school_id)).includes(courseId)
}

function storageFailure(c: any, error: unknown) {
  if (error instanceof StorageError) {
    return c.json({ error: error.message, code: error.code }, error.status)
  }
  console.error('assignment.storage_verification_failed', error)
  return c.json({ error: 'Could not verify uploaded file', code: 'STORAGE_VERIFICATION_FAILED' }, 500)
}

courseAssignmentsRouter.post('/:courseId/assignments', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const courseId = c.req.param('courseId')!
  if (!(await tutorCanManageCourse(user, courseId))) {
    return c.json({ error: 'Not assigned to this course', code: 'NOT_ASSIGNED_TO_COURSE' }, 403)
  }

  const body = await c.req.json()
  const { title, description, deadline_at, attachment_file_key, attachment_file_name, attachment_file_type, attachment_file_size_bytes } = body
  if (!title?.trim() || !description?.trim() || !deadline_at) {
    return c.json({ error: 'title, description and deadline_at are required', code: 'BAD_REQUEST' }, 400)
  }
  const deadline = new Date(deadline_at)
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() < Date.now() + 60 * 60 * 1000) {
    return c.json({ error: 'Deadline must be at least one hour in the future', code: 'DEADLINE_TOO_SOON' }, 400)
  }

  if (attachment_file_key) {
    if (!attachment_file_name || !attachment_file_type || !attachment_file_size_bytes) {
      return c.json({ error: 'Attachment metadata is required', code: 'BAD_REQUEST' }, 400)
    }
    try {
      await verifyPrivateUpload({
        fileKey: attachment_file_key,
        schoolId: user.school_id!,
        entityType: 'assignment_attachment',
        contextId: courseId,
        contentType: attachment_file_type,
        fileSizeBytes: Number(attachment_file_size_bytes),
      })
    } catch (error) {
      return storageFailure(c, error)
    }
    const { data: reused } = await supabase.from('assignments').select('id')
      .eq('school_id', user.school_id).eq('attachment_file_key', attachment_file_key).maybeSingle()
    if (reused) return c.json({ error: 'Attachment has already been registered', code: 'FILE_ALREADY_REGISTERED' }, 409)
  }

  const { data, error } = await supabase.from('assignments').insert({
    school_id: user.school_id,
    course_id: courseId,
    tutor_id: user.id,
    title: title.trim(),
    description: description.trim(),
    deadline_at: deadline.toISOString(),
    attachment_file_key: attachment_file_key || null,
    attachment_file_name: attachment_file_name || null,
    is_published: Boolean(body.is_published),
  }).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

courseAssignmentsRouter.get('/:courseId/assignments', async (c) => {
  const user = c.get('user')
  const courseId = c.req.param('courseId')!
  const allowed = user.role === 'student'
    ? await studentCanAccessCourse(user, courseId)
    : await tutorCanManageCourse(user, courseId)
  if (!allowed) return c.json({ error: 'Cannot access this course', code: 'FORBIDDEN' }, 403)

  let query = supabase.from('assignments').select('*')
    .eq('school_id', user.school_id)
    .eq('course_id', courseId)
    .order('deadline_at', { ascending: true })
  if (user.role === 'student') query = query.eq('is_published', true)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)

  const submissionByAssignment = new Map<string, any>()
  if (user.role === 'student' && data?.length) {
    const { data: submissions } = await supabase.from('submissions').select('*')
      .eq('school_id', user.school_id)
      .eq('student_id', user.id)
      .in('assignment_id', data.map((item) => item.id))
    for (const submission of submissions || []) submissionByAssignment.set(submission.assignment_id, submission)
  }

  const enhanced = await Promise.all((data || []).map(async (assignment) => ({
    ...assignment,
    attachment_download_url: assignment.attachment_file_key
      ? await createPresignedDownload(assignment.attachment_file_key, user.school_id!)
      : null,
    submission: submissionByAssignment.get(assignment.id) || null,
  })))
  return c.json({ data: enhanced })
})

assignmentsRouter.get('/', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const requestedPage = Number(c.req.query('page') || 1)
  const requestedPageSize = Number(c.req.query('page_size') || 20)
  if (!Number.isInteger(requestedPage) || requestedPage < 1
    || !Number.isInteger(requestedPageSize) || requestedPageSize < 1 || requestedPageSize > 100) {
    return c.json({ error: 'page must be positive and page_size must be between 1 and 100', code: 'BAD_REQUEST' }, 400)
  }

  let courseIds: string[] | null = null
  if (user.role === 'tutor') {
    const { data: courseAssignments, error } = await supabase.from('tutor_course_assignments')
      .select('course_id')
      .eq('school_id', user.school_id)
      .eq('tutor_id', user.id)
    if (error) return c.json({ error: error.message }, 500)
    courseIds = [...new Set((courseAssignments || []).map(item => item.course_id))]
    if (!courseIds.length) {
      return c.json({ data: [], pagination: { page: requestedPage, page_size: requestedPageSize, total: 0, has_more: false } })
    }
  }

  const offset = (requestedPage - 1) * requestedPageSize
  let query = supabase.from('assignments')
    .select('*, course:courses(id, name), submissions(count)', { count: 'exact' })
    .eq('school_id', user.school_id)
  if (courseIds) query = query.in('course_id', courseIds)
  const courseId = c.req.query('course_id')
  if (courseId) {
    if (courseIds && !courseIds.includes(courseId)) {
      return c.json({ error: 'Not assigned to this course', code: 'FORBIDDEN' }, 403)
    }
    query = query.eq('course_id', courseId)
  }
  const published = c.req.query('is_published')
  if (published !== undefined && !['true', 'false'].includes(published)) {
    return c.json({ error: 'is_published must be true or false', code: 'BAD_REQUEST' }, 400)
  }
  if (published !== undefined) query = query.eq('is_published', published === 'true')

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + requestedPageSize - 1)
  if (error) return c.json({ error: error.message }, 500)

  const assignments = (data || []).map(({ submissions, ...assignment }) => ({
    ...assignment,
    submission_count: submissions?.[0]?.count || 0,
  }))
  const total = count || 0
  return c.json({
    data: assignments,
    pagination: {
      page: requestedPage,
      page_size: requestedPageSize,
      total,
      has_more: offset + assignments.length < total,
    },
  })
})

assignmentsRouter.post('/:id{[0-9a-fA-F-]{36}}/publish', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment } = await supabase.from('assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  if (!(await tutorCanManageCourse(user, assignment.course_id))) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  const { data, error } = await supabase.from('assignments').update({ is_published: true })
    .eq('id', id).eq('school_id', user.school_id).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

assignmentsRouter.get('/:id{[0-9a-fA-F-]{36}}', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment } = await supabase.from('assignments').select('*, course:courses(id, name)')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const allowed = user.role === 'student'
    ? assignment.is_published && await studentCanAccessCourse(user, assignment.course_id)
    : await tutorCanManageCourse(user, assignment.course_id)
  if (!allowed) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  return c.json({ data: {
    ...assignment,
    attachment_download_url: assignment.attachment_file_key
      ? await createPresignedDownload(assignment.attachment_file_key, user.school_id!) : null,
  } })
})

assignmentsRouter.patch('/:id{[0-9a-fA-F-]{36}}', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment } = await supabase.from('assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  if (!(await tutorCanManageCourse(user, assignment.course_id))) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  const body = await c.req.json()
  const { count } = await supabase.from('submissions').select('*', { count: 'exact', head: true })
    .eq('school_id', user.school_id).eq('assignment_id', id)
  if (body.deadline_at) {
    const proposed = new Date(body.deadline_at)
    if (!Number.isFinite(proposed.getTime()) || proposed.getTime() < Date.now() + 60 * 60 * 1000) {
      return c.json({ error: 'Deadline must be at least one hour in the future', code: 'DEADLINE_TOO_SOON' }, 400)
    }
    if (count && proposed.getTime() < new Date(assignment.deadline_at).getTime()) {
      return c.json({ error: 'Cannot shorten deadline after submissions', code: 'CANNOT_SHORTEN_DEADLINE_WITH_SUBMISSIONS' }, 400)
    }
  }
  const update: any = {}
  for (const key of ['title', 'description', 'deadline_at']) if (body[key] !== undefined) update[key] = body[key]
  const { data, error } = await supabase.from('assignments').update(update)
    .eq('id', id).eq('school_id', user.school_id).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

assignmentsRouter.delete('/:id{[0-9a-fA-F-]{36}}', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment } = await supabase.from('assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  if (!(await tutorCanManageCourse(user, assignment.course_id))) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  const { count } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', id)
  if (count) return c.json({ error: 'Cannot delete an assignment with submissions', code: 'HAS_SUBMISSIONS' }, 409)
  const { error } = await supabase.from('assignments').delete().eq('id', id).eq('school_id', user.school_id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Assignment deleted' })
})

assignmentsRouter.get('/me', requireRole('student'), async (c) => {
  const user = c.get('user')
  let courseIds: string[]
  try {
    courseIds = await loadStudentCourseIds(user.id, user.school_id!)
  } catch {
    return c.json({ error: 'Failed to resolve assignment access', code: 'ASSIGNMENT_ACCESS_FAILED' }, 500)
  }
  if (!courseIds.length) return c.json({ data: [] })

  const { data, error } = await supabase.from('assignments')
    .select('*, course:courses(id, name)')
    .eq('school_id', user.school_id)
    .eq('is_published', true)
    .in('course_id', courseIds)
    .order('deadline_at')
  if (error) return c.json({ error: error.message }, 500)
  const { data: submissions } = await supabase.from('submissions').select('*')
    .eq('school_id', user.school_id).eq('student_id', user.id)
    .in('assignment_id', (data || []).map((item) => item.id))
  const byAssignment = new Map((submissions || []).map((item) => [item.assignment_id, item]))
  const enhanced = await Promise.all((data || []).map(async (assignment) => {
    const submission = byAssignment.get(assignment.id) || null
    return {
      ...assignment,
      attachment_download_url: assignment.attachment_file_key ? await createPresignedDownload(assignment.attachment_file_key, user.school_id!) : null,
      submission: submission ? { ...submission, download_url: await createPresignedDownload(submission.file_key, user.school_id!) } : null,
    }
  }))
  return c.json({ data: enhanced })
})

assignmentsRouter.post('/:assignmentId/submit', requireRole('student'), async (c) => {
  const user = c.get('user')
  const assignmentId = c.req.param('assignmentId')!
  const { data: assignment } = await supabase.from('assignments').select('*')
    .eq('id', assignmentId).eq('school_id', user.school_id).eq('is_published', true).maybeSingle()
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  if (!(await studentCanAccessCourse(user, assignment.course_id))) return c.json({ error: 'Not enrolled', code: 'NOT_ENROLLED' }, 403)

  const { data: existing } = await supabase.from('submissions').select('id')
    .eq('assignment_id', assignmentId).eq('student_id', user.id).maybeSingle()
  if (existing) return c.json({ error: 'Assignment already submitted', code: 'ALREADY_SUBMITTED' }, 409)

  const body = await c.req.json()
  const { file_key, file_name, file_type, file_size_bytes } = body
  if (!file_key || !file_name || !file_type || !file_size_bytes) return c.json({ error: 'File metadata is required', code: 'BAD_REQUEST' }, 400)
  try {
    await verifyPrivateUpload({ fileKey: file_key, schoolId: user.school_id!, entityType: 'submission', contextId: assignmentId, contentType: file_type, fileSizeBytes: Number(file_size_bytes) })
  } catch (error) {
    return storageFailure(c, error)
  }

  const { data: reused } = await supabase.from('submissions').select('id')
    .eq('school_id', user.school_id).eq('file_key', file_key).maybeSingle()
  if (reused) return c.json({ error: 'File has already been registered', code: 'FILE_ALREADY_REGISTERED' }, 409)

  const isLate = Date.now() > new Date(assignment.deadline_at).getTime()
  const { data, error } = await supabase.from('submissions').insert({
    school_id: user.school_id,
    assignment_id: assignmentId,
    student_id: user.id,
    file_key,
    file_name,
    is_late: isLate,
  }).select().single()
  if (error?.code === '23505') return c.json({ error: 'Assignment already submitted', code: 'ALREADY_SUBMITTED' }, 409)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data: {
    ...data,
    is_late: isLate,
    download_url: await createPresignedDownload(file_key, user.school_id!),
  } }, 201)
})

assignmentsRouter.get('/:assignmentId/submissions', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const assignmentId = c.req.param('assignmentId')!
  const { data: assignment } = await supabase.from('assignments').select('*')
    .eq('id', assignmentId).eq('school_id', user.school_id).maybeSingle()
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  if (!(await tutorCanManageCourse(user, assignment.course_id))) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)

  const { data, error } = await supabase.from('submissions')
    .select('*, student:user_profiles!submissions_student_id_fkey(id, first_name, last_name)')
    .eq('school_id', user.school_id).eq('assignment_id', assignmentId).order('submitted_at')
  if (error) return c.json({ error: error.message }, 500)
  const enhanced = await Promise.all((data || []).map(async (submission) => ({
    ...submission,
    download_url: await createPresignedDownload(submission.file_key, user.school_id!),
  })))
  return c.json({ data: enhanced, summary: {
    total_submitted: enhanced.length,
    total_reviewed: enhanced.filter((item) => item.reviewed_at).length,
  } })
})
