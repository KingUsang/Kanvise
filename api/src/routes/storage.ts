import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware } from '../middleware/auth'
import type { AccountContext } from '../types'
import type { AppVariables } from '../types'
import {
  createPresignedDownload,
  createPresignedPublicUpload,
  createPresignedUpload,
  isPrivateUploadType,
  isPublicUploadType,
  publicFileKeyFromUrl,
  publicFileUrl,
  StorageError,
  verifyPublicUpload,
} from '../storage/r2'
import { z } from 'zod'
import { loadStudentCourseIds } from '../lib/student-course-access'
import { tutorCanManageCourse } from '../lib/course-management-access'
import type { TablesUpdate } from '../lib/database.types'
import { consumeUploadIntent, recordUploadIntent, releaseUploadIntent } from '../storage/upload-intents'
import { enqueuePublicObjectDeletion } from '../jobs/storage-cleanup'

export const storageRouter = new Hono<{ Variables: AppVariables }>()

storageRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware)
storageRouter.use('*', accountContextMiddleware)
storageRouter.use('*', async (c, next) => {
  const account = c.get('account') as AccountContext | undefined
  if (!account) return c.json({ error: 'Tutoring account context is required', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
  const user = c.get('user')
  c.set('user', {
    ...user,
    school_id: account.id,
    role: account.role === 'learner' ? 'student' : account.role,
  })
  await next()
})

// Authorization lookups that fail must surface as a dependency failure (503),
// never as a permission denial (DEV-UPL-018).
class AuthorizationLookupError extends Error {}

function lookupFailed(error: unknown): never {
  console.error('storage.authorization_lookup_failed', error)
  throw new AuthorizationLookupError('authorization lookup failed')
}

// Only these types are uploaded directly by clients. Presentation, recording,
// transcript and feedback objects are created by their own authorized routes.
const CLIENT_UPLOAD_TYPES = ['note', 'assignment_attachment', 'submission', 'question_media'] as const

const presignUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  content_type: z.string().trim().min(1).max(127),
  file_size_bytes: z.coerce.number().int().positive(),
  entity_type: z.string().min(1).max(64),
  course_id: z.string().uuid().optional(),
  assignment_id: z.string().uuid().optional(),
  bank_id: z.string().uuid().optional(),
})

async function canUploadToCourse(user: AppVariables['user'], courseId: string) {
  const access = await tutorCanManageCourse(user as any, courseId)
  if (access.error) lookupFailed(access.error)
  return access.allowed
}

async function canSubmitAssignment(user: AppVariables['user'], assignmentId: string) {
  if (!user.school_id || user.role !== 'student') return false
  const { data: assignment, error } = await supabase.from('assignments')
    .select('course_id')
    .eq('id', assignmentId)
    .eq('school_id', user.school_id)
    .eq('is_published', true)
    .maybeSingle()
  if (error) lookupFailed(error)
  if (!assignment) return false

  try {
    return (await loadStudentCourseIds(user.id, user.school_id)).includes(assignment.course_id)
  } catch (lookupError) {
    return lookupFailed(lookupError)
  }
}

async function canUploadQuestionMedia(user: AppVariables['user'], bankId: string) {
  if (!user.school_id || !['admin', 'tutor'].includes(user.role)) return false
  const { data: bank, error } = await supabase.from('question_banks')
    .select('owner_id, visibility, archived_at')
    .eq('id', bankId).eq('school_id', user.school_id).maybeSingle()
  if (error) lookupFailed(error)
  if (!bank || bank.archived_at) return false
  return user.role === 'admin' || bank.owner_id === user.id || bank.visibility === 'centre'
}

function serviceUnavailable(c: any) {
  return c.json({ error: 'Storage authorization is temporarily unavailable. Please retry.', code: 'SERVICE_UNAVAILABLE' }, 503)
}

async function presignUpload(c: any) {
  try {
    const user = c.get('user') as AppVariables['user']
    if (!user.school_id) return c.json({ error: 'User has no school setup', code: 'NO_SCHOOL' }, 400)
    const rawBody = await c.req.json().catch(() => null)
    const parsed = presignUploadSchema.safeParse(rawBody)
    if (!parsed.success) return c.json({ error: 'Missing or invalid upload fields', code: 'BAD_REQUEST' }, 400)
    const { file_name, content_type, file_size_bytes, entity_type, course_id } = parsed.data
    const body = parsed.data

    if (!isPrivateUploadType(entity_type)) {
      return c.json({ error: 'Unsupported upload entity type', code: 'INVALID_ENTITY_TYPE' }, 400)
    }
    if (!(CLIENT_UPLOAD_TYPES as readonly string[]).includes(entity_type)) {
      return c.json({ error: 'This upload type cannot be requested directly', code: 'FORBIDDEN' }, 403)
    }

    if (entity_type === 'note' || entity_type === 'assignment_attachment') {
      if (!course_id) return c.json({ error: 'course_id is required', code: 'BAD_REQUEST' }, 400)
      if (!(await canUploadToCourse(user, course_id))) {
        return c.json({ error: 'Not permitted to upload files to this course', code: 'FORBIDDEN' }, 403)
      }
    } else if (entity_type === 'submission') {
      if (!body.assignment_id) return c.json({ error: 'assignment_id is required', code: 'BAD_REQUEST' }, 400)
      if (!(await canSubmitAssignment(user, body.assignment_id))) {
        return c.json({ error: 'Not permitted to submit this assignment', code: 'FORBIDDEN' }, 403)
      }
    } else if (entity_type === 'question_media') {
      if (!body.bank_id) return c.json({ error: 'bank_id is required', code: 'BAD_REQUEST' }, 400)
      if (!(await canUploadQuestionMedia(user, body.bank_id))) {
        return c.json({ error: 'Not permitted to add images to this question bank', code: 'FORBIDDEN' }, 403)
      }
    }

    const result = await createPresignedUpload({
      schoolId: user.school_id,
      entityType: entity_type,
      contextId: (entity_type === 'submission' ? body.assignment_id
        : entity_type === 'question_media' ? body.bank_id
        : course_id) as string,
      fileName: file_name,
      contentType: content_type,
      fileSizeBytes: file_size_bytes,
    })
    await recordUploadIntent({
      schoolId: user.school_id, requesterId: user.id, fileKey: result.fileKey, scope: 'private',
      entityType: entity_type,
      contextId: (entity_type === 'submission' ? body.assignment_id
        : entity_type === 'question_media' ? body.bank_id
        : course_id) as string,
      contentType: content_type, fileSizeBytes: file_size_bytes,
    })
    return c.json({ data: {
      presigned_url: result.presignedUrl,
      file_key: result.fileKey,
      expires_in_seconds: result.expiresInSeconds,
    } })
  } catch (error: any) {
    if (error instanceof AuthorizationLookupError) return serviceUnavailable(c)
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status)
    console.error('POST /storage/presign/upload error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

type DownloadDecision = 'allowed' | 'denied' | 'not_found'

/**
 * Resource-scoped download authorization (DEV-UPL-001). A key is only
 * downloadable through this route when it is registered on a Note, Assignment
 * or Submission, or is Question media, and the caller may see that resource.
 * Presentation, recording, transcript and feedback objects are served only by
 * their owning routes.
 */
async function authorizePrivateDownload(user: AppVariables['user'], fileKey: string): Promise<DownloadDecision> {
  const schoolId = user.school_id!
  const parts = fileKey.split('/')
  if (parts.length !== 6 || parts[0] !== 'schools' || parts[1] !== schoolId || parts[2] !== 'private') return 'denied'
  const [, , , entityType, contextId] = parts

  const enrolled = async (courseId: string) => {
    if (user.role !== 'student') return false
    try {
      return (await loadStudentCourseIds(user.id, schoolId)).includes(courseId)
    } catch (lookupError) {
      return lookupFailed(lookupError)
    }
  }
  const manages = async (courseId: string) => {
    const access = await tutorCanManageCourse(user as any, courseId)
    if (access.error) lookupFailed(access.error)
    return access.allowed
  }

  if (entityType === 'question_media') {
    return (await canUploadQuestionMedia(user, contextId)) ? 'allowed' : 'denied'
  }
  if (entityType === 'note') {
    const { data, error } = await supabase.from('notes').select('course_id')
      .eq('school_id', schoolId).eq('file_key', fileKey).maybeSingle()
    if (error) lookupFailed(error)
    if (!data) return 'not_found'
    return (await manages(data.course_id) || await enrolled(data.course_id)) ? 'allowed' : 'denied'
  }
  if (entityType === 'assignment_attachment') {
    const { data, error } = await supabase.from('assignments').select('course_id, is_published')
      .eq('school_id', schoolId).eq('attachment_file_key', fileKey).maybeSingle()
    if (error) lookupFailed(error)
    if (!data) return 'not_found'
    if (await manages(data.course_id)) return 'allowed'
    return data.is_published && await enrolled(data.course_id) ? 'allowed' : 'denied'
  }
  if (entityType === 'submission') {
    const { data, error } = await supabase.from('submissions').select('student_id, assignment_id')
      .eq('school_id', schoolId).eq('file_key', fileKey).maybeSingle()
    if (error) lookupFailed(error)
    if (!data) return 'not_found'
    if (data.student_id === user.id) return 'allowed'
    const { data: assignment, error: assignmentError } = await supabase.from('assignments').select('course_id')
      .eq('school_id', schoolId).eq('id', data.assignment_id).maybeSingle()
    if (assignmentError) lookupFailed(assignmentError)
    return assignment && await manages(assignment.course_id) ? 'allowed' : 'denied'
  }
  return 'denied'
}

async function presignDownload(c: any) {
  try {
    const user = c.get('user') as AppVariables['user']
    const fileKey = c.req.query('file_key')
    if (!user.school_id) return c.json({ error: 'User has no school setup', code: 'NO_SCHOOL' }, 400)
    if (!fileKey) return c.json({ error: 'Missing file_key', code: 'BAD_REQUEST' }, 400)
    const decision = await authorizePrivateDownload(user, fileKey)
    if (decision === 'not_found') return c.json({ error: 'File not found', code: 'NOT_FOUND' }, 404)
    if (decision !== 'allowed') return c.json({ error: 'Not permitted to access this file', code: 'FORBIDDEN' }, 403)
    const downloadUrl = await createPresignedDownload(fileKey, user.school_id)
    return c.json({ data: { download_url: downloadUrl, expires_in_seconds: 900 } })
  } catch (error: any) {
    if (error instanceof AuthorizationLookupError) return serviceUnavailable(c)
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status)
    console.error('GET /storage/presign/download error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

async function authorizePublicContext(user: AppVariables['user'], entityType: string, contextId: string) {
  if (!user.school_id) return false
  if (entityType === 'profile_photo') return contextId === user.id
  if (user.role !== 'admin') return false
  if (['logo', 'banner', 'video_intro', 'promo'].includes(entityType)) return contextId === user.school_id
  if (entityType === 'programme_thumbnail') {
    const { data, error } = await supabase.from('programmes').select('id')
      .eq('id', contextId).eq('school_id', user.school_id).maybeSingle()
    if (error) lookupFailed(error)
    return Boolean(data)
  }
  return false
}

async function presignPublicUpload(c: any) {
  try {
    const user = c.get('user') as AppVariables['user']
    const body = await c.req.json()
    const { file_name, content_type, file_size_bytes, entity_type, context_id } = body
    if (!user.school_id) return c.json({ error: 'User has no school setup', code: 'NO_SCHOOL' }, 400)
    if (!file_name || !content_type || !file_size_bytes || !entity_type || !context_id) {
      return c.json({ error: 'Missing required fields', code: 'BAD_REQUEST' }, 400)
    }
    if (!isPublicUploadType(entity_type)) {
      return c.json({ error: 'Unsupported public media type', code: 'INVALID_ENTITY_TYPE' }, 400)
    }
    if (!(await authorizePublicContext(user, entity_type, context_id))) {
      return c.json({ error: 'Not permitted to update this media', code: 'FORBIDDEN' }, 403)
    }
    const result = await createPresignedPublicUpload({
      schoolId: user.school_id,
      entityType: entity_type,
      contextId: context_id,
      fileName: file_name,
      contentType: content_type,
      fileSizeBytes: Number(file_size_bytes),
    })
    await recordUploadIntent({
      schoolId: user.school_id, requesterId: user.id, fileKey: result.fileKey, scope: 'public',
      entityType: entity_type, contextId: context_id, contentType: content_type, fileSizeBytes: Number(file_size_bytes),
    })
    return c.json({ data: {
      presigned_url: result.presignedUrl,
      file_key: result.fileKey,
      public_url: result.publicUrl,
      expires_in_seconds: result.expiresInSeconds,
    } })
  } catch (error: any) {
    if (error instanceof AuthorizationLookupError) return serviceUnavailable(c)
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status)
    console.error('POST /storage/presign/public error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

async function confirmPublicUpload(c: any) {
  try {
    const user = c.get('user') as AppVariables['user']
    const body = await c.req.json()
    const { file_key, content_type, file_size_bytes, entity_type, context_id } = body
    if (!user.school_id) return c.json({ error: 'User has no school setup', code: 'NO_SCHOOL' }, 400)
    if (!file_key || !content_type || !file_size_bytes || !entity_type || !context_id) {
      return c.json({ error: 'Missing required fields', code: 'BAD_REQUEST' }, 400)
    }
    if (!isPublicUploadType(entity_type) || entity_type === 'promo') {
      return c.json({ error: 'Unsupported media registration type', code: 'INVALID_ENTITY_TYPE' }, 400)
    }
    if (!(await authorizePublicContext(user, entity_type, context_id))) {
      return c.json({ error: 'Not permitted to update this media', code: 'FORBIDDEN' }, 403)
    }
    await verifyPublicUpload({
      fileKey: file_key,
      schoolId: user.school_id,
      entityType: entity_type,
      contextId: context_id,
      contentType: content_type,
      fileSizeBytes: Number(file_size_bytes),
    })

    const intent = { schoolId: user.school_id, requesterId: user.id, fileKey: file_key }
    await consumeUploadIntent(intent)
    try {
      let data: any
      let oldKey: string | null = null
      if (entity_type === 'profile_photo') {
        const { data: old, error: oldError } = await supabase.from('user_profiles').select('profile_photo_key').eq('id', user.id).single()
        if (oldError) throw oldError
        oldKey = old?.profile_photo_key || null
        const result = await supabase.from('user_profiles').update({ profile_photo_key: file_key }).eq('id', user.id).select().single()
        if (result.error) throw result.error
        data = result.data
      } else if (entity_type === 'programme_thumbnail') {
        const { data: old, error: oldError } = await supabase.from('programmes').select('thumbnail_url').eq('id', context_id).eq('school_id', user.school_id).single()
        if (oldError) throw oldError
        oldKey = publicFileKeyFromUrl(old?.thumbnail_url)
        const result = await supabase.from('programmes').update({ thumbnail_url: publicFileUrl(file_key) })
          .eq('id', context_id).eq('school_id', user.school_id).select().single()
        if (result.error) throw result.error
        data = result.data
      } else {
        const column = entity_type === 'logo' ? 'logo_url' : entity_type === 'banner' ? 'banner_url' : 'video_intro_url'
        const { data: old, error: oldError } = await supabase.from('schools').select(column).eq('id', user.school_id).single()
        if (oldError) throw oldError
        const oldMedia = old as Partial<Record<typeof column, string | null>> | null
        oldKey = publicFileKeyFromUrl(oldMedia?.[column])
        const result = await supabase.from('schools').update({ [column]: publicFileUrl(file_key) } as TablesUpdate<'schools'>)
          .eq('id', user.school_id).select().single()
        if (result.error) throw result.error
        data = result.data
      }

      if (oldKey && oldKey !== file_key) await enqueuePublicObjectDeletion(oldKey, user.school_id)
      return c.json({ data, file_key, public_url: publicFileUrl(file_key) })
    } catch (registrationError) {
      await releaseUploadIntent(intent)
      throw registrationError
    }
  } catch (error: any) {
    if (error instanceof AuthorizationLookupError) return serviceUnavailable(c)
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status)
    console.error('POST /storage/public/confirm error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

storageRouter.post('/presign/upload', presignUpload)
storageRouter.get('/presign/download', presignDownload)
storageRouter.post('/presign/public', presignPublicUpload)
storageRouter.post('/public/confirm', confirmPublicUpload)

// Backward-compatible aliases while existing clients move to the documented paths.
storageRouter.post('/presigned-url', presignUpload)
storageRouter.get('/presigned-url', presignDownload)
