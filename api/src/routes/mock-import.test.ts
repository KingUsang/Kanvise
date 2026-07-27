import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  importQuestionsFromDocumentText: vi.fn(),
  importQuestionsFromPdf: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'tutor-1', school_id: 'school-1', role: 'tutor' })
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))
vi.mock('../domain/mock-pdf-import', () => ({
  MAX_MOCK_PDF_SIZE_BYTES: 15 * 1024 * 1024,
  importQuestionsFromDocumentText: mocks.importQuestionsFromDocumentText,
  importQuestionsFromPdf: mocks.importQuestionsFromPdf,
}))

import { mocksRouter } from './mocks'

describe('AI mock document import route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the editable AI draft from a DOCX text upload', async () => {
    mocks.importQuestionsFromDocumentText.mockResolvedValue({
      page_count: 2,
      warnings: ['Confirm the answer key before publishing.'],
      questions: [{
        id: 'docx_1',
        question_type: 'mcq',
        question_text: 'What is 2 + 2?',
        marks: 1,
        options: [
          { id: 'a', option_text: '3', is_correct: false },
          { id: 'b', option_text: '4', is_correct: true },
        ],
        content_blocks: [],
        review_reasons: [],
      }],
    })

    const response = await mocksRouter.request('/import/document-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document_text: '1. What is 2 + 2?', file_name: 'maths.docx' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.importQuestionsFromDocumentText).toHaveBeenCalledWith('1. What is 2 + 2?', 'maths.docx')
    expect(await response.json()).toMatchObject({
      data: {
        page_count: 2,
        questions: [{ question_text: 'What is 2 + 2?' }],
      },
    })
  })

  it('rejects an upload when the AI cannot recognise any questions', async () => {
    mocks.importQuestionsFromDocumentText.mockResolvedValue({ page_count: 1, warnings: ['No questions found'], questions: [] })

    const response = await mocksRouter.request('/import/document-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document_text: 'Cover page only' }),
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'NO_QUESTIONS_FOUND' })
  })
})
