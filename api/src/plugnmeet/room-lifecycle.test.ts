import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), isRoomActive: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('./client', () => ({ plugNmeet: { isRoomActive: mocks.isRoomActive } }))

import { reconcileInactivePlugNmeetClasses } from './room-lifecycle'

function selection(result: unknown) {
  const value: any = {
    select: () => value, eq: () => value, in: () => value, order: () => value,
    limit: () => value, then: (resolve: (data: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  return value
}

function updateSink(writes: Array<Record<string, unknown>>) {
  const value: any = {
    update: (payload: Record<string, unknown>) => { writes.push(payload); return value },
    eq: () => value, in: () => value, then: (resolve: (data: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }
  return value
}

describe('PlugNmeet room lifecycle reconciliation', () => {
  const now = new Date('2026-10-09T12:00:00.000Z')
  let writes: Array<Record<string, unknown>>

  beforeEach(() => {
    writes = []
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ data: 2, error: null })
    mocks.from.mockImplementation(() => updateSink(writes))
  })

  it('keeps a provider-created empty room ready instead of falsely making it live', async () => {
    mocks.from.mockImplementationOnce(() => selection({
      data: [{ id: 'class-1', provider_room_id: 'room-1', status: 'ready', scheduled_at: now.toISOString(), duration_minutes: 60 }], error: null,
    }))
    mocks.isRoomActive.mockResolvedValue(true)

    await reconcileInactivePlugNmeetClasses(now)

    expect(writes).toContainEqual(expect.objectContaining({ provider_room_status: 'ready' }))
    expect(writes.some((payload) => payload.status === 'live')).toBe(false)
  })

  it('prepares a new provider generation when a live room disappears mid-class', async () => {
    mocks.from.mockImplementationOnce(() => selection({
      data: [{ id: 'class-1', provider_room_id: 'room-1', status: 'live', scheduled_at: now.toISOString(), duration_minutes: 60 }], error: null,
    }))
    mocks.isRoomActive.mockResolvedValue(false)

    await reconcileInactivePlugNmeetClasses(now)

    expect(mocks.rpc).toHaveBeenCalledWith('prepare_live_class_provider_recovery', {
      p_live_class_id: 'class-1', p_provider_room_id: 'room-1',
    })
    expect(writes.some((payload) => payload.status === 'completed')).toBe(false)
  })

  it('marks an old unverified class interrupted rather than leaving it live forever', async () => {
    mocks.from.mockImplementationOnce(() => selection({
      data: [{ id: 'class-1', provider_room_id: 'room-1', status: 'live', scheduled_at: '2026-10-01T12:00:00.000Z', duration_minutes: 60 }], error: null,
    }))
    mocks.isRoomActive.mockRejectedValue(new Error('provider unavailable'))

    await reconcileInactivePlugNmeetClasses(now)

    expect(writes).toContainEqual(expect.objectContaining({ status: 'interrupted', provider_room_status: 'unavailable' }))
  })
})
