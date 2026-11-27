import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  windows: [] as any[],
  plan: { out_command_id: 'cmd-1', out_version: 1, out_send: true, out_capacity_alert: false } as any,
  rpc: vi.fn(),
  upsert: vi.fn(async () => ({ error: null })),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: db.rpc,
    from: (table: string) => table === 'live_classes'
      ? { select: () => ({ eq: () => ({ or: async () => ({ data: db.windows, error: null }) }) }) }
      : { upsert: db.upsert },
  },
}))

import { reconcileRecorderFleet, signFresh } from './recorder-fleet'

const SECRET = 'fleet-secret'
const now = new Date('2026-11-25T10:00:00Z')

describe('recorder fleet reconciliation', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state_before: 'running' }) })
    process.env.RECORDER_FLEET_ENABLED = 'true'
    process.env.RECORDER_FLEET_CONTROLLER_URL = 'https://controller.example'
    process.env.RECORDER_FLEET_CONTROLLER_SECRET = SECRET
    delete process.env.RECORDER_FLEET_SEND_LEGACY_SIGNATURE
    db.windows = [{ id: 'c1' }]
    db.plan = { out_command_id: 'cmd-1', out_version: 1, out_send: true, out_capacity_alert: false }
    db.rpc.mockImplementation(async (name: string) => name === 'plan_recorder_command' ? { data: [db.plan], error: null } : { data: true, error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends no command when the persisted desired state is unchanged and acknowledged', async () => {
    db.plan = { ...db.plan, out_send: false }
    const result = await reconcileRecorderFleet(now)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ commandSent: false, desiredCapacity: 1 })
    expect(db.rpc).not.toHaveBeenCalledWith('acknowledge_recorder_command', expect.anything())
  })

  it('sends a versioned command with a fresh signature and acknowledges it afterwards', async () => {
    await reconcileRecorderFleet(now)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ action: 'set_capacity', desired_capacity: 1, command_id: 'cmd-1', version: 1 })
    const h = init.headers
    expect(h['X-Kanvise-Recorder-Fleet-Timestamp']).toBe(String(now.getTime() / 1000))
    expect(h['X-Kanvise-Recorder-Fleet-Signature-V2']).toBe(signFresh(init.body, h['X-Kanvise-Recorder-Fleet-Timestamp'], h['X-Kanvise-Recorder-Fleet-Nonce'], SECRET))
    expect(h['X-Kanvise-Recorder-Fleet-Signature']).toBeTruthy()
    expect(db.rpc).toHaveBeenLastCalledWith('acknowledge_recorder_command', { p_command_id: 'cmd-1', p_version: 1 })
  })

  it('uses a different nonce for every request and can drop the legacy signature', async () => {
    process.env.RECORDER_FLEET_SEND_LEGACY_SIGNATURE = 'false'
    await reconcileRecorderFleet(now)
    await reconcileRecorderFleet(now)
    const [a, b] = fetchMock.mock.calls.map(call => call[1].headers)
    expect(a['X-Kanvise-Recorder-Fleet-Nonce']).not.toBe(b['X-Kanvise-Recorder-Fleet-Nonce'])
    expect(a['X-Kanvise-Recorder-Fleet-Signature']).toBeUndefined()
  })

  it('does not acknowledge a command the controller rejected', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    await expect(reconcileRecorderFleet(now)).rejects.toThrow('401')
    expect(db.rpc).not.toHaveBeenCalledWith('acknowledge_recorder_command', expect.anything())
  })

  it('persists demand, reports capacity exceeded once and forces a command on request', async () => {
    db.windows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    db.plan = { ...db.plan, out_capacity_alert: true }
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = await reconcileRecorderFleet(now, { force: true })
    expect(db.rpc).toHaveBeenCalledWith('plan_recorder_command', expect.objectContaining({ p_demand: 3, p_capture_slots: 2, p_force: true }))
    expect(error).toHaveBeenCalledWith('recorder_fleet.capacity_exceeded', expect.objectContaining({ demand: 3 }))
    expect(result.capacityWarning).toContain('another recorder instance')
  })
})
