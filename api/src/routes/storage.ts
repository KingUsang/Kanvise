import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware } from '../middleware/auth'
import type { AppVariables } from '../types'
import {
  createPresignedDownload,
  createPresignedPublicUpload,
  createPresignedUpload,
  deleteStoredObject,
  isPrivateUploadType,
  isPublicUploadType,
  publicFileKeyFromUrl,
  publicFileUrl,
  StorageError,
  verifyPublicUpload,
} from '../storage/r2'
import { loadStudentCourseIds } from '../lib/student-course-access'

export const storageRouter = new Hono<{ Variables: AppVariables }>()

storageRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware)

async function canUploadToCourse(user: AppVariables['user'], courseId: string) {
  const { data: course } = await supabase.from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('school_id', user.school_id)
    .maybeSingle()
  if (!course) return false
  if (user.role === 'admin') return true
  if (user.role !== 'tutor') return false

  const { data: assignment } = await supabase.from('tutor_course_assignments')
    .select('id')
    .eq('school_id', user.school_id)
    .eq('course_id', courseId)
    .eq('tutor_id', user.id)
    .maybeSingle()
  return Boolean(assignment)
}

async function canSubmitAssignment(user: AppVariables['user'], assignmentId: string) {
  if (!user.school_id || user.role !== 'student') return false
  const { data: assignment } = await supabase.from('assignments')
    .select('course_id')
    .eq('id', assignmentId)
    .eq('school_id', user.school_id)
    .eq('is_published', true)
    .maybeSingle()
  if (!assignment) return false

  return (await loadStudentCourseIds(user.id, user.school_id)).includes(assignment.course_id)
}

async function presignUpload(c: any) {
  try {
    const user = c.get('user') as AppVariables['user']
    const body = await c.req.json()
    const { file_name, content_type, file_size_bytes, entity_type, course_id } = body

    if (!user.school_id) return c.json({ error: 'User has no school setup', code: 'NO_SCHOOL' }, 400)
    if (!file_name || !content_type || !file_size_bytes || !entity_type) {
      return c.json({ error: 'Missing required fields', code: 'BAD_REQUEST' }, 400)
    }
    if (!isPrivateUploadType(entity_type)) {
      return c.json({ error: 'Unsupported upload entity type', code: 'INVALID_ENTITY_TYPE' }, 400)
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
    }

    const result = await createPresignedUpload({
      schoolId: user.school_id,
      entityType: entity_type,
      contextId: entity_type === 'submission' ? body.assignment_id : course_id,
      fileName: file_name,
      contentType: content_type,
      fileSizeBytes: Number(file_size_bytes),
    })
    return c.json({ data: {
      presigned_url: result.presignedUrl,
      file_key: result.fileKey,
      expires_in_seconds: result.expiresInSeconds,
    } })
  } catch (error: any) {
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status)
    console.error('POST /storage/presign/upload error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

async function presignDownload(c: any) {
  try {
    const user = c.get('user') as AppVariables['user']
    const fileKey = c.req.query('file_key')
    if (!user.school_id) return c.json({ error: 'User has no school setup', code: 'NO_SCHOOL' }, 400)
    if (!fileKey) return c.json({ error: 'Missing file_key', code: 'BAD_REQUEST' }, 400)
    const downloadUrl = await createPresignedDownload(fileKey, user.school_id)
    return c.json({ data: { download_url: downloadUrl, expires_in_seconds: 900 } })
  } catch (error: any) {
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
    const { data } = await supabase.from('programmes').select('id')
      .eq('id', contextId).eq('school_id', user.school_id).maybeSingle()
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
    return c.json({ data: {
      presigned_url: result.presignedUrl,
      file_key: result.fileKey,
      public_url: result.publicUrl,
      expires_in_seconds: result.expiresInSeconds,
    } })
  } catch (error: any) {
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

    let data: any
    let oldKey: string | null = null
    if (entity_type === 'profile_photo') {
      const { data: old } = await supabase.from('user_profiles').select('profile_photo_key').eq('id', user.id).single()
      oldKey = old?.profile_photo_key || null
      const result = await supabase.from('user_profiles').update({ profile_photo_key: file_key }).eq('id', user.id).select().single()
      if (result.error) throw result.error
      data = result.data
    } else if (entity_type === 'programme_thumbnail') {
      const { data: old } = await supabase.from('programmes').select('thumbnail_url').eq('id', context_id).eq('school_id', user.school_id).single()
      oldKey = publicFileKeyFromUrl(old?.thumbnail_url)
      const result = await supabase.from('programmes').update({ thumbnail_url: publicFileUrl(file_key) })
        .eq('id', context_id).eq('school_id', user.school_id).select().single()
      if (result.error) throw result.error
      data = result.data
    } else {
      const column = entity_type === 'logo' ? 'logo_url' : entity_type === 'banner' ? 'banner_url' : 'video_intro_url'
      const { data: old } = await supabase.from('schools').select(column).eq('id', user.school_id).single()
      const oldMedia = old as Partial<Record<typeof column, string | null>> | null
      oldKey = publicFileKeyFromUrl(oldMedia?.[column])
      const result = await supabase.from('schools').update({ [column]: publicFileUrl(file_key) })
        .eq('id', user.school_id).select().single()
      if (result.error) throw result.error
      data = result.data
    }

    if (oldKey && oldKey !== file_key) {
      deleteStoredObject(oldKey).catch(error => console.error('storage.old_public_media_cleanup_failed', { oldKey, error }))
    }
    return c.json({ data, file_key, public_url: publicFileUrl(file_key) })
  } catch (error: any) {
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
