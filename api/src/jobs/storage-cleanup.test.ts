import { describe, expect, it, vi } from 'vitest'

const deletePrivateObject = vi.hoisted(() => vi.fn())
const deleteStoredObject = vi.hoisted(() => vi.fn())
vi.mock('../storage/r2', () => ({ deletePrivateObject, deleteStoredObject }))
vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { DELETE_OBJECT_JOB, DELETE_PUBLIC_OBJECT_JOB, enqueueObjectDeletion, enqueuePublicObjectDeletion, runUploadOrphanSweep, storageCleanupHandlers } from './storage-cleanup'

describe('storage cleanup jobs', () => {
  it('queues one deduplicated deletion job per object', async () => {
    const store = { enqueue: vi.fn(async () => 'job-1') } as any
    await enqueueObjectDeletion('schools/s1/note/a.pdf', 's1', store)
    expect(store.enqueue).toHaveBeenCalledWith({ jobType: DELETE_OBJECT_JOB, dedupeKey: `${DELETE_OBJECT_JOB}:schools/s1/note/a.pdf`, payload: { fileKey: 'schools/s1/note/a.pdf', schoolId: 's1' } })
  })

  it('ignores a missing key and never throws when the queue fails', async () => {
    const store = { enqueue: vi.fn(async () => { throw new Error('down') }) } as any
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await enqueueObjectDeletion(null, 's1', store)
    expect(store.enqueue).not.toHaveBeenCalled()
    await expect(enqueueObjectDeletion('k', 's1', store)).resolves.toBeUndefined()
  })

  it('deletes the object through the tenant-checked helper', async () => {
    await storageCleanupHandlers[DELETE_OBJECT_JOB]({ id: 'j', job_type: DELETE_OBJECT_JOB, payload: { fileKey: 'k', schoolId: 's1' }, attempts: 1, max_attempts: 5 })
    expect(deletePrivateObject).toHaveBeenCalledWith('k', 's1')
  })

  it('queues and runs a public object deletion job', async () => {
    const store = { enqueue: vi.fn(async () => 'job-2') } as any
    await enqueuePublicObjectDeletion('schools/s1/public/logo/s1/old.png', 's1', store)
    expect(store.enqueue).toHaveBeenCalledWith(expect.objectContaining({ jobType: DELETE_PUBLIC_OBJECT_JOB, payload: { fileKey: 'schools/s1/public/logo/s1/old.png', schoolId: 's1' } }))
    await storageCleanupHandlers[DELETE_PUBLIC_OBJECT_JOB]({ id: 'j', job_type: DELETE_PUBLIC_OBJECT_JOB, payload: { fileKey: 'k', schoolId: 's1' }, attempts: 1, max_attempts: 5 })
    expect(deleteStoredObject).toHaveBeenCalledWith('k')
  })

  it('sweeps expired upload intents and unattached question media', async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === 'sweep_upload_intents' ? 3 : 2, error: null }))
    await expect(runUploadOrphanSweep({ rpc } as any)).resolves.toEqual({ expiredIntents: 3, orphanQuestionMedia: 2 })
    expect(rpc).toHaveBeenCalledWith('sweep_upload_intents', { p_limit: 200 })
    expect(rpc).toHaveBeenCalledWith('sweep_orphan_question_media', { p_limit: 100 })
  })

  it('surfaces a sweep failure so the scheduler records it', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: new Error('db down') }))
    await expect(runUploadOrphanSweep({ rpc } as any)).rejects.toThrow('db down')
  })
})
