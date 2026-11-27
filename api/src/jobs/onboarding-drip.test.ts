import { beforeEach, describe, expect, it, vi } from 'vitest'

type DeliveryState = { status: string, attempt_count?: number }

const state = {
  users: [] as Array<{ id: string, first_name: string | null, email: string | null, created_at: string, role: string }>,
  deliveries: new Map<string, DeliveryState>(),
  sentEvents: [] as string[],
  scanFilter: null as null | { column: string, value: string },
  scanLimit: 0,
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    async rpc(name: string, args: { p_key: string }) {
      if (name !== 'claim_email_delivery') throw new Error(`Unexpected rpc: ${name}`)
      const existing = state.deliveries.get(args.p_key)
      if (!existing || existing.status === 'sent') return { data: false, error: null }
      state.deliveries.set(args.p_key, { status: 'pending', attempt_count: (existing.attempt_count || 0) + 1 })
      return { data: true, error: null }
    },
    from(table: string) {
      if (table === 'user_profiles') {
        return {
          select() {
            const chain: any = {
              in: vi.fn(() => chain),
              gte: vi.fn((column: string, value: string) => { state.scanFilter = { column, value }; return chain }),
              order: vi.fn(() => chain),
              limit: vi.fn(async (count: number) => { state.scanLimit = count; return { data: state.users, error: null } }),
            }
            return chain
          },
        }
      }

      if (table === 'email_deliveries') {
        let key = ''
        return {
          select() { return this },
          eq(column: string, value: string) {
            if (column === 'idempotency_key') key = value
            return this
          },
          maybeSingle: vi.fn(async () => ({ data: state.deliveries.get(key) ?? null, error: null })),
          upsert: vi.fn(async (payload: { idempotency_key: string, status: string }) => {
            if (!state.deliveries.has(payload.idempotency_key)) state.deliveries.set(payload.idempotency_key, { status: 'pending', attempt_count: 0 })
            return { error: null }
          }),
          update(values: { status?: string }) {
            return {
              eq: vi.fn(async (_column: string, value: string) => {
                const existing = state.deliveries.get(value)
                if (existing) state.deliveries.set(value, { ...existing, status: values.status ?? existing.status })
                return { error: null }
              }),
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  },
}))

vi.mock('../emails/provider-router', () => ({
  sendEmail: vi.fn(async (_payload, metadata: { event: string }) => {
    state.sentEvents.push(metadata.event)
    return { id: `msg-${metadata.event}` }
  }),
}))

vi.mock('../emails/config', () => ({
  getEmailConfig: vi.fn(() => ({
    from: 'Kanvise <noreply@kanvise.com>',
    replyTo: 'support@kanvise.com',
    logoUrl: 'https://kanvise.com/logo.png',
  })),
}))

vi.mock('../emails/render-email', () => ({
  renderEmail: vi.fn(async (event: string) => ({
    subject: `Subject ${event}`,
    html: `<p>${event}</p>`,
    text: event,
  })),
}))

import { runOnboardingDripJob } from './onboarding-drip'

describe('runOnboardingDripJob', () => {
  beforeEach(() => {
    state.users = []
    state.deliveries = new Map()
    state.sentEvents = []
    vi.restoreAllMocks()
  })

  it('scans a bounded window of recent accounts (DEV-JOB-002)', async () => {
    await runOnboardingDripJob()
    expect(state.scanLimit).toBe(500)
    const cutoffAgeDays = (Date.now() - new Date(state.scanFilter!.value).getTime()) / 86_400_000
    expect(state.scanFilter!.column).toBe('created_at')
    expect(cutoffAgeDays).toBeGreaterThan(14)
    expect(cutoffAgeDays).toBeLessThan(16)
  })

  it('sends only the first due drip step in a single run', async () => {
    state.users = [{
      id: 'user-1',
      first_name: 'Ada',
      email: 'ada@example.com',
      created_at: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString(),
      role: 'admin',
    }]

    await runOnboardingDripJob()

    expect(state.sentEvents).toEqual(['founder_letter'])
  })

  it('sends the next due step after earlier steps were already sent', async () => {
    state.users = [{
      id: 'user-1',
      first_name: 'Ada',
      email: 'ada@example.com',
      created_at: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString(),
      role: 'admin',
    }]
    state.deliveries.set('drip_founder_letter_user-1', { status: 'sent' })

    await runOnboardingDripJob()

    expect(state.sentEvents).toEqual(['meet_kavi'])
  })

  it('retries a failed step instead of blocking the user forever', async () => {
    state.users = [{
      id: 'user-1', first_name: 'Ada', email: 'ada@example.com',
      created_at: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString(), role: 'admin',
    }]
    state.deliveries.set('drip_founder_letter_user-1', { status: 'failed', attempt_count: 1 })

    await runOnboardingDripJob()

    expect(state.sentEvents).toEqual(['founder_letter'])
    expect(state.deliveries.get('drip_founder_letter_user-1')?.status).toBe('sent')
  })

  it('moves past a step that used every attempt', async () => {
    state.users = [{
      id: 'user-1', first_name: 'Ada', email: 'ada@example.com',
      created_at: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString(), role: 'admin',
    }]
    state.deliveries.set('drip_founder_letter_user-1', { status: 'failed', attempt_count: 5 })

    await runOnboardingDripJob()

    expect(state.sentEvents).toEqual(['meet_kavi'])
  })
})
