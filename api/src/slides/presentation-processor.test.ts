import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: vi.fn() } }))
vi.mock('../storage/r2', () => ({ buildPrivateFileKey: vi.fn(), deletePrivateObject: vi.fn(), readPrivateObject: vi.fn(), uploadPrivateObject: vi.fn() }))
vi.mock('../workers/pdf-converter', () => ({ convertPdfToImages: vi.fn() }))

import { enqueuePresentationProcessing, PRESENTATION_JOB_TYPE, requeueStalledPresentations, runPresentationJobs } from './presentation-processor'
import type { DurableJobStore } from '../jobs/durable-jobs'

function store(overrides: Partial<DurableJobStore> = {}): DurableJobStore {
  return {
    enqueue: vi.fn(async () => 'job'), claim: vi.fn(async () => []),
    complete: vi.fn(async () => true), fail: vi.fn(async () => true), ...overrides,
  }
}

describe('durable presentation processing', () => {
  it('records a durable job keyed by presentation instead of an in-memory timer', async () => {
    const s = store()
    await enqueuePresentationProcessing('p1', s)
    expect(s.enqueue).toHaveBeenCalledWith({ jobType: PRESENTATION_JOB_TYPE, dedupeKey: 'presentation:p1', payload: { presentationId: 'p1' } })
  })

  it('does not throw when the job cannot be recorded; the recovery sweep handles it', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(enqueuePresentationProcessing('p1', store({ enqueue: async () => { throw new Error('db down') } }))).resolves.toBeUndefined()
    spy.mockRestore()
  })

  it('re-enqueues presentations left in processing after a restart', async () => {
    const lt = vi.fn(() => ({ limit: async () => ({ data: [{ id: 'p1' }, { id: 'p2' }], error: null }) }))
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ lt }) }) })
    const s = store()
    const now = new Date('2026-11-26T12:00:00Z')
    expect(await requeueStalledPresentations(now, s)).toBe(2)
    expect(lt).toHaveBeenCalledWith('processing_started_at', '2026-11-26T11:58:00.000Z')
    expect(s.enqueue).toHaveBeenCalledTimes(2)
  })

  it('claims pending presentation jobs when the worker starts', async () => {
    const s = store({ claim: vi.fn(async () => []) })
    await runPresentationJobs(s)
    expect(s.claim).toHaveBeenCalledWith([PRESENTATION_JOB_TYPE], expect.any(String), 2, 600)
  })
})
