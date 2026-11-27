import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, accountContextMiddleware } from '../middleware/auth'
import { accountUserProjection } from '../middleware/account-projection'
import type { TenantVariables, TenantUser } from '../types'
import { createPresignedDownload, StorageError, verifyPrivateUpload } from '../storage/r2'
import type { TablesUpdate } from '../lib/database.types'
import {
  BANK_VISIBILITIES,
  canEditQuestionBank,
  canReadQuestionBank,
  escapeLikePattern,
  validateQuestionInput,
} from '../domain/question-bank'
import { parseOffsetPagination, uuidSchema } from '../lib/api-contract'

export const questionBanksRouter = new Hono<{ Variables: TenantVariables }>()

questionBanksRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, accountContextMiddleware, accountUserProjection)
questionBanksRouter.use('/*', requireRole('tutor', 'admin'))

const bankSelect = 'id, created_at, updated_at, archived_at, school_id, owner_id, name, description, visibility'
const questionSelect = `
  id, created_at, updated_at, archived_at, school_id, bank_id, author_id,
  course_id, subject_name, topic, subtopic, question_type, status,
  current_version:bank_question_versions!bank_questions_current_version_fkey(
    id, version_number, created_at, created_by, stimulus_id, plain_text,
    content_blocks, explanation_blocks, grading_rubric_blocks, marks,
    options:bank_question_option_versions(
      id, plain_text, content_blocks, is_correct, order_index
    )
  )
`

async function loadBank(bankId: string, schoolId: string) {
  const { data, error } = await supabase.from('question_banks').select(bankSelect)
    .eq('id', bankId).eq('school_id', schoolId).maybeSingle()
  if (error) throw error
  return data
}

function canContributeToBank(user: TenantUser, bank: any) {
  return canReadQuestionBank(user, bank)
    && (canEditQuestionBank(user, bank) || bank.visibility === 'centre')
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidSchema.safeParse(value).success
}

function invalidUuid(c: any, field: string) {
  return c.json({ error: `${field} must be a valid UUID`, code: 'VALIDATION_ERROR' }, 400)
}

function mapQuestionVersion(version: any) {
  if (!version) return version
  return {
    id: version.id,
    version_number: version.version_number,
    created_at: version.created_at,
    stimulus_id: version.stimulus_id,
    plain_text: version.plain_text,
    content_blocks: version.content_blocks,
    explanation_blocks: version.explanation_blocks,
    grading_rubric_blocks: version.grading_rubric_blocks,
    marks: version.marks,
    options: (version.options || []).map((option: any) => ({
      id: option.id,
      plain_text: option.plain_text,
      content_blocks: option.content_blocks,
      is_correct: option.is_correct,
      order_index: option.order_index,
    })),
  }
}

function mapQuestion(question: any) {
  return {
    id: question.id,
    created_at: question.created_at,
    updated_at: question.updated_at,
    archived_at: question.archived_at,
    course_id: question.course_id,
    subject_name: question.subject_name,
    topic: question.topic,
    subtopic: question.subtopic,
    question_type: question.question_type,
    status: question.status,
    current_version: mapQuestionVersion(question.current_version),
  }
}

function mapBank(bank: any, extras: Record<string, unknown> = {}) {
  return {
    id: bank.id,
    created_at: bank.created_at,
    updated_at: bank.updated_at,
    archived_at: bank.archived_at,
    name: bank.name,
    description: bank.description,
    visibility: bank.visibility,
    ...extras,
  }
}

function imageMediaIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap(block => block && typeof block === 'object'
    && (block as any).type === 'image' && typeof (block as any).media_id === 'string'
    ? [(block as any).media_id as string] : [])
}

async function addSignedMediaUrls(rows: any[], schoolId: string) {
  const mediaIds = [...new Set(rows.flatMap(question => {
    const version = question.current_version
    return [
      ...imageMediaIds(version?.content_blocks),
      ...imageMediaIds(version?.explanation_blocks),
      ...imageMediaIds(version?.grading_rubric_blocks),
      ...(version?.options || []).flatMap((option: any) => imageMediaIds(option.content_blocks)),
    ]
  }))]
  if (!mediaIds.length) return rows
  const { data: media, error } = await supabase.from('question_media')
    .select('id, storage_key, alt_text, width, height')
    .eq('school_id', schoolId).eq('processing_status', 'ready').in('id', mediaIds)
  if (error) throw error
  const resolved = new Map(await Promise.all((media || []).map(async item => [item.id, {
    ...item,
    url: await createPresignedDownload(item.storage_key, schoolId),
  }] as const)))
  const attach = (blocks: any[]) => (blocks || []).map(block => block?.type === 'image'
    ? { ...block, ...resolved.get(block.media_id), storage_key: undefined } : block)
  return rows.map(question => ({
    ...question,
    current_version: question.current_version ? {
      ...question.current_version,
      content_blocks: attach(question.current_version.content_blocks),
      explanation_blocks: attach(question.current_version.explanation_blocks),
      grading_rubric_blocks: attach(question.current_version.grading_rubric_blocks),
      options: (question.current_version.options || []).map((option: any) => ({
        ...option, content_blocks: attach(option.content_blocks),
      })),
    } : question.current_version,
  }))
}

async function tutorCanUseCourse(user: TenantUser, courseId: string | null) {
  if (!courseId || user.role === 'admin') return true
  const { data, error } = await supabase.from('tutor_course_assignments').select('id')
    .eq('school_id', user.school_id).eq('tutor_id', user.id).eq('course_id', courseId)
    .maybeSingle()
  // A failed lookup is an outage, not a "not assigned" decision (DEV-QBK-001).
  if (error) throw error
  return Boolean(data)
}

function pageParams(c: any) {
  return parseOffsetPagination(c.req.query('page'), c.req.query('page_size'))
}

function databaseError(c: any, error: any, fallback: string) {
  const message = String(error?.message || '')
  const known = [
    'QUESTION_BANK_NOT_FOUND', 'COURSE_NOT_FOUND', 'STIMULUS_NOT_FOUND',
    'INVALID_QUESTION_TYPE', 'QUESTION_CONTENT_REQUIRED', 'INVALID_MARKS',
    'OPTIONS_MUST_BE_ARRAY', 'INVALID_MCQ_OPTIONS', 'THEORY_CANNOT_HAVE_OPTIONS',
    'QUESTION_NOT_FOUND',
  ].find(code => message.includes(code))
  if (known) return c.json({ error: known.replaceAll('_', ' ').toLowerCase(), code: known }, 400)
  console.error('question_bank.database_error', { message, code: error?.code })
  return c.json({ error: fallback, code: 'DATABASE_ERROR' }, 500)
}

questionBanksRouter.get('/', async c => {
  const user = c.get('user')
  const pagination = pageParams(c)
  if (!pagination) return c.json({ error: 'Invalid pagination', code: 'VALIDATION_ERROR' }, 400)

  let query = supabase.from('question_banks')
    .select(`${bankSelect}, questions:bank_questions(count)`, { count: 'exact' })
    .eq('school_id', user.school_id).is('archived_at', null)
  if (user.role !== 'admin') query = query.or(`visibility.eq.centre,owner_id.eq.${user.id}`)

  const visibility = c.req.query('visibility')
  if (visibility && !BANK_VISIBILITIES.includes(visibility as any)) {
    return c.json({ error: 'visibility must be private or centre', code: 'BAD_REQUEST' }, 400)
  }
  if (visibility) query = query.eq('visibility', visibility)

  const { data, error, count } = await query.order('updated_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.pageSize - 1)
  if (error) return databaseError(c, error, 'Could not load question banks')

  const banks = (data || []).map(({ questions, ...bank }: any) => mapBank(bank, {
    question_count: questions?.[0]?.count || 0,
    can_edit: canEditQuestionBank(user, bank),
    // Same rule the add-question route enforces, so the UI never offers an action
    // the API will refuse (DEV-QBK-005).
    can_contribute: canContributeToBank(user, bank),
  }))
  return c.json({
    data: banks,
    pagination: {
      page: pagination.page,
      page_size: pagination.pageSize,
      total: count || 0,
      has_more: pagination.offset + banks.length < (count || 0),
    },
  })
})

questionBanksRouter.post('/', async c => {
  const user = c.get('user')
  const body = await c.req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() || null : null
  const visibility = body.visibility || 'private'
  if (!name || name.length > 160 || !BANK_VISIBILITIES.includes(visibility)) {
    return c.json({ error: 'Enter a name up to 160 characters and a valid visibility', code: 'BAD_REQUEST' }, 400)
  }

  const { data, error } = await supabase.from('question_banks').insert({
    school_id: user.school_id,
    owner_id: user.id,
    name,
    description,
    visibility,
  }).select(bankSelect).single()
  if (error) return databaseError(c, error, 'Could not create question bank')
  return c.json({ data: mapBank(data, { question_count: 0, can_edit: true, can_contribute: true }) }, 201)
})

questionBanksRouter.get('/:bankId', async c => {
  const user = c.get('user')
  const bankId = c.req.param('bankId')!
  if (!isUuid(bankId)) return invalidUuid(c, 'bank_id')
  try {
    const bank = await loadBank(bankId, user.school_id!)
    if (!bank || !canReadQuestionBank(user, bank)) {
      return c.json({ error: 'Question bank not found', code: 'NOT_FOUND' }, 404)
    }
    return c.json({ data: mapBank(bank, { can_edit: canEditQuestionBank(user, bank), can_contribute: canContributeToBank(user, bank) }) })
  } catch (error) {
    return databaseError(c, error, 'Could not load question bank')
  }
})

questionBanksRouter.patch('/:bankId', async c => {
  const user = c.get('user')
  const bankId = c.req.param('bankId')!
  if (!isUuid(bankId)) return invalidUuid(c, 'bank_id')
  try {
    const bank = await loadBank(bankId, user.school_id!)
    if (!bank || !canEditQuestionBank(user, bank)) {
      return c.json({ error: 'Question bank not found', code: 'NOT_FOUND' }, 404)
    }
    const body = await c.req.json()
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name || name.length > 160) return c.json({ error: 'Enter a name up to 160 characters', code: 'BAD_REQUEST' }, 400)
      updates.name = name
    }
    if (body.description !== undefined) updates.description = typeof body.description === 'string' ? body.description.trim() || null : null
    if (body.visibility !== undefined) {
      if (!BANK_VISIBILITIES.includes(body.visibility)) return c.json({ error: 'Invalid visibility', code: 'BAD_REQUEST' }, 400)
      updates.visibility = body.visibility
    }
    if (body.archived === true) updates.archived_at = new Date().toISOString()
    if (!Object.keys(updates).length) return c.json({ error: 'No supported changes provided', code: 'BAD_REQUEST' }, 400)

    const { data, error } = await supabase.from('question_banks').update(updates as TablesUpdate<'question_banks'>)
      .eq('id', bankId).eq('school_id', user.school_id).select(bankSelect).single()
    if (error) return databaseError(c, error, 'Could not update question bank')
    return c.json({ data: mapBank(data, { can_edit: !data.archived_at, can_contribute: !data.archived_at }) })
  } catch (error) {
    return databaseError(c, error, 'Could not update question bank')
  }
})

questionBanksRouter.get('/:bankId/questions', async c => {
  const user = c.get('user')
  const bankId = c.req.param('bankId')!
  if (!isUuid(bankId)) return invalidUuid(c, 'bank_id')
  const pagination = pageParams(c)
  if (!pagination) return c.json({ error: 'Invalid pagination', code: 'VALIDATION_ERROR' }, 400)

  try {
    const bank = await loadBank(bankId, user.school_id!)
    if (!bank || !canReadQuestionBank(user, bank)) return c.json({ error: 'Question bank not found', code: 'NOT_FOUND' }, 404)

    let query = supabase.from('bank_questions').select(questionSelect, { count: 'exact' })
      .eq('school_id', user.school_id).eq('bank_id', bankId).eq('status', 'active').is('archived_at', null)
    const q = c.req.query('q')?.trim()
    if (q) query = query.ilike('search_text', `%${escapeLikePattern(q)}%`)
    for (const field of ['subject_name', 'topic', 'question_type', 'course_id'] as const) {
      const value = c.req.query(field)
      if (value) query = query.eq(field, value)
    }

    const { data, error, count } = await query.order('updated_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1)
    if (error) return databaseError(c, error, 'Could not load questions')
    const questions = (await addSignedMediaUrls(data || [], user.school_id!)).map(mapQuestion)
    return c.json({
      data: questions,
      pagination: {
        page: pagination.page,
        page_size: pagination.pageSize,
        total: count || 0,
        has_more: pagination.offset + questions.length < (count || 0),
      },
    })
  } catch (error) {
    return databaseError(c, error, 'Could not load questions')
  }
})

questionBanksRouter.post('/:bankId/questions', async c => {
  const user = c.get('user')
  const bankId = c.req.param('bankId')!
  if (!isUuid(bankId)) return invalidUuid(c, 'bank_id')
  try {
    const bank = await loadBank(bankId, user.school_id!)
    const canContribute = bank && canContributeToBank(user, bank)
    if (!canContribute) return c.json({ error: 'Question bank not found', code: 'NOT_FOUND' }, 404)

    const body = await c.req.json()
    const errors = validateQuestionInput(body)
    if (errors.length) return c.json({ error: 'Check the question details', code: 'VALIDATION_ERROR', details: errors }, 400)
    const courseId = body.course_id || null
    if (!(await tutorCanUseCourse(user, courseId))) {
      return c.json({ error: 'You are not assigned to this course', code: 'NOT_ASSIGNED_TO_COURSE' }, 403)
    }

    const { data: created, error } = await supabase.rpc('create_bank_question_versioned', {
      p_school_id: user.school_id,
      p_bank_id: bankId,
      p_author_id: user.id,
      p_course_id: courseId,
      p_subject_name: body.subject_name || null,
      p_topic: body.topic || null,
      p_subtopic: body.subtopic || null,
      p_question_type: body.question_type,
      p_plain_text: body.plain_text || '',
      p_content_blocks: body.content_blocks || [],
      p_explanation_blocks: body.explanation_blocks || [],
      p_grading_rubric_blocks: body.grading_rubric_blocks || [],
      p_marks: Number(body.marks),
      p_stimulus_id: body.stimulus_id || null,
      p_options: body.options || [],
    })
    if (error) return databaseError(c, error, 'Could not create question')
    const questionId = created?.[0]?.question_id
    const { data, error: loadError } = await supabase.from('bank_questions')
      .select(questionSelect).eq('id', questionId).eq('school_id', user.school_id).single()
    if (loadError) return databaseError(c, loadError, 'Question was created but could not be reloaded')
    const [withMedia] = await addSignedMediaUrls([data], user.school_id!)
    return c.json({ data: mapQuestion(withMedia) }, 201)
  } catch (error) {
    return databaseError(c, error, 'Could not create question')
  }
})

questionBanksRouter.post('/media/confirm', async c => {
  const user = c.get('user')
  const body = await c.req.json()
  const bankId = typeof body.bank_id === 'string' ? body.bank_id : ''
  const altText = typeof body.alt_text === 'string' ? body.alt_text.trim() : ''
  const width = body.width == null ? null : Number(body.width)
  const height = body.height == null ? null : Number(body.height)
  if (!bankId || !body.file_key || !body.file_name || !body.content_type || !body.file_size_bytes || !altText) {
    return c.json({ error: 'Bank, file details, and alternative text are required', code: 'BAD_REQUEST' }, 400)
  }
  if (!isUuid(bankId)) return invalidUuid(c, 'bank_id')
  if ((width !== null && (!Number.isInteger(width) || width <= 0))
    || (height !== null && (!Number.isInteger(height) || height <= 0))) {
    return c.json({ error: 'Image dimensions must be positive integers', code: 'BAD_REQUEST' }, 400)
  }
  try {
    const bank = await loadBank(bankId, user.school_id!)
    if (!bank || !canContributeToBank(user, bank)) {
      return c.json({ error: 'Question bank not found', code: 'NOT_FOUND' }, 404)
    }
    const verified = await verifyPrivateUpload({
      fileKey: body.file_key,
      schoolId: user.school_id!,
      entityType: 'question_media',
      contextId: bankId,
      contentType: body.content_type,
      fileSizeBytes: Number(body.file_size_bytes),
    })
    const { data: existing, error: existingError } = await supabase.from('question_media')
      .select('id, original_filename, mime_type, byte_size, width, height, alt_text, processing_status')
      .eq('school_id', user.school_id).eq('storage_key', body.file_key).maybeSingle()
    if (existingError) return databaseError(c, existingError, 'Could not check question image registration')
    if (existing) return c.json({ data: existing })
    const { data, error } = await supabase.from('question_media').insert({
      school_id: user.school_id,
      owner_id: user.id,
      storage_key: body.file_key,
      original_filename: body.file_name,
      mime_type: body.content_type,
      byte_size: Number(body.file_size_bytes),
      width,
      height,
      checksum: verified.checksum,
      alt_text: altText,
      processing_status: 'ready',
    }).select('id, original_filename, mime_type, byte_size, width, height, alt_text, processing_status').single()
    if (error) return databaseError(c, error, 'Could not register question image')
    return c.json({ data }, 201)
  } catch (error) {
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status)
    return databaseError(c, error, 'Could not register question image')
  }
})

questionBanksRouter.get('/media/:mediaId/url', async c => {
  const user = c.get('user')
  const mediaId = c.req.param('mediaId')!
  if (!isUuid(mediaId)) return invalidUuid(c, 'media_id')
  const bankId = c.req.query('bank_id')
  if (!bankId) return c.json({ error: 'bank_id is required', code: 'BAD_REQUEST' }, 400)
  if (!isUuid(bankId)) return invalidUuid(c, 'bank_id')
  try {
    const bank = await loadBank(bankId, user.school_id!)
    if (!bank || !canReadQuestionBank(user, bank)) return c.json({ error: 'Image not found', code: 'NOT_FOUND' }, 404)
    const { data: media, error } = await supabase.from('question_media')
      .select('id, storage_key, alt_text, width, height, processing_status')
      .eq('id', mediaId).eq('school_id', user.school_id).maybeSingle()
    if (error) return databaseError(c, error, 'Could not load question image')
    if (!media || media.processing_status !== 'ready'
      || !media.storage_key.startsWith(`schools/${user.school_id}/private/question_media/${bankId}/`)) {
      return c.json({ error: 'Image not found', code: 'NOT_FOUND' }, 404)
    }
    return c.json({ data: {
      id: media.id,
      alt_text: media.alt_text,
      width: media.width,
      height: media.height,
      url: await createPresignedDownload(media.storage_key, user.school_id!),
      expires_in_seconds: 900,
    } })
  } catch (error) {
    if (error instanceof StorageError) return c.json({ error: error.message, code: error.code }, error.status)
    return databaseError(c, error, 'Could not load question image')
  }
})

questionBanksRouter.patch('/questions/:questionId', async c => {
  const user = c.get('user')
  const questionId = c.req.param('questionId')!
  if (!isUuid(questionId)) return invalidUuid(c, 'question_id')
  const { data: question, error: lookupError } = await supabase.from('bank_questions')
    .select('id, school_id, author_id, question_type, archived_at')
    .eq('id', questionId).eq('school_id', user.school_id).maybeSingle()
  if (lookupError) return databaseError(c, lookupError, 'Could not load question')
  if (!question || question.archived_at || (user.role !== 'admin' && question.author_id !== user.id)) {
    return c.json({ error: 'Question not found', code: 'NOT_FOUND' }, 404)
  }

  const body = await c.req.json()
  const errors = validateQuestionInput(body, question.question_type as 'mcq' | 'theory')
  if (errors.length) return c.json({ error: 'Check the question details', code: 'VALIDATION_ERROR', details: errors }, 400)
  const courseId = body.course_id || null
  try {
    if (!(await tutorCanUseCourse(user, courseId))) {
      return c.json({ error: 'You are not assigned to this course', code: 'NOT_ASSIGNED_TO_COURSE' }, 403)
    }
  } catch (assignmentError) {
    return databaseError(c, assignmentError, 'Could not verify your course assignment')
  }

  const { data: revised, error } = await supabase.rpc('revise_bank_question_versioned', {
    p_school_id: user.school_id,
    p_question_id: questionId,
    p_editor_id: user.id,
    p_course_id: courseId,
    p_subject_name: body.subject_name || null,
    p_topic: body.topic || null,
    p_subtopic: body.subtopic || null,
    p_plain_text: body.plain_text || '',
    p_content_blocks: body.content_blocks || [],
    p_explanation_blocks: body.explanation_blocks || [],
    p_grading_rubric_blocks: body.grading_rubric_blocks || [],
    p_marks: Number(body.marks),
    p_stimulus_id: body.stimulus_id || null,
    p_options: body.options || [],
  })
  if (error) return databaseError(c, error, 'Could not revise question')
  return c.json({ data: revised?.[0] })
})

questionBanksRouter.get('/questions/:questionId/versions', async c => {
  const user = c.get('user')
  const questionId = c.req.param('questionId')!
  if (!isUuid(questionId)) return invalidUuid(c, 'question_id')
  const { data: question, error: questionLookupError } = await supabase.from('bank_questions')
    .select('id, bank_id, school_id').eq('id', questionId).eq('school_id', user.school_id).maybeSingle()
  // A failed lookup is not "not found" (DEV-QBK-008).
  if (questionLookupError) return databaseError(c, questionLookupError, 'Could not load question history')
  if (!question) return c.json({ error: 'Question not found', code: 'NOT_FOUND' }, 404)
  try {
    const bank = await loadBank(question.bank_id, user.school_id!)
    if (!bank || !canReadQuestionBank(user, bank)) return c.json({ error: 'Question not found', code: 'NOT_FOUND' }, 404)
    const { data, error } = await supabase.from('bank_question_versions')
      .select(`id, version_number, created_at, created_by, stimulus_id, plain_text,
        content_blocks, explanation_blocks, grading_rubric_blocks, marks,
        options:bank_question_option_versions(id, plain_text, content_blocks, is_correct, order_index)`)
      .eq('question_id', questionId).eq('school_id', user.school_id)
      .order('version_number', { ascending: false })
    if (error) return databaseError(c, error, 'Could not load question history')
    return c.json({ data: (data || []).map(mapQuestionVersion) })
  } catch (error) {
    return databaseError(c, error, 'Could not load question history')
  }
})
