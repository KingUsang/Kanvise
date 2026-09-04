import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  uploadPrivate: vi.fn(),
  deletePrivate: vi.fn(),
  createDownload: vi.fn(),
  createUpload: vi.fn(),
  verifyUpload: vi.fn(),
  loadCourseIds: vi.fn(),
  readPageCount: vi.fn(),
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
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
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
}))

import { slidesRouter } from './slides'

function builder(result: any) {
  const value: any = {
    select: () => value, insert: () => value, update: () => value, delete: () => value,
    eq: () => value, order: () => value, limit: () => value,
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

  it('prevents admins and unassigned tutors from mutating tutor materials', async () => {
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
    queue({ data: liveClass(), error: null })
    const response = await slidesRouter.request('/class-1/presentations/material-1/activate', { method: 'POST' })
    expect(response.status).toBe(403)
    expect(mocks.uploadPrivate).not.toHaveBeenCalled()
  })

  it('returns multiple materials and durable active page annotations for recovery', async () => {
    const rows = [
      material({ id: 'a', filename: 'Algebra.pdf', current_page: 3, page_count: 5, annotations: { '3': [{ id: 's1', points: [{ x: .1, y: .2 }] }] } }),
      material({ id: 'b', filename: 'Geometry.pdf', is_active: false, sort_order: 1 }),
    ]
    queue({ data: liveClass({ teaching_mode: 'presentation' }), error: null }, { data: rows, error: null })
    const response = await slidesRouter.request('/class-1/presentations')
    const body = await response.json() as any
    expect(response.status).toBe(200)
    expect(body.data.presentations).toHaveLength(2)
    expect(body.data.tutor_identity).toBe('tutor-1')
    expect(body.data.presentations[0]).toMatchObject({ current_page: 3, annotations: { '3': expect.any(Array) } })
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
    expect(forbidden.status).toBe(404)
    expect(mocks.createDownload).not.toHaveBeenCalled()
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
})
