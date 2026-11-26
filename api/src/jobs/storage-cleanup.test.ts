import { describe, expect, it, vi } from 'vitest'

const deletePrivateObject = vi.hoisted(() => vi.fn())
vi.mock('../storage/r2', () => ({ deletePrivateObject }))

import { DELETE_OBJECT_JOB, enqueueObjectDeletion, storageCleanupHandlers } from './storage-cleanup'

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
})
