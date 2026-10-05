import { beforeEach, describe, expect, it, vi } from 'vitest'

type DeliveryState = { status: string }

const state = {
  users: [] as Array<{ id: string, first_name: string | null, email: string | null, created_at: string, role: string }>,
  deliveries: new Map<string, DeliveryState>(),
  sentEvents: [] as string[],
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table: string) {
      if (table === 'user_profiles') {
        return {
          select() {
            return {
              in: vi.fn(async () => ({ data: state.users, error: null })),
            }
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
            state.deliveries.set(payload.idempotency_key, { status: payload.status })
            return { error: null }
          }),
          update(values: { status?: string }) {
            return {
              eq: vi.fn(async (_column: string, value: string) => {
                const existing = state.deliveries.get(value)
                if (existing) state.deliveries.set(value, { status: values.status ?? existing.status })
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

  it('does not skip ahead when an earlier step is pending or failed', async () => {
    state.users = [{
      id: 'user-1',
      first_name: 'Ada',
      email: 'ada@example.com',
      created_at: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString(),
      role: 'admin',
    }]
    state.deliveries.set('drip_founder_letter_user-1', { status: 'failed' })

    await runOnboardingDripJob()

    expect(state.sentEvents).toEqual([])
  })
})

