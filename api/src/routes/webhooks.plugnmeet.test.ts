import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../plugnmeet/client', () => ({ verifyPlugNmeetWebhook: () => true }))
vi.mock('../storage/r2', () => ({ createPresignedUpload: vi.fn(), verifyPrivateUpload: vi.fn() }))
vi.mock('./supabase-email-hook', () => ({ handleSupabaseEmailHook: vi.fn() }))

import { webhooksRouter } from './webhooks'

type Call = { table: string; op: string; payload?: any }

// Minimal chainable query fake. `respond` decides each awaited result.
function install(respond: (call: Call) => { data?: any; error?: any }) {
  const calls: Call[] = []
  mocks.from.mockImplementation((table: string) => {
    let call: Call = { table, op: 'select' }
    const builder: any = new Proxy({}, {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: any, reject: any) => {
            calls.push(call)
            return Promise.resolve({ data: null, error: null, ...respond(call) }).then(resolve, reject)
          }
        }
        return (...args: any[]) => {
          if (['insert', 'update', 'upsert'].includes(prop)) call = { ...call, op: prop, payload: args[0] }
          return builder
        }
      },
    })
    return builder
  })
  return calls
}

const event = (name: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id: 'evt-1', event: name, room: { room_id: 'room-1' }, ...extra })
const post = (body: string) => webhooksRouter.request('/plugnmeet', { method: 'POST', body, headers: { 'Content-Type': 'application/json', Authorization: 'jwt' } })
const liveClass = { id: 'class-1', school_id: 's1', status: 'live', course_id: 'c1', tutor_id: 't1', classroom_provider: 'plugnmeet', provider_room_id: 'room-1' }

describe('PlugNmeet webhook inbox', () => {
  beforeEach(() => { mocks.from.mockReset(); mocks.rpc.mockReset() })

  it('does not mark the inbox row processed when a state write fails', async () => {
    const calls = install((call) => {
      if (call.table === 'plugnmeet_webhook_inbox' && call.op === 'upsert') return { data: { id: 'i1', processed_at: null, attempts: 0 } }
      if (call.table === 'live_classes' && call.op === 'select') return { data: liveClass }
      if (call.table === 'enrolments') return { data: { student_id: 'u1' } }
      if (call.table === 'live_classes' && call.op === 'update') return {}
      if (call.table === 'attendance_records' && call.op === 'insert') return { error: { message: 'insert failed' } }
      return {}
    })
    const response = await post(event('participant_joined', { participant: { user_id: 'u1' } }))
    expect(response.status).toBe(500)
    const inboxUpdates = calls.filter((call) => call.table === 'plugnmeet_webhook_inbox' && call.op === 'update')
    expect(inboxUpdates).toHaveLength(1)
    expect(inboxUpdates[0].payload.processed_at).toBeUndefined()
    expect(inboxUpdates[0].payload.last_error).toBe('insert failed')
  })

  it('marks the inbox row processed after every write succeeds', async () => {
    const calls = install((call) => {
      if (call.table === 'plugnmeet_webhook_inbox' && call.op === 'upsert') return { data: { id: 'i1', processed_at: null, attempts: 0 } }
      if (call.table === 'live_classes' && call.op === 'select') return { data: liveClass }
      if (call.table === 'enrolments') return { data: { student_id: 'u1' } }
      return {}
    })
    const response = await post(event('participant_joined', { participant: { user_id: 'u1' } }))
    expect(response.status).toBe(200)
    expect(calls.filter((call) => call.table === 'attendance_records' && call.op === 'insert')).toHaveLength(1)
    const done = calls.filter((call) => call.table === 'plugnmeet_webhook_inbox' && call.op === 'update')
    expect(done[0].payload).toMatchObject({ outcome: 'processed', last_error: null })
    expect(done[0].payload.processed_at).toBeTruthy()
  })

  it('does not add a second open attendance row on a retried join', async () => {
    const calls = install((call) => {
      if (call.table === 'plugnmeet_webhook_inbox' && call.op === 'upsert') return { data: { id: 'i1', processed_at: null, attempts: 1 } }
      if (call.table === 'live_classes' && call.op === 'select') return { data: liveClass }
      if (call.table === 'enrolments') return { data: { student_id: 'u1' } }
      if (call.table === 'attendance_records' && call.op === 'select') return { data: { id: 'open-row' } }
      return {}
    })
    expect((await post(event('participant_joined', { participant: { user_id: 'u1' } }))).status).toBe(200)
    expect(calls.filter((call) => call.table === 'attendance_records' && call.op === 'insert')).toHaveLength(0)
  })

  it('records an explicit ignored outcome for events without a known room', async () => {
    const calls = install((call) => {
      if (call.table === 'plugnmeet_webhook_inbox' && call.op === 'upsert') return { data: { id: 'i1', processed_at: null, attempts: 0 } }
      return {}
    })
    const body = JSON.stringify({ id: 'evt-2', event: 'room_started' })
    expect((await post(body)).status).toBe(200)
    const done = calls.filter((call) => call.table === 'plugnmeet_webhook_inbox' && call.op === 'update')
    expect(done[0].payload).toMatchObject({ outcome: 'ignored_no_room' })
    expect(done[0].payload.processed_at).toBeTruthy()
  })
})
