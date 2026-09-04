import crypto from 'node:crypto'
import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { loadStudentCourseIds } from '../lib/student-course-access'
import {
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
} from '../middleware/auth'
import {
  buildPrivateFileKey,
  createPresignedUpload,
  createPresignedDownload,
  deletePrivateObject,
  uploadPrivateObject,
  verifyPrivateUpload,
} from '../storage/r2'
import {
  MAX_SLIDE_PAGES,
  SlideConversionValidationError,
  validateSlidePdf,
  validateSlidePdfMetadata,
} from '../slides/conversion-policy'
import { enqueuePresentationProcessing } from '../slides/presentation-processor'
import { readPdfPageCount } from '../slides/pdf-metadata'

export const slidesRouter = new Hono()
const db = supabase as any
const MAX_ANNOTATION_BYTES = 512 * 1024

type ClassroomUser = { id: string; school_id: string; role: string }
type LiveClassAccess = {
  id: string
  school_id: string
  course_id: string
  tutor_id: string
  status: string
  teaching_mode: 'whiteboard' | 'presentation'
  slides_urls: string[] | null
}

slidesRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)

async function loadClassForUser(classId: string, user: ClassroomUser) {
  const { data, error } = await db.from('live_classes')
    .select('id, school_id, course_id, tutor_id, status, teaching_mode, slides_urls')
    .eq('id', classId)
    .eq('school_id', user.school_id)
    .maybeSingle()
  if (error || !data) return null
  const liveClass = data as LiveClassAccess
  if (user.role === 'student') {
    const courseIds = await loadStudentCourseIds(user.id, user.school_id)
    if (!courseIds.includes(liveClass.course_id)) return null
  }
  if (user.role === 'tutor' && liveClass.tutor_id !== user.id) return null
  return liveClass
}

function canManage(liveClass: LiveClassAccess, user: ClassroomUser) {
  return user.role === 'tutor' && liveClass.tutor_id === user.id
}

async function requireClass(c: any, manage = false) {
  const user = c.get('user') as ClassroomUser
  let liveClass: LiveClassAccess | null
  try {
    liveClass = await loadClassForUser(c.req.param('id'), user)
  } catch {
    return { response: c.json({ error: 'Could not verify class access', code: 'CLASS_ACCESS_FAILED' }, 500) }
  }
  if (!liveClass) return { response: c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404) }
  if (manage && !canManage(liveClass, user)) {
    return { response: c.json({ error: 'Only the assigned tutor can change presentation materials', code: 'NOT_CLASS_TUTOR' }, 403) }
  }
  return { liveClass, user }
}

function publicPresentation(row: any) {
  return {
    id: row.id,
    filename: row.filename,
    file_size_bytes: row.file_size_bytes,
    page_count: row.page_count,
    processing_status: row.processing_status || 'ready',
    processing_error: row.processing_error || null,
    sort_order: row.sort_order,
    current_page: row.current_page,
    is_active: row.is_active,
    annotations: row.annotations || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function validPageAnnotations(value: unknown) {
  if (!Array.isArray(value) || value.length > 500) return false
  return value.every((stroke: any) => stroke
    && typeof stroke.id === 'string' && stroke.id.length <= 100
    && typeof stroke.color === 'string' && stroke.color.length <= 32
    && typeof stroke.width === 'number' && stroke.width > 0 && stroke.width <= .05
    && Array.isArray(stroke.points) && stroke.points.length >= 2 && stroke.points.length <= 250
    && stroke.points.every((point: any) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
      && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1))
}

async function findPresentation(classId: string, presentationId: string) {
  const { data } = await db.from('live_class_presentations').select('*')
    .eq('id', presentationId).eq('live_class_id', classId).maybeSingle()
  return data
}

// State recovery endpoint. It is intentionally API-backed because LiveKit data
// packets are not buffered for clients that reconnect after an update.
slidesRouter.get('/:id/presentations', async (c) => {
  const access = await requireClass(c)
  if ('response' in access) return access.response
  const { data, error } = await db.from('live_class_presentations').select('*')
    .eq('live_class_id', access.liveClass.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: 'Could not load presentation materials' }, 500)
  return c.json({ data: {
    teaching_mode: access.liveClass.teaching_mode,
    tutor_identity: access.liveClass.tutor_id,
    presentations: (data || []).map(publicPresentation),
    legacy_slide_urls: data?.length ? [] : (access.liveClass.slides_urls || []),
  } })
})

slidesRouter.post('/:id/presentations/upload', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  if (access.liveClass.status !== 'live') {
    return c.json({ error: 'Class must be live to upload material', code: 'CLASS_NOT_LIVE' }, 400)
  }
  let metadata: { fileName: string; contentType: string; fileSizeBytes: number }
  try {
    const body = await c.req.json()
    metadata = validateSlidePdfMetadata({ fileName: body.file_name, contentType: body.content_type, fileSizeBytes: body.file_size_bytes })
  } catch (error) {
    if (error instanceof SlideConversionValidationError) {
      return c.json({ error: error.message, code: error.code }, 400)
    }
    throw error
  }

  const presentationId = crypto.randomUUID()
  const { data: last } = await db.from('live_class_presentations').select('sort_order')
    .eq('live_class_id', access.liveClass.id).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  try {
    const upload = await createPresignedUpload({ schoolId: access.user.school_id, entityType: 'live_class_presentation', contextId: access.liveClass.id, fileName: metadata.fileName, contentType: metadata.contentType, fileSizeBytes: metadata.fileSizeBytes })
    const { data, error } = await db.from('live_class_presentations').insert({
      id: presentationId,
      school_id: access.user.school_id,
      live_class_id: access.liveClass.id,
      uploaded_by: access.user.id,
      file_key: upload.fileKey,
      filename: metadata.fileName.slice(0, 255),
      file_size_bytes: metadata.fileSizeBytes,
      page_count: null,
      processing_status: 'uploading',
      sort_order: (last?.sort_order ?? -1) + 1,
    }).select('*').single()
    if (error) throw error
    return c.json({ data: { material: publicPresentation(data), upload_url: upload.presignedUrl, expires_in_seconds: upload.expiresInSeconds } }, 201)
  } catch (error) {
    console.error('[presentations] upload failed', error)
    return c.json({ error: 'Could not save presentation material' }, 500)
  }
})

slidesRouter.post('/:id/presentations/:presentationId/complete', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const presentation = await findPresentation(access.liveClass.id, c.req.param('presentationId'))
  if (!presentation) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  if (presentation.processing_status !== 'uploading') return c.json({ error: 'Material upload is not awaiting confirmation', code: 'INVALID_UPLOAD_STATE' }, 409)
  try {
    await verifyPrivateUpload({ fileKey: presentation.file_key, schoolId: access.user.school_id, entityType: 'live_class_presentation', contextId: access.liveClass.id, contentType: 'application/pdf', fileSizeBytes: presentation.file_size_bytes })
    const { data, error } = await db.from('live_class_presentations').update({ processing_status: 'processing', processing_started_at: new Date().toISOString() })
      .eq('id', presentation.id).eq('live_class_id', access.liveClass.id).eq('processing_status', 'uploading').select('*').single()
    if (error) throw error
    enqueuePresentationProcessing(presentation.id)
    return c.json({ data: publicPresentation(data) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not verify uploaded PDF'
    await db.from('live_class_presentations').update({ processing_status: 'failed', processing_error: message.slice(0, 500) })
      .eq('id', presentation.id).eq('live_class_id', access.liveClass.id)
    return c.json({ error: message, code: 'UPLOAD_VERIFICATION_FAILED' }, 400)
  }
})

slidesRouter.get('/:id/presentations/:presentationId/view', async (c) => {
  const access = await requireClass(c)
  if ('response' in access) return access.response
  const presentation = await findPresentation(access.liveClass.id, c.req.param('presentationId'))
  if (!presentation) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  if (presentation.processing_status !== 'ready') return c.json({ error: 'Material is still being prepared', code: 'MATERIAL_NOT_READY' }, 409)
  const viewUrl = await createPresignedDownload(presentation.file_key, access.user.school_id, 600)
  return c.json({ data: { url: viewUrl, expires_in_seconds: 600 } })
})

slidesRouter.post('/:id/presentations/:presentationId/replace', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const presentation = await findPresentation(access.liveClass.id, c.req.param('presentationId'))
  if (!presentation) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  let file: File
  try {
    const body = await c.req.parseBody()
    file = validateSlidePdf(body.file as File | undefined)
  } catch (error) {
    if (error instanceof SlideConversionValidationError) return c.json({ error: error.message, code: error.code }, 400)
    throw error
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  let pageCount: number
  try { pageCount = await readPdfPageCount(new Uint8Array(buffer)) }
  catch { return c.json({ error: 'The PDF could not be read', code: 'INVALID_PDF' }, 400) }
  if (pageCount < 1 || pageCount > MAX_SLIDE_PAGES) {
    return c.json({ error: `PDF must contain between 1 and ${MAX_SLIDE_PAGES} pages`, code: 'PAGE_LIMIT_EXCEEDED' }, 400)
  }
  const fileKey = buildPrivateFileKey(access.user.school_id, 'live_class_presentation', access.liveClass.id, 'pdf')
  try {
    await uploadPrivateObject({ fileKey, schoolId: access.user.school_id, body: buffer, contentType: 'application/pdf' })
    const { data, error } = await db.from('live_class_presentations').update({
      file_key: fileKey,
      filename: file.name.slice(0, 255),
      file_size_bytes: file.size,
      page_count: pageCount,
      current_page: 1,
      annotations: {},
    }).eq('id', presentation.id).eq('live_class_id', access.liveClass.id).select('*').single()
    if (error) throw error
    await deletePrivateObject(presentation.file_key, access.user.school_id).catch((error) => {
      console.error('[presentations] old replacement object cleanup failed', error)
    })
    return c.json({ data: publicPresentation(data) })
  } catch (error) {
    await deletePrivateObject(fileKey, access.user.school_id).catch(() => undefined)
    console.error('[presentations] replacement failed', error)
    return c.json({ error: 'Could not replace presentation material' }, 500)
  }
})

slidesRouter.post('/:id/presentations/:presentationId/activate', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const presentation = await findPresentation(access.liveClass.id, c.req.param('presentationId'))
  if (!presentation) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  await db.from('live_class_presentations').update({ is_active: false }).eq('live_class_id', access.liveClass.id)
  const { data, error } = await db.from('live_class_presentations').update({ is_active: true })
    .eq('id', presentation.id).eq('live_class_id', access.liveClass.id).select('*').single()
  if (error) return c.json({ error: 'Could not activate material' }, 500)
  await db.from('live_classes').update({ teaching_mode: 'presentation' }).eq('id', access.liveClass.id)
  return c.json({ data: publicPresentation(data) })
})

slidesRouter.patch('/:id/presentations/:presentationId/page', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const presentation = await findPresentation(access.liveClass.id, c.req.param('presentationId'))
  if (!presentation) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  const { page } = await c.req.json()
  if (!Number.isInteger(page) || page < 1 || page > presentation.page_count) {
    return c.json({ error: 'Page is outside this document', code: 'INVALID_PAGE' }, 400)
  }
  const { data, error } = await db.from('live_class_presentations').update({ current_page: page })
    .eq('id', presentation.id).eq('live_class_id', access.liveClass.id).select('*').single()
  if (error) return c.json({ error: 'Could not change page' }, 500)
  return c.json({ data: publicPresentation(data) })
})

slidesRouter.patch('/:id/presentations/:presentationId/annotations', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const presentation = await findPresentation(access.liveClass.id, c.req.param('presentationId'))
  if (!presentation) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  const body = await c.req.json()
  if (!Number.isInteger(body.page) || body.page < 1 || body.page > presentation.page_count || !validPageAnnotations(body.annotations) && body.annotations?.length !== 0) {
    return c.json({ error: 'Invalid page annotations', code: 'INVALID_ANNOTATIONS' }, 400)
  }
  const nextAnnotations = { ...(presentation.annotations || {}), [String(body.page)]: body.annotations }
  if (Buffer.byteLength(JSON.stringify(nextAnnotations)) > MAX_ANNOTATION_BYTES) {
    return c.json({ error: 'Annotations exceed the material limit', code: 'ANNOTATIONS_TOO_LARGE' }, 400)
  }
  const { data, error } = await db.from('live_class_presentations').update({ annotations: nextAnnotations })
    .eq('id', presentation.id).eq('live_class_id', access.liveClass.id).select('*').single()
  if (error) return c.json({ error: 'Could not save annotations' }, 500)
  return c.json({ data: publicPresentation(data) })
})

slidesRouter.patch('/:id/presentations/reorder', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const { ordered_ids: ids } = await c.req.json()
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string')) {
    return c.json({ error: 'ordered_ids must contain unique material IDs', code: 'INVALID_ORDER' }, 400)
  }
  const { data: existing } = await db.from('live_class_presentations').select('id').eq('live_class_id', access.liveClass.id)
  if (ids.length !== existing?.length || existing.some((row: any) => !ids.includes(row.id))) {
    return c.json({ error: 'Order must include every class material exactly once', code: 'INVALID_ORDER' }, 400)
  }
  await Promise.all(ids.map((id, sortOrder) => db.from('live_class_presentations').update({ sort_order: sortOrder }).eq('id', id).eq('live_class_id', access.liveClass.id)))
  return c.json({ data: { ordered_ids: ids } })
})

slidesRouter.patch('/:id/presentations/:presentationId', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const filename = String((await c.req.json()).filename || '').trim()
  if (!filename || filename.length > 255) return c.json({ error: 'Filename must be 1–255 characters', code: 'INVALID_FILENAME' }, 400)
  const { data, error } = await db.from('live_class_presentations').update({ filename })
    .eq('id', c.req.param('presentationId')).eq('live_class_id', access.liveClass.id).select('*').maybeSingle()
  if (error || !data) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  return c.json({ data: publicPresentation(data) })
})

slidesRouter.post('/:id/presentations/close', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  await db.from('live_class_presentations').update({ is_active: false }).eq('live_class_id', access.liveClass.id)
  const { error } = await db.from('live_classes').update({ teaching_mode: 'whiteboard' }).eq('id', access.liveClass.id)
  if (error) return c.json({ error: 'Could not close presentation' }, 500)
  return c.json({ data: { teaching_mode: 'whiteboard' } })
})

slidesRouter.delete('/:id/presentations/:presentationId', async (c) => {
  const access = await requireClass(c, true)
  if ('response' in access) return access.response
  const presentation = await findPresentation(access.liveClass.id, c.req.param('presentationId'))
  if (!presentation) return c.json({ error: 'Material not found', code: 'NOT_FOUND' }, 404)
  await deletePrivateObject(presentation.file_key, access.user.school_id)
  const { error } = await db.from('live_class_presentations').delete().eq('id', presentation.id).eq('live_class_id', access.liveClass.id)
  if (error) return c.json({ error: 'Could not remove material' }, 500)
  if (presentation.is_active) {
    await db.from('live_classes').update({ teaching_mode: 'whiteboard' }).eq('id', access.liveClass.id)
  }
  return c.body(null, 204)
})
