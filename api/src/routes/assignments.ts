import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware, requireMembershipRole } from '../middleware/auth'
import type { AccountContext, TenantVariables, TenantUser } from '../types'
import { createPresignedDownload, StorageError, verifyPrivateUpload } from '../storage/r2'
import { loadStudentCourseIds } from '../lib/student-course-access'
import { parseOffsetPagination, strictBooleanQuerySchema } from '../lib/api-contract'

export const courseAssignmentsRouter = new Hono<{ Variables: TenantVariables }>()
export const assignmentsRouter = new Hono<{ Variables: TenantVariables }>()

const accountUserProjection = async (c: any, next: any) => {
  const user = c.get('user')
  const account = c.get('account') as AccountContext | undefined
  if (!account) return c.json({ error: 'Tutoring account context is required', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
  c.set('user', {
    ...user,
    school_id: account.id,
    role: account.role === 'learner' ? 'student' : account.role,
  })
  await next()
}

for (const router of [courseAssignmentsRouter, assignmentsRouter]) {
  router.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, accountContextMiddleware, accountUserProjection)
}

type AccessResult = { allowed: boolean; error?: unknown }

async function courseForAccount(courseId: string, schoolId: string) {
  const { data, error } = await supabase.from('courses')
    .select('id, programme_id')
    .eq('id', courseId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return { data, error }
}

async function tutorCanManageCourse(user: TenantUser, courseId: string): Promise<AccessResult> {
  if (!user.school_id) return { allowed: false }
  const course = await courseForAccount(courseId, user.school_id)
  if (course.error) return { allowed: false, error: course.error }
  if (!course.data) return { allowed: false }
  if (user.role === 'admin') return { allowed: true }
  if (user.role !== 'tutor') return { allowed: false }
  const { data, error } = await supabase.from('tutor_course_assignments')
    .select('id')
    .eq('school_id', user.school_id)
    .eq('course_id', courseId)
    .eq('tutor_id', user.id)
    .maybeSingle()
  if (error) return { allowed: false, error }
  return { allowed: Boolean(data) }
}

async function studentCanAccessCourse(user: TenantUser, courseId: string): Promise<AccessResult> {
  if (!user.school_id) return { allowed: false }
  try {
    return { allowed: (await loadStudentCourseIds(user.id, user.school_id)).includes(courseId) }
  } catch (error) {
    return { allowed: false, error }
  }
}

function dependencyFailure(c: any, code: string, error: unknown) {
  console.error(`assignment.${code.toLowerCase()}`, error instanceof Error ? error.name : 'unknown')
  return c.json({ error: 'Could not verify assignment access right now', code }, 503)
}

function safeReadFailure(c: any, code: string, error: unknown) {
  console.error(`assignment.${code.toLowerCase()}`, error instanceof Error ? error.name : 'unknown')
  return c.json({ error: 'Could not load assignment data right now', code }, 503)
}

async function optionalDownloadUrl(fileKey: string | null | undefined, schoolId: string) {
  if (!fileKey) return null
  try {
    return await createPresignedDownload(fileKey, schoolId)
  } catch (error) {
    console.error('assignment.download_url_unavailable', error instanceof Error ? error.name : 'unknown')
    return null
  }
}

function storageFailure(c: any, error: unknown) {
  if (error instanceof StorageError) {
    return c.json({ error: error.message, code: error.code }, error.status)
  }
  console.error('assignment.storage_verification_failed', error instanceof Error ? error.name : 'unknown')
  return c.json({ error: 'Could not verify uploaded file', code: 'STORAGE_VERIFICATION_FAILED' }, 500)
}

function withoutPrivateFileKey<T extends Record<string, any>>(submission: T): Omit<T, 'file_key'> {
  const { file_key: _fileKey, ...safeSubmission } = submission
  return safeSubmission as Omit<T, 'file_key'>
}

courseAssignmentsRouter.post('/:courseId/assignments', requireMembershipRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const courseId = c.req.param('courseId')!
  const access = await tutorCanManageCourse(user, courseId)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) {
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
    const { data: reused, error: reusedError } = await supabase.from('assignments').select('id')
      .eq('school_id', user.school_id).eq('attachment_file_key', attachment_file_key).maybeSingle()
    if (reusedError) return safeReadFailure(c, 'ASSIGNMENT_LOOKUP_FAILED', reusedError)
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
  if (error) return safeReadFailure(c, 'ASSIGNMENT_CREATE_FAILED', error)
  return c.json({ data }, 201)
})

courseAssignmentsRouter.get('/:courseId/assignments', async (c) => {
  const user = c.get('user')
  const courseId = c.req.param('courseId')!
  const access = user.role === 'student'
    ? await studentCanAccessCourse(user, courseId)
    : await tutorCanManageCourse(user, courseId)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) return c.json({ error: 'Cannot access this course', code: 'FORBIDDEN' }, 403)

  let query = supabase.from('assignments').select('*')
    .eq('school_id', user.school_id)
    .eq('course_id', courseId)
    .order('deadline_at', { ascending: true })
  if (user.role === 'student') query = query.eq('is_published', true)
  const { data, error } = await query
  if (error) return safeReadFailure(c, 'ASSIGNMENT_LIST_FAILED', error)

  const submissionByAssignment = new Map<string, any>()
  if (user.role === 'student' && data?.length) {
    const { data: submissions, error: submissionsError } = await supabase.from('submissions').select('*')
      .eq('school_id', user.school_id)
      .eq('student_id', user.id)
      .in('assignment_id', data.map((item) => item.id))
    if (submissionsError) return safeReadFailure(c, 'SUBMISSION_LIST_FAILED', submissionsError)
    for (const submission of submissions || []) submissionByAssignment.set(submission.assignment_id, submission)
  }

  const enhanced = await Promise.all((data || []).map(async (assignment) => ({
    ...assignment,
    attachment_download_url: await optionalDownloadUrl(assignment.attachment_file_key, user.school_id!),
    submission: submissionByAssignment.get(assignment.id) || null,
  })))
  return c.json({ data: enhanced })
})

assignmentsRouter.get('/', requireMembershipRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const pagination = parseOffsetPagination(c.req.query('page'), c.req.query('page_size'))
  if (!pagination) return c.json({ error: 'Invalid pagination', code: 'VALIDATION_ERROR' }, 400)
  const published = c.req.query('is_published')
  const parsedPublished = strictBooleanQuerySchema.safeParse(published)
  if (published !== undefined && !parsedPublished.success) {
    return c.json({ error: 'is_published must be true or false', code: 'VALIDATION_ERROR' }, 400)
  }

  let courseIds: string[] | null = null
  if (user.role === 'tutor') {
    const { data: courseAssignments, error } = await supabase.from('tutor_course_assignments')
      .select('course_id')
      .eq('school_id', user.school_id)
      .eq('tutor_id', user.id)
    if (error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', error)
    courseIds = [...new Set((courseAssignments || []).map(item => item.course_id))]
    if (!courseIds.length) {
      return c.json({ data: [], pagination: { page: pagination.page, page_size: pagination.pageSize, total: 0, has_more: false } })
    }
  }

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
  if (parsedPublished.success) query = query.eq('is_published', parsedPublished.data === 'true')

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.pageSize - 1)
  if (error) return safeReadFailure(c, 'ASSIGNMENT_LIST_FAILED', error)

  const assignments = (data || []).map(({ submissions, ...assignment }) => ({
    ...assignment,
    submission_count: submissions?.[0]?.count || 0,
  }))
  const total = count || 0
  return c.json({
    data: assignments,
    pagination: {
      page: pagination.page,
      page_size: pagination.pageSize,
      total,
      has_more: pagination.offset + assignments.length < total,
    },
  })
})

assignmentsRouter.post('/:id{[0-9a-fA-F-]{36}}/publish', requireMembershipRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment, error: assignmentError } = await supabase.from('assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (assignmentError) return safeReadFailure(c, 'ASSIGNMENT_LOOKUP_FAILED', assignmentError)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const access = await tutorCanManageCourse(user, assignment.course_id)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  const { data, error } = await supabase.from('assignments').update({ is_published: true })
    .eq('id', id).eq('school_id', user.school_id).select().single()
  if (error) return safeReadFailure(c, 'ASSIGNMENT_UPDATE_FAILED', error)
  return c.json({ data })
})

assignmentsRouter.get('/:id{[0-9a-fA-F-]{36}}', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment, error: assignmentError } = await supabase.from('assignments').select('*, course:courses(id, name)')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (assignmentError) return safeReadFailure(c, 'ASSIGNMENT_LOOKUP_FAILED', assignmentError)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const access = user.role === 'student'
    ? assignment.is_published ? await studentCanAccessCourse(user, assignment.course_id) : { allowed: false }
    : await tutorCanManageCourse(user, assignment.course_id)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  return c.json({ data: {
    ...assignment,
    attachment_download_url: await optionalDownloadUrl(assignment.attachment_file_key, user.school_id!),
  } })
})

assignmentsRouter.patch('/:id{[0-9a-fA-F-]{36}}', requireMembershipRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment, error: assignmentError } = await supabase.from('assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (assignmentError) return safeReadFailure(c, 'ASSIGNMENT_LOOKUP_FAILED', assignmentError)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const access = await tutorCanManageCourse(user, assignment.course_id)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  const body = await c.req.json()
  const { count, error: submissionCountError } = await supabase.from('submissions').select('*', { count: 'exact', head: true })
    .eq('school_id', user.school_id).eq('assignment_id', id)
  if (submissionCountError) return safeReadFailure(c, 'SUBMISSION_LOOKUP_FAILED', submissionCountError)
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
  if (error) return safeReadFailure(c, 'ASSIGNMENT_UPDATE_FAILED', error)
  return c.json({ data })
})

assignmentsRouter.delete('/:id{[0-9a-fA-F-]{36}}', requireMembershipRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const { data: assignment, error: assignmentError } = await supabase.from('assignments').select('*')
    .eq('id', id).eq('school_id', user.school_id).maybeSingle()
  if (assignmentError) return safeReadFailure(c, 'ASSIGNMENT_LOOKUP_FAILED', assignmentError)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const access = await tutorCanManageCourse(user, assignment.course_id)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
  const { count, error: submissionCountError } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', id)
  if (submissionCountError) return safeReadFailure(c, 'SUBMISSION_LOOKUP_FAILED', submissionCountError)
  if (count) return c.json({ error: 'Cannot delete an assignment with submissions', code: 'HAS_SUBMISSIONS' }, 409)
  const { error } = await supabase.from('assignments').delete().eq('id', id).eq('school_id', user.school_id)
  if (error) return safeReadFailure(c, 'ASSIGNMENT_DELETE_FAILED', error)
  return c.json({ message: 'Assignment deleted' })
})

assignmentsRouter.get('/me', requireMembershipRole('learner'), async (c) => {
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
  if (error) return safeReadFailure(c, 'ASSIGNMENT_LIST_FAILED', error)
  const { data: submissions, error: submissionsError } = await supabase.from('submissions').select('*')
    .eq('school_id', user.school_id).eq('student_id', user.id)
    .in('assignment_id', (data || []).map((item) => item.id))
  if (submissionsError) return safeReadFailure(c, 'SUBMISSION_LIST_FAILED', submissionsError)
  const byAssignment = new Map((submissions || []).map((item) => [item.assignment_id, item]))
  const enhanced = await Promise.all((data || []).map(async (assignment) => {
    const submission = byAssignment.get(assignment.id) || null
    return {
      ...assignment,
      attachment_download_url: await optionalDownloadUrl(assignment.attachment_file_key, user.school_id!),
      submission: submission ? {
        ...withoutPrivateFileKey(submission),
        download_url: await optionalDownloadUrl(submission.file_key, user.school_id!),
      } : null,
    }
  }))
  return c.json({ data: enhanced })
})

assignmentsRouter.post('/:assignmentId/submit', requireMembershipRole('learner'), async (c) => {
  const user = c.get('user')
  const assignmentId = c.req.param('assignmentId')!
  const { data: assignment, error: assignmentError } = await supabase.from('assignments').select('*')
    .eq('id', assignmentId).eq('school_id', user.school_id).eq('is_published', true).maybeSingle()
  if (assignmentError) return safeReadFailure(c, 'ASSIGNMENT_LOOKUP_FAILED', assignmentError)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const access = await studentCanAccessCourse(user, assignment.course_id)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) return c.json({ error: 'Not enrolled', code: 'NOT_ENROLLED' }, 403)

  const { data: existing, error: existingError } = await supabase.from('submissions').select('id')
    .eq('assignment_id', assignmentId).eq('student_id', user.id).maybeSingle()
  if (existingError) return safeReadFailure(c, 'SUBMISSION_LOOKUP_FAILED', existingError)
  if (existing) return c.json({ error: 'Assignment already submitted', code: 'ALREADY_SUBMITTED' }, 409)

  const body = await c.req.json()
  const { file_key, file_name, file_type, file_size_bytes } = body
  if (!file_key || !file_name || !file_type || !file_size_bytes) return c.json({ error: 'File metadata is required', code: 'BAD_REQUEST' }, 400)
  try {
    await verifyPrivateUpload({ fileKey: file_key, schoolId: user.school_id!, entityType: 'submission', contextId: assignmentId, contentType: file_type, fileSizeBytes: Number(file_size_bytes) })
  } catch (error) {
    return storageFailure(c, error)
  }

  const { data: reused, error: reusedError } = await supabase.from('submissions').select('id')
    .eq('school_id', user.school_id).eq('file_key', file_key).maybeSingle()
  if (reusedError) return safeReadFailure(c, 'SUBMISSION_LOOKUP_FAILED', reusedError)
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
  if (error) return safeReadFailure(c, 'SUBMISSION_CREATE_FAILED', error)
  const downloadUrl = await optionalDownloadUrl(file_key, user.school_id!)
  return c.json({ data: {
    ...withoutPrivateFileKey(data),
    is_late: isLate,
    download_url: downloadUrl,
  } }, 201)
})

assignmentsRouter.get('/:assignmentId/submissions', requireMembershipRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const assignmentId = c.req.param('assignmentId')!
  const { data: assignment, error: assignmentError } = await supabase.from('assignments').select('*')
    .eq('id', assignmentId).eq('school_id', user.school_id).maybeSingle()
  if (assignmentError) return safeReadFailure(c, 'ASSIGNMENT_LOOKUP_FAILED', assignmentError)
  if (!assignment) return c.json({ error: 'Assignment not found', code: 'NOT_FOUND' }, 404)
  const access = await tutorCanManageCourse(user, assignment.course_id)
  if (access.error) return dependencyFailure(c, 'ASSIGNMENT_ACCESS_FAILED', access.error)
  if (!access.allowed) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)

  const { data, error } = await supabase.from('submissions')
    .select('*, student:user_profiles!submissions_student_id_fkey(id, first_name, last_name)')
    .eq('school_id', user.school_id).eq('assignment_id', assignmentId).order('submitted_at')
  if (error) return safeReadFailure(c, 'SUBMISSION_LIST_FAILED', error)
  const enhanced: Array<Record<string, any>> = await Promise.all((data || []).map(async (submission: any) => ({
    ...withoutPrivateFileKey(submission),
    download_url: await optionalDownloadUrl(submission.file_key, user.school_id!),
  })))
  return c.json({ data: enhanced, summary: {
    total_submitted: enhanced.length,
    total_reviewed: enhanced.filter((item) => item.reviewed_at).length,
  } })
})
