import { describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const insert = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc, from: () => ({ insert }) } }))

import { consumeUploadIntent, recordUploadIntent, releaseUploadIntent } from './upload-intents'

const id = { schoolId: 's1', requesterId: 'u1', fileKey: 'schools/s1/private/note/c/a.pdf' }

describe('upload intents', () => {
  it('records the intent with an expiry and fails closed when the store is down', async () => {
    insert.mockResolvedValueOnce({ error: null })
    await recordUploadIntent({ ...id, scope: 'private', entityType: 'note', contextId: 'c', contentType: 'application/pdf', fileSizeBytes: 10 })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ file_key: id.fileKey, requester_id: 'u1', scope: 'private' }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    insert.mockResolvedValueOnce({ error: { message: 'down' } })
    await expect(recordUploadIntent({ ...id, scope: 'private', entityType: 'note', contextId: 'c', contentType: 'x', fileSizeBytes: 1 }))
      .rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 })
  })

  it('is single use: the second consume of the same key is rejected', async () => {
    const results = ['consumed', 'already_consumed']
    rpc.mockImplementation(async () => ({ data: results.shift(), error: null }))
    await expect(consumeUploadIntent(id)).resolves.toBe('consumed')
    await expect(consumeUploadIntent(id)).rejects.toMatchObject({ code: 'UPLOAD_INTENT_USED', status: 409 })
    expect(rpc).toHaveBeenCalledWith('consume_upload_intent', { p_school_id: 's1', p_requester_id: 'u1', p_file_key: id.fileKey })
  })

  it('accepts legacy keys, rejects expired and foreign intents', async () => {
    rpc.mockResolvedValueOnce({ data: 'legacy', error: null })
    await expect(consumeUploadIntent(id)).resolves.toBe('legacy')
    rpc.mockResolvedValueOnce({ data: 'expired', error: null })
    await expect(consumeUploadIntent(id)).rejects.toMatchObject({ code: 'UPLOAD_INTENT_EXPIRED' })
    rpc.mockResolvedValueOnce({ data: 'forbidden', error: null })
    await expect(consumeUploadIntent(id)).rejects.toMatchObject({ code: 'UPLOAD_INTENT_FORBIDDEN', status: 403 })
  })

  it('release never throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    await expect(releaseUploadIntent(id)).resolves.toBeUndefined()
  })
})
