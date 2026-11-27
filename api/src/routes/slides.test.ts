import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  enqueueDeletion: vi.fn(),
  uploadPrivate: vi.fn(),
  deletePrivate: vi.fn(),
  createDownload: vi.fn(),
  createUpload: vi.fn(),
  verifyUpload: vi.fn(),
  loadCourseIds: vi.fn(),
  readPageCount: vi.fn(),
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../jobs/storage-cleanup', () => ({ enqueueObjectDeletion: mocks.enqueueDeletion }))
vi.mock('../lib/student-course-access', () => ({ loadStudentCourseIds: mocks.loadCourseIds }))
vi.mock('../slides/pdf-metadata', () => ({ readPdfPageCount: mocks.readPageCount }))
vi.mock('../storage/r2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return {
    ...actual,
    uploadPrivateObject: mocks.uploadPrivate,
    deletePrivateObject: mocks.deletePrivate,
    createPresignedDownload: mocks.createDownload,
    createPresignedUpload: mocks.createUpload,
    verifyPrivateUpload: mocks.verifyUpload,
  }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { const u = c.get('user'); c.set('account', { id: u.school_id, membershipId: 'membership-1', role: u.role === 'student' ? 'learner' : u.role }); await next() },
}))

import { slidesRouter } from './slides'

function builder(result: any) {
  const value: any = {
    select: () => value, insert: () => value, update: () => value, delete: () => value,
    eq: () => value, order: () => value, limit: () => value, range: () => value,
    maybeSingle: async () => result, single: async () => result,
    then: (resolve: (value: any) => unknown) => Promise.resolve(result).then(resolve),
  }
  return value
}

function queue(...results: any[]) {
  const pending = [...results]
  mocks.from.mockImplementation(() => builder(pending.shift() ?? { data: null, error: null }))
}

function liveClass(overrides: Record<string, unknown> = {}) {
  return { id: 'class-1', school_id: 'school-1', course_id: 'course-1', tutor_id: 'tutor-1', status: 'live', teaching_mode: 'whiteboard', slides_urls: null, ...overrides }
}

function material(overrides: Record<string, unknown> = {}) {
  return {
    id: 'material-1', live_class_id: 'class-1', file_key: 'schools/school-1/private/live_class_presentation/class-1/material-1.pdf',
    filename: 'Lesson.pdf', file_size_bytes: 800, page_count: 1, processing_status: 'ready', processing_error: null, sort_order: 0, current_page: 1,
    is_active: true, annotations: {}, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function onePagePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length 44 >>\nstream\nBT /F1 24 Tf 72 720 Td (Test slide) Tj ET\nendstream',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

describe('private classroom presentations API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'tutor' }
    mocks.loadCourseIds.mockResolvedValue(['course-1'])
    mocks.uploadPrivate.mockResolvedValue({ fileKey: 'private.pdf' })
    mocks.deletePrivate.mockResolvedValue(undefined)
    mocks.readPageCount.mockResolvedValue(1)
    mocks.createUpload.mockResolvedValue({ presignedUrl: 'https://r2.example/upload', fileKey: 'schools/school-1/private/live_class_presentation/class-1/new.pdf', expiresInSeconds: 900 })
    mocks.verifyUpload.mockResolvedValue({ checksum: 'checksum' })
  })

  it('creates a private direct-upload slot without sending the PDF through the API', async () => {
    queue(
      { data: liveClass(), error: null },
      { data: null, error: null },
      { data: material({ is_active: false }), error: null },
    )
    const response = await slidesRouter.request('/class-1/presentations/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file_name: 'Lesson.pdf', content_type: 'application/pdf', file_size_bytes: 800 }) })
    const responseBody = await response.clone().json()
    expect(response.status, JSON.stringify(responseBody)).toBe(201)
    expect(mocks.createUpload).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-1', entityType: 'live_class_presentation', contextId: 'class-1' }))
    expect(responseBody.data.upload_url).toBe('https://r2.example/upload')
    expect(mocks.uploadPrivate).not.toHaveBeenCalled()
  })

  it('prevents administrators who are not assigned to the class from mutating materials', async () => {
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
    queue({ data: liveClass(), error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/activate', { method: 'POST' })
    expect(response.status).toBe(403)
    expect(mocks.uploadPrivate).not.toHaveBeenCalled()
  })

  it('allows an administrator who is the class tutor to manage materials', async () => {
    mocks.user = { id: 'tutor-1', school_id: 'school-1', role: 'admin' }
    queue(
      { data: liveClass(), error: null },
      { data: material(), error: null },
    )
    mocks.rpc.mockResolvedValue({ data: { status: 'ok', presentation: material() }, error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/activate', { method: 'POST' })
    expect(response.status).toBe(200)
  })

  it('returns multiple materials and durable active page annotations for recovery', async () => {
    const rows = [
      material({ id: 'a', filename: 'Algebra.pdf', current_page: 3, page_count: 5, annotations: { '3': [{ id: 's1', points: [{ x: .1, y: .2 }] }] } }),
      material({ id: 'b', filename: 'Geometry.pdf', is_active: false, sort_order: 1 }),
    ]
    queue({ data: liveClass({ teaching_mode: 'presentation' }), error: null }, { data: rows, error: null }, { data: { annotations: rows[0].annotations }, error: null })
    const response = await slidesRouter.request('/class-1/presentations')
    const body = await response.json() as any
    expect(response.status).toBe(200)
    expect(body.data.presentations).toHaveLength(2)
    expect(body.data.tutor_identity).toBe('tutor-1')
    expect(body.data.presentations[0]).toMatchObject({ current_page: 3, annotations: { '3': expect.any(Array) } })
    expect(body.data.presentations[1].annotations).toEqual({})
    expect(body.data.legacy_slide_urls).toEqual([])
  })

  it('only signs a private viewing URL after student enrolment is verified', async () => {
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
    mocks.createDownload.mockResolvedValue('https://private.example/signed')
    queue({ data: liveClass(), error: null }, { data: material(), error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/view')
    expect(response.status).toBe(200)
    expect(mocks.createDownload).toHaveBeenCalledWith(expect.stringContaining('/private/'), 'school-1', 600)

    vi.clearAllMocks()
    mocks.user = { id: 'student-2', school_id: 'school-1', role: 'student' }
    mocks.loadCourseIds.mockResolvedValue([])
    queue({ data: liveClass(), error: null })
    const forbidden = await slidesRouter.request('/class-1/presentations/material-1/view')
    expect(forbidden.status).toBe(403)
    expect((await forbidden.clone().json() as any).code).toBe('NOT_ENROLLED')
    expect(mocks.createDownload).not.toHaveBeenCalled()
  })

  it('signs a rendered page image instead of exposing the PDF to the classroom viewer', async () => {
    mocks.createDownload.mockResolvedValue('https://private.example/page-1.jpg')
    queue(
      { data: liveClass(), error: null },
      { data: material({ page_count: 2, page_image_keys: { '1': 'schools/school-1/private/live_class_presentation/class-1/material-1-page-1.jpg' } }), error: null },
    )
    const response = await slidesRouter.request('/class-1/presentations/material-1/pages/1/view')
    expect(response.status).toBe(200)
    expect((await response.json() as any).data.url).toBe('https://private.example/page-1.jpg')
    expect(mocks.createDownload).toHaveBeenCalledWith(expect.stringContaining('page-1.jpg'), 'school-1', 3600, {
      responseCacheControl: 'private, max-age=3300, immutable',
    })
  })

  it('replaces the private object while preserving the material identity', async () => {
    queue(
      { data: liveClass(), error: null },
      { data: material(), error: null },
      { data: material({ filename: 'Replacement.pdf', current_page: 1, annotations: {} }), error: null },
    )
    const form = new FormData()
    form.append('file', new File([onePagePdf()], 'Replacement.pdf', { type: 'application/pdf' }))
    const response = await slidesRouter.request('/class-1/presentations/material-1/replace', { method: 'POST', body: form })
    expect(response.status).toBe(200)
    expect(mocks.uploadPrivate).toHaveBeenCalledOnce()
    expect(mocks.deletePrivate).toHaveBeenCalledWith(expect.stringContaining('material-1.pdf'), 'school-1')
    expect((await response.json() as any).data.id).toBe('material-1')
  })

  it('rejects page navigation outside the PDF', async () => {
    queue({ data: liveClass(), error: null }, { data: material({ page_count: 4 }), error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/page', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page: 5 }),
    })
    expect(response.status).toBe(400)
    expect((await response.json() as any).code).toBe('INVALID_PAGE')
  })

  it('rejects annotations that are not page-relative coordinates', async () => {
    queue({ data: liveClass(), error: null }, { data: material(), error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/annotations', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: 1, annotations: [{ id: 'stroke', color: '#000', width: .01, points: [{ x: -1, y: 2 }, { x: .5, y: .5 }] }] }),
    })
    expect(response.status).toBe(400)
    expect((await response.json() as any).code).toBe('INVALID_ANNOTATIONS')
  })
  it('omits raw processing errors and inactive annotations from the list', async () => {
    const rows = [
      material({ id: 'a', is_active: false, processing_status: 'failed', processing_error: 'R2 bucket secret-bucket timeout', annotations: { '1': [{ id: 'x' }] } }),
    ]
    queue({ data: liveClass(), error: null }, { data: rows, error: null })
    const response = await slidesRouter.request('/class-1/presentations')
    const text = await response.text()
    const body = JSON.parse(text)
    expect(response.status).toBe(200)
    expect(text).not.toContain('secret-bucket')
    expect(body.data.presentations[0]).toMatchObject({ processing_error_code: 'PROCESSING_FAILED', annotations: {} })
    expect(body.data.pagination).toEqual({ page: 1, page_size: 100, has_more: false })
  })

  it('rejects out-of-range pagination on the list', async () => {
    queue({ data: liveClass(), error: null })
    const response = await slidesRouter.request('/class-1/presentations?page_size=1000')
    expect(response.status).toBe(400)
  })

  it('returns 503, not 404, when the material lookup fails', async () => {
    queue({ data: liveClass(), error: null }, { data: null, error: { message: 'db down' } })
    const response = await slidesRouter.request('/class-1/presentations/material-1/activate', { method: 'POST' })
    expect(response.status).toBe(503)
    expect((await response.json() as any).code).toBe('SERVICE_UNAVAILABLE')
  })

  it('maps activation RPC failures to 503 and a missing material to 404', async () => {
    queue({ data: liveClass(), error: null }, { data: material(), error: null })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect((await slidesRouter.request('/class-1/presentations/material-1/activate', { method: 'POST' })).status).toBe(503)
    queue({ data: liveClass(), error: null }, { data: material(), error: null })
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'not_found' }, error: null })
    expect((await slidesRouter.request('/class-1/presentations/material-1/activate', { method: 'POST' })).status).toBe(404)
  })

  it('maps an invalid annotation payload rejected by the database function to 400', async () => {
    queue({ data: liveClass(), error: null }, { data: material(), error: null })
    mocks.rpc.mockResolvedValue({ data: { status: 'invalid' }, error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/annotations', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: 1, annotations: [] }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_ANNOTATIONS' })
  })

  it('returns 409 with the current revision when annotations are stale', async () => {
    queue({ data: liveClass(), error: null }, { data: material(), error: null })
    mocks.rpc.mockResolvedValue({ data: { status: 'revision_conflict', revision: 4 }, error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/annotations', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: 1, annotations: [], revision: 2 }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'REVISION_CONFLICT', revision: 4 })
    expect(mocks.rpc).toHaveBeenCalledWith('save_presentation_annotations', expect.objectContaining({ p_expected_revision: 2, p_page: 1 }))
  })

  it('saves annotations through the revisioned RPC', async () => {
    queue({ data: liveClass(), error: null }, { data: material(), error: null })
    mocks.rpc.mockResolvedValue({ data: { status: 'ok', presentation: material({ annotations_revision: 3 }) }, error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/annotations', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: 1, annotations: [], revision: 2 }),
    })
    expect(response.status).toBe(200)
    expect((await response.json() as any).data.annotations_revision).toBe(3)
  })

  it('reorders through the RPC and maps a mismatch to 409', async () => {
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
    queue({ data: liveClass(), error: null })
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'ok' }, error: null })
    const ok = await slidesRouter.request('/class-1/presentations/reorder', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ordered_ids: ids }) })
    expect(ok.status).toBe(200)
    queue({ data: liveClass(), error: null })
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'order_mismatch' }, error: null })
    const bad = await slidesRouter.request('/class-1/presentations/reorder', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ordered_ids: ids }) })
    expect(bad.status).toBe(409)
    queue({ data: liveClass(), error: null })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const down = await slidesRouter.request('/class-1/presentations/reorder', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ordered_ids: ids }) })
    expect(down.status).toBe(503)
  })

  it('deletes the row first and queues object cleanup durably', async () => {
    queue({ data: liveClass(), error: null }, { data: material({ is_active: false, page_image_keys: { '1': 'page-1.png' } }), error: null }, { data: null, error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1', { method: 'DELETE' })
    expect(response.status).toBe(204)
    expect(mocks.deletePrivate).not.toHaveBeenCalled()
    expect(mocks.enqueueDeletion).toHaveBeenCalledWith(expect.stringContaining('material-1.pdf'), 'school-1')
    expect(mocks.enqueueDeletion).toHaveBeenCalledWith('page-1.png', 'school-1')
  })

  it('keeps the object when the row delete fails', async () => {
    queue({ data: liveClass(), error: null }, { data: material(), error: null }, { data: null, error: { message: 'x' } })
    const response = await slidesRouter.request('/class-1/presentations/material-1', { method: 'DELETE' })
    expect(response.status).toBe(500)
    expect(mocks.enqueueDeletion).not.toHaveBeenCalled()
  })
})
